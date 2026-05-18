import asyncio
import json
from fastapi import APIRouter, HTTPException, status
from app.services.llm import client
from app.models.schemas import (
    ParseInputRequest, ParseResponse,
    GeneratePlanResponse, ValidatedMealPlan,
    ValidatedMeal, ValidatedIngredient,
    ValidationWarning, ErrorResponse,
)
from app.services.llm import parse_user_input, generate_meal_plan
from app.services.usda import get_usda_nutrients, calculate_contribution

router = APIRouter(prefix="/ai", tags=["AI Pipeline"])

# Tolerance threshold for the output validator.
# If any day's total calories deviates more than this from the target,
# a warning is added to the response but the plan is still returned.
# 25% is forgiving enough for practical meal plans while still flagging
# significant mismatches for the evaluation chapter.
CALORIE_TOLERANCE_PCT = 0.25


# ── Endpoint 1: Parse ────────────────────────────────────────────────────────

@router.post(
    "/parse-input",
    response_model=ParseResponse,
    summary="Stage 1 — Parse natural language into structured input",
)
async def parse_input(body: ParseInputRequest):
    """
    Accepts the user's raw text and optional explicit allergies list.
    Returns a structured JSON representation ready for Stage 2.
    """
    try:
        parsed = await parse_user_input(body.text, body.allergies)
        return ParseResponse(success=True, data=parsed)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse input: {str(e)}"
        )


# ── Endpoint 2: Generate + validate full meal plan ───────────────────────────

@router.post(
    "/generate-plan",
    response_model=GeneratePlanResponse,
    summary="Full pipeline — parse → generate → USDA validate → output validate",
)
async def generate_plan(body: ParseInputRequest):
    """
    Full three-stage pipeline in one call.

    Stage 1: Parse natural language → ParsedInput (structured JSON)
    Stage 2: GPT-4o → 21-meal plan with LLM nutritional estimates
    Stage 3: USDA FoodData Central → validate/replace LLM estimates
    Stage 4: Output validator → flag days where calories deviate >25% from target

    The allergy field is enforced at both the parse stage (GPT extracts it)
    and the generation stage (injected as a hard constraint into the prompt).
    """

    # ── Stage 1+2 merged: Build ParsedInput directly, skip LLM parse ──
    # The frontend already sends structured data (goal, calorie target,
    # dietary preferences) as a formatted string. We extract the calorie
    # target with a simple regex rather than a second GPT-4o call.
    # This saves 1-3 seconds on every generation.
    import re as _re
    calorie_match = _re.search(r"(\d{3,5})\s*kcal", body.text)
    calorie_target = int(calorie_match.group(1)) if calorie_match else 2000

    # Extract goal keyword from the text
    goal_map = {
        "lose weight":   "lose weight",
        "build muscle":  "build muscle",
        "maintain":      "maintain weight",
        "eat healthier": "eat healthier",
        "high energy":   "high energy",
    }
    detected_goal = "general"
    text_lower = body.text.lower()
    for keyword, label in goal_map.items():
        if keyword in text_lower:
            detected_goal = label
            break

    # Extract dietary preferences (any bracketed or comma-separated after "Dietary preferences:")
    restrictions = []
    pref_match = _re.search(r"Dietary preferences?:\s*([^.]+)", body.text, _re.IGNORECASE)
    if pref_match:
        restrictions = [p.strip() for p in pref_match.group(1).split(",") if p.strip()]

    from app.models.schemas import ParsedInput
    parsed = ParsedInput(
        text=body.text,
        goal=detected_goal,
        calorie_target=calorie_target,
        restrictions=restrictions,
        allergies=body.allergies or [],
    )

    # ── Stage 2: Generate ────────────────────────────────────────
    try:
        meal_plan_llm = await generate_meal_plan(parsed)
    except Exception as e:
        import traceback
        traceback.print_exc()  # prints full error to uvicorn console
        raise HTTPException(status_code=422, detail=f"Meal plan generation failed: {str(e)}")

    # ── Stage 3: USDA validation ─────────────────────────────────
    # Note: automatic retry removed — it doubled worst-case generation time.
    # Calorie warnings are shown to the user via Stage 4 instead.
    # Collect unique ingredient names, fetch USDA data in parallel
    unique_ingredients: set[str] = set()
    for meal in meal_plan_llm.meals:
        for ing in meal.ingredients:
            unique_ingredients.add(ing.name.lower().strip())

    ingredient_names = list(unique_ingredients)
    # Wrap each lookup in a timeout — DEMO_KEY (30 req/hr) can hang
    # silently. 3s per lookup is generous; our built-in table returns in <1ms.
    async def safe_lookup(name: str):
        try:
            return await asyncio.wait_for(get_usda_nutrients(name), timeout=3.0)
        except Exception:
            from app.services.usda import USDANutrients
            return USDANutrients()

    usda_results = await asyncio.gather(
        *[safe_lookup(name) for name in ingredient_names],
        return_exceptions=True,
    )

    usda_cache: dict[str, any] = {}
    for name, result in zip(ingredient_names, usda_results):
        usda_cache[name] = None if isinstance(result, Exception) else result

    validated_meals: list[ValidatedMeal] = []
    unmatched: list[str] = []

    for meal in meal_plan_llm.meals:
        validated_ingredients: list[ValidatedIngredient] = []
        usda_total_cal = usda_total_pro = usda_total_carb = usda_total_fat = 0.0

        for ing in meal.ingredients:
            key      = ing.name.lower().strip()
            usda_raw = usda_cache.get(key)

            if usda_raw and usda_raw.usda_fdc_id:
                contributed = calculate_contribution(usda_raw, ing.quantity, ing.unit, ing.name)
                usda_total_cal  += contributed.calories
                usda_total_pro  += contributed.protein_g
                usda_total_carb += contributed.carbs_g
                usda_total_fat  += contributed.fat_g

                validated_ingredients.append(ValidatedIngredient(
                    name=ing.name, quantity=ing.quantity, unit=ing.unit,
                    llm_calories=ing.llm_calories, llm_protein_g=ing.llm_protein_g,
                    usda_calories=contributed.calories, usda_protein_g=contributed.protein_g,
                    usda_carbs_g=contributed.carbs_g, usda_fat_g=contributed.fat_g,
                    usda_fdc_id=contributed.usda_fdc_id, usda_matched=True,
                ))
            else:
                # Three-tier lookup failed — use LLM estimates as final fallback
                if key not in unmatched:
                    unmatched.append(ing.name)
                llm_cal  = ing.llm_calories  or 0
                llm_pro  = ing.llm_protein_g or 0
                llm_carb = ing.llm_carbs_g   or 0
                llm_fat  = ing.llm_fat_g     or 0
                usda_total_cal  += llm_cal
                usda_total_pro  += llm_pro
                usda_total_carb += llm_carb
                usda_total_fat  += llm_fat

                validated_ingredients.append(ValidatedIngredient(
                    name=ing.name, quantity=ing.quantity, unit=ing.unit,
                    llm_calories=llm_cal, llm_protein_g=llm_pro,
                    usda_calories=llm_cal if llm_cal > 0 else None,
                    usda_protein_g=llm_pro if llm_pro > 0 else None,
                    usda_carbs_g=llm_carb if llm_carb > 0 else None,
                    usda_fat_g=llm_fat if llm_fat > 0 else None,
                    usda_fdc_id=None, usda_matched=False,
                ))

        validated_meals.append(ValidatedMeal(
            name=meal.name,
            day_number=meal.day_number,
            meal_type=meal.meal_type,
            description=meal.description,
            ingredients=validated_ingredients,
            llm_total_calories=meal.llm_total_calories,
            llm_total_protein_g=meal.llm_total_protein_g,
            usda_total_calories=round(usda_total_cal,  1),
            usda_total_protein_g=round(usda_total_pro,  1),
            usda_total_carbs_g=round(usda_total_carb, 1),
            usda_total_fat_g=round(usda_total_fat,   1),
        ))

    # ── Stage 4: Output validator ────────────────────────────────
    # The supervisor specifically requested this step.
    # Groups meals by day, sums USDA calories, compares to target.
    # A warning is generated for any day that deviates > CALORIE_TOLERANCE_PCT.
    # The plan is still returned — warnings are informational, not blocking.
    validation_warnings: list[ValidationWarning] = []

    if parsed.calorie_target and parsed.calorie_target > 0:
        # Group meals by day_number
        days: dict[int, list[ValidatedMeal]] = {}
        for meal in validated_meals:
            days.setdefault(meal.day_number, []).append(meal)

        for day_num, day_meals in sorted(days.items()):
            daily_cals = sum(m.usda_total_calories for m in day_meals)
            target     = float(parsed.calorie_target)
            deviation  = abs(daily_cals - target) / target

            if deviation > CALORIE_TOLERANCE_PCT:
                validation_warnings.append(ValidationWarning(
                    day_number=day_num,
                    actual_calories=round(daily_cals, 1),
                    target_calories=target,
                    deviation_pct=round(deviation * 100, 1),
                ))

    result = ValidatedMealPlan(
        meals=validated_meals,
        goal=parsed.goal,
        calorie_target=parsed.calorie_target,
        restrictions=parsed.restrictions,
        allergies=parsed.allergies,
        unmatched_ingredients=unmatched,
        validation_warnings=validation_warnings,
    )

    return GeneratePlanResponse(success=True, data=result)


# ── Endpoint 3: Health check ─────────────────────────────────────────────────

@router.get("/health", summary="Health check")
async def health():
    return {
        "status":  "ok",
        "service": "NutriHub AI Microservice",
        "pipeline": ["parse", "generate", "usda_validate", "output_validate"],
    }


@router.post("/echo", summary="Debug — echo request body")
async def echo(body: dict):
    """Temporary debug endpoint — echoes back whatever JSON is sent."""
    return {"received": body}

# ── POST /ai/swap-meal ────────────────────────────────────────
@router.post("/swap-meal")
async def swap_meal(body: dict):
    """Single-meal swap via GPT-4o-mini. Returns one meal JSON object."""
    import traceback
    try:
        prompt    = body.get("prompt", "")
        meal_type = body.get("meal_type", "LUNCH")

        system = (
            "You are a professional nutritionist. "
            "Respond with a single valid JSON object only — no markdown, no explanation. "
            "Schema: {name, description, ingredients:[{name,quantity,unit,"
            "llm_calories,llm_protein_g,llm_carbs_g,llm_fat_g}],"
            "llm_total_calories,llm_total_protein_g,llm_total_carbs_g,llm_total_fat_g}"
        )

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.7,
            max_tokens=600,
        )

        raw  = response.choices[0].message.content
        data = json.loads(raw)
        return data

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"Swap failed: {str(e)}")