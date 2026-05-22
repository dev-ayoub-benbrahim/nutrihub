"""
llm.py — Daily meal plan generation service.
Generates 3 meals (BREAKFAST, LUNCH, DINNER) for a single day.
Much smaller output than weekly = no truncation, ~10s generation time.
"""
import json
import re
from openai import AsyncOpenAI
from app.core.config import settings
from app.models.schemas import ParsedInput, MealPlanLLM

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


# JSON recovery 

def clean_json(raw: str) -> dict:
    """Parse JSON from GPT response with truncation recovery."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # 1. Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Try closing open brackets
    for suffix in ["]}", "}]}", "}}"]:
        try:
            return json.loads(text + suffix)
        except json.JSONDecodeError:
            pass

    # 3. Extract complete meal objects from partial JSON
    meals = []
    meals_start = text.find('"meals"')
    if meals_start > -1:
        array_start = text.find('[', meals_start)
        if array_start > -1:
            depth, obj_start = 0, None
            for i, ch in enumerate(text[array_start:], array_start):
                if ch == '{':
                    if depth == 0:
                        obj_start = i
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0 and obj_start is not None:
                        try:
                            meal = json.loads(text[obj_start:i + 1])
                            if all(k in meal for k in ("name", "meal_type")):
                                meals.append(meal)
                        except json.JSONDecodeError:
                            pass
                        obj_start = None

    if meals:
        return {"meals": meals}

    raise ValueError(
        f"Could not parse GPT response. First 200 chars: {text[:200]!r}"
    )


# Parse stage 

async def parse_user_input(text: str, allergies: list[str] = None):
    """Passthrough for backward compatibility — router builds ParsedInput directly."""
    from app.models.schemas import ParsedInput
    return ParsedInput(
        goal=text,
        calorie_target=2000,
        restrictions=[],
        allergies=allergies or [],
        ingredients=[],
    )


# ── Prompt builder ─────────────────────────────────────────────────────────────

def _build_daily_prompt(parsed: ParsedInput) -> str:
    """Build the system prompt for a single-day 3-meal plan."""

    restrictions_text = (
        f"Dietary preference: {', '.join(parsed.restrictions)}."
        if parsed.restrictions else "No dietary preferences."
    )

    allergy_block = ""
    if parsed.allergies:
        allergy_block = (
            f"\n\n🚫 ALLERGY — HARD CONSTRAINT:\n"
            f"NEVER include these in any meal: {', '.join(parsed.allergies)}\n"
            f"This is a safety requirement. No exceptions."
        )

    target = parsed.calorie_target or 2000
    b_target = round(target * 0.28)
    l_target = round(target * 0.35)
    d_target = round(target * 0.37)

    cal_ref = (
        "CALORIES per 100g: Chicken:165 | Beef:250 | Eggs(1):75 | Tofu:76 | "
        "Lentils:116 | Chickpeas:164 | Rice cooked:130 | Pasta cooked:131 | "
        "Oats dry:389 | Bread 1 slice:80 | Potato:77 | Olive oil:884 | "
        "Almonds:579 | Avocado:160 | Cheese:402 | Greek yogurt:59 | "
        "Banana:89 | Broccoli:34 | Salmon:208 | Tuna:132 | Milk:61"
    )

    return f"""You are a nutritionist. Generate ONE day of meals: BREAKFAST, LUNCH, DINNER.

Goal: {parsed.goal}
Daily calorie target: {target} kcal
  → BREAKFAST: ~{b_target} kcal
  → LUNCH: ~{l_target} kcal
  → DINNER: ~{d_target} kcal
{restrictions_text}{allergy_block}

{cal_ref}

Return ONLY this JSON (no markdown, no extra text):
{{
  "meals": [
    {{
      "name": "string",
      "meal_type": "BREAKFAST",
      "day_number": 1,
      "ingredients": [
        {{"name": "string", "quantity": number, "unit": "string",
          "llm_calories": number, "llm_protein_g": number,
          "llm_carbs_g": number, "llm_fat_g": number}}
      ],
      "llm_total_calories": number,
      "llm_total_protein_g": number,
      "llm_total_carbs_g": number,
      "llm_total_fat_g": number
    }},
    {{ ... LUNCH ... }},
    {{ ... DINNER ... }}
  ]
}}

RULES:
1. Exactly 3 meals: BREAKFAST, LUNCH, DINNER. day_number = 1 for all.
2. Hit the calorie targets. Use realistic portion sizes.
3. Short ingredient names (2-3 words max).
4. Protein 40-60g total | varied ingredients across the day.
5. NEVER violate allergy constraints.
6. Return ONLY the JSON object."""


# ── Main generation function ───────────────────────────────────────────────────

async def generate_meal_plan(parsed: ParsedInput) -> MealPlanLLM:
    """
    Generate a single day meal plan (3 meals) using GPT-4o-mini.
    Small output = no truncation, ~10 second generation time.
    """
    system_prompt = _build_daily_prompt(parsed)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": "Generate today's meal plan now."},
        ],
        temperature=0.6,
        max_tokens=3000,
    )

    raw           = response.choices[0].message.content
    finish_reason = response.choices[0].finish_reason
    is_truncated  = (finish_reason == "length") or (not raw.rstrip().endswith("}"))

    if is_truncated:
        # Retry with lower temperature and explicit brevity instruction
        response2 = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": "Generate today's meal plan. 3 meals only. Short ingredient names. JSON only."},
            ],
            temperature=0.3,
            max_tokens=3000,
        )
        raw = response2.choices[0].message.content

    data = clean_json(raw)

    # Unwrap envelope if needed
    if "meals" not in data:
        for key in ("meal_plan", "plan", "daily_plan", "data"):
            if key in data and isinstance(data[key], dict) and "meals" in data[key]:
                data = data[key]
                break

    # Add template descriptions if missing
    def _description(meal: dict) -> str:
        ings = meal.get("ingredients", [])
        main = ings[0].get("name", "ingredients") if ings else "ingredients"
        sides = [i.get("name", "") for i in ings[1:3] if i.get("name")]
        side_text = f" with {' and '.join(sides)}" if sides else ""
        mt = meal.get("meal_type", "meal").lower()
        return f"Cook {main}{side_text}. Season to taste and serve as a balanced {mt}."

    for meal in data.get("meals", []):
        meal.setdefault("description", _description(meal))
        meal.setdefault("day_number", 1)

    return MealPlanLLM(**data)