import json
import re
from openai import AsyncOpenAI
from app.core.config import settings
from app.models.schemas import ParsedInput, MealPlanLLM

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def clean_json(raw: str) -> dict:
    """
    Robustly parse JSON from a GPT response.
    Handles: raw JSON, markdown code fences, truncated responses.
    """
    # Strip markdown code fences if present
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # If truncated, try to find the last complete object by trimming to last }
    # This handles the case where GPT stops mid-response
    last_brace = text.rfind("}")
    if last_brace != -1:
        try:
            return json.loads(text[: last_brace + 1])
        except json.JSONDecodeError:
            pass

    # Last resort — raise with useful context
    raise ValueError(
        f"Could not parse GPT response as JSON. "
        f"First 200 chars: {text[:200]!r}"
    )


# ── Stage 1: Parse natural language input ────────────────────────────────────

PARSE_SYSTEM_PROMPT = """You are a dietary assistant. Extract structured information from
the user's message and return ONLY valid JSON matching this exact schema:

{
  "ingredients": [
    {"name": "string", "quantity": number_or_null, "unit": "string_or_null"}
  ],
  "goal": "string (e.g. lose weight, build muscle, maintain weight)",
  "calorie_target": number_or_null,
  "restrictions": ["string"],
  "allergies": ["string"]
}

Rules:
- ingredients: list every food item mentioned. If no quantity is given, set quantity to null.
- goal: infer from context. Default to "maintain weight" if unclear.
- calorie_target: extract the number if stated, otherwise null.
- restrictions: dietary preferences only (e.g. vegetarian, vegan, halal, gluten-free).
- allergies: ONLY extract explicitly stated allergies or hard avoidances.
  Do not infer allergies from restrictions.
- Return ONLY the JSON object. No explanation, no markdown, no extra text."""


async def parse_user_input(text: str, allergies: list[str] = []) -> ParsedInput:
    """
    Stage 1 — Parse the user's natural language request into structured JSON.

    Allergies are passed as a dedicated argument (not embedded in the text)
    so they cannot be accidentally overridden by prompt injection in the text field.
    This is the supervisor-requested safety step.
    """
    # Merge any explicitly passed allergies with those detected in text
    allergy_instruction = ""
    if allergies:
        safe_allergies = [a.strip()[:50] for a in allergies[:10]]  # sanitise
        allergy_instruction = (
            f"\n\nIMPORTANT: The user has explicitly stated the following allergies "
            f"or hard avoidances. These MUST appear in the allergies field and must "
            f"NEVER appear in any generated meal plan:\n{', '.join(safe_allergies)}"
        )

    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": PARSE_SYSTEM_PROMPT + allergy_instruction},
            {"role": "user",   "content": f"USER INPUT:\n{text}"},
        ],
        temperature=0.2,
        max_tokens=800,
    )

    raw  = response.choices[0].message.content
    data = clean_json(raw)

    # Merge the explicitly passed allergies into the parsed result
    # so they're always present even if GPT missed them
    parsed = ParsedInput(**data)
    merged_allergies = list(set(parsed.allergies + allergies))
    parsed.allergies = merged_allergies
    return parsed


# ── Stage 2: Generate 7-day meal plan ────────────────────────────────────────

def _build_generation_prompt(parsed: ParsedInput) -> str:
    """Build the meal plan generation system prompt from parsed user input."""
    ingredient_list = ", ".join(
        f"{ing.quantity or ''}{ing.unit or ''} {ing.name}".strip()
        for ing in parsed.ingredients
    ) or "any available ingredients"

    restrictions_text = (
        f"Dietary preferences: {', '.join(parsed.restrictions)}."
        if parsed.restrictions else "No specific dietary preferences."
    )

    # Allergies get their own HARD CONSTRAINT block — separate from preferences
    # so the model cannot rationalise overriding them
    allergy_block = ""
    if parsed.allergies:
        allergy_block = (
            f"\n\n🚫 HARD ALLERGY CONSTRAINT — CRITICAL:\n"
            f"The following ingredients MUST NEVER appear in ANY meal under ANY circumstances:\n"
            f"{', '.join(parsed.allergies)}\n"
            f"This is a health and safety requirement. Violating this constraint is not acceptable."
        )

    target = parsed.calorie_target or 2000
    breakfast_target = round(target * 0.28)
    lunch_target     = round(target * 0.35)
    dinner_target    = round(target * 0.37)

    # Calorie reference table — gives GPT exact values to calculate portions
    cal_ref = """
CALORIE REFERENCE (use these exact values to calculate portions):
Chicken breast: 165 kcal/100g | Beef (lean): 250 kcal/100g | Salmon: 208 kcal/100g | Eggs: 147 kcal/100g
White rice (cooked): 130 kcal/100g | Brown rice (cooked): 123 kcal/100g | Pasta (cooked): 131 kcal/100g
Oats (dry): 389 kcal/100g | Quinoa (cooked): 120 kcal/100g | Bread (slice ~30g): 80 kcal/slice
Sweet potato: 86 kcal/100g | Potato: 77 kcal/100g | Lentils (cooked): 116 kcal/100g | Chickpeas: 164 kcal/100g
Olive oil: 884 kcal/100ml | Butter: 717 kcal/100g | Almonds: 579 kcal/100g | Peanut butter: 588 kcal/100g
Milk: 61 kcal/100ml | Greek yogurt: 59 kcal/100g | Cheese: 402 kcal/100g | Avocado: 160 kcal/100g
Banana: 89 kcal/100g | Apple: 52 kcal/100g | Broccoli: 34 kcal/100g | Spinach: 23 kcal/100g
Mixed greens: 20 kcal/100g | Tomato: 18 kcal/100g | Cucumber: 16 kcal/100g | Carrot: 41 kcal/100g
Honey: 304 kcal/100g | Sugar: 387 kcal/100g | Hummus: 177 kcal/100g | Tofu: 76 kcal/100g"""

    return f"""You are a professional nutritionist. Generate a 7-day personalised meal plan.

User profile:
- Goal: {parsed.goal}
- MANDATORY daily calorie target: {target} kcal
  → BREAKFAST must be ~{breakfast_target} kcal
  → LUNCH must be ~{lunch_target} kcal
  → DINNER must be ~{dinner_target} kcal
- {restrictions_text}{allergy_block}

{cal_ref}

Return ONLY a valid JSON object matching this exact schema:
{{
  "meals": [
    {{
      "name": "string",
      "day_number": integer (1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday),
      "meal_type": "BREAKFAST|LUNCH|DINNER",
      "description": "2-3 sentence cooking instructions e.g. Season chicken with salt and pepper. Grill for 6-7 min each side until cooked through. Serve over rice with steamed broccoli.",
      "ingredients": [
        {{"name": "string", "quantity": number, "unit": "string", "llm_calories": number, "llm_protein_g": number, "llm_carbs_g": number, "llm_fat_g": number}}
      ],
      "llm_total_calories": number,
      "llm_total_protein_g": number
    }}
  ]
}}

WORKED EXAMPLE — How to hit 1000 kcal for a lunch:
  Chicken breast 250g × (165÷100) = 413 kcal
  Brown rice 200g × (123÷100)     = 246 kcal
  Olive oil 15ml × (884÷100)      = 133 kcal
  Broccoli 150g × (34÷100)        = 51 kcal
  Tomato 100g × (18÷100)          = 18 kcal
  TOTAL = 861 kcal → add 30g almonds (579÷100×30 = 174) → 1035 kcal ✓
Use this kind of arithmetic for EVERY meal.

CRITICAL RULES — YOU MUST FOLLOW THESE EXACTLY:

1. CALORIE TARGET IS NON-NEGOTIABLE. Each day MUST total the daily_calorie_target ± 100 kcal.
   BEFORE writing each meal, calculate: how many kcal do I still need for today?
   Then size portions accordingly. Small portions are WRONG. A 700 kcal lunch needs
   substantial quantities — e.g. 200g chicken (330 kcal) + 150g rice (195 kcal) + 20ml oil (177 kcal) = 702 kcal.

2. PORTION SIZES must be large enough to hit the target. Use these reference portions:
   - Protein source: 150-250g per meal (chicken breast, beef, salmon, eggs×3-4)
   - Starchy carb: 150-250g cooked (rice, pasta, potatoes, oats 80-100g dry)
   - Fat source: 15-30ml oil, 30g nuts, half an avocado
   - Vegetables: 100-200g per meal
   A meal targeting 700 kcal MUST have at least 4-6 ingredients with substantial quantities.

3. VERIFY your calorie arithmetic before returning. For each meal:
   llm_total_calories = sum of (quantity × calories_per_unit) for all ingredients.
   The three meal totals for each day must sum to daily_calorie_target ± 100 kcal.

4. Generate exactly 21 meals: 3 per day × 7 days (BREAKFAST, LUNCH, DINNER).
   day_number must be 1-7. Each day must have exactly 3 meals.

5. Vary meals across the week. Never repeat the same meal more than twice.

6. ALL meals MUST respect dietary preferences. NEVER include allergens under any circumstances.

7. Use simple ingredient names: "eggs" not "large free-range eggs", "chicken breast"
   not "boneless skinless chicken breast fillet", "rice" not "long-grain basmati rice".

8. Return ONLY the JSON object. No markdown, no explanation, no extra text."""


async def generate_meal_plan(parsed: ParsedInput) -> MealPlanLLM:
    """
    Stage 2 — Generate a 7-day meal plan from the parsed input.

    Uses response_format to enforce valid JSON output.
    Temperature 0.7 for creative variety while remaining coherent.
    """
    system_prompt = _build_generation_prompt(parsed)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",  # ~5x faster than gpt-4o; switch back if JSON reliability drops
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": "Generate the meal plan now. Use short ingredient names. Include a brief description for each meal."},
        ],
        temperature=0.5,
        max_tokens=7500,  # gpt-4o-mini needs ~5000-7000 for 21 meals with descriptions
    )

    raw  = response.choices[0].message.content

    # Detect truncation — check both finish_reason AND whether JSON is incomplete
    finish_reason = response.choices[0].finish_reason
    is_truncated  = (finish_reason == "length") or (not raw.rstrip().endswith("}"))

    if is_truncated:
        response2 = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": "Generate the meal plan now. Use short ingredient names and short descriptions (one sentence each)."},
            ],
            temperature=0.5,
            max_tokens=8000,
        )
        raw = response2.choices[0].message.content

    data = clean_json(raw)

    # gpt-4o-mini sometimes wraps response in an envelope key
    # e.g. {"meal_plan": {"meals": [...]}} or {"plan": {"meals": [...]}}
    if "meals" not in data:
        for key in ("meal_plan", "plan", "weekly_plan", "data", "result"):
            if key in data and isinstance(data[key], dict) and "meals" in data[key]:
                data = data[key]
                break
        else:
            # Last resort: find the meals list anywhere in the response
            for val in data.values():
                if isinstance(val, dict) and "meals" in val:
                    data = val
                    break
                if isinstance(val, list) and len(val) > 0:
                    # Maybe meals is the top-level list
                    data = {"meals": val}
                    break

    return MealPlanLLM(**data)