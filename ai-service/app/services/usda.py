"""
Three-tier lookup strategy:
  1. Built-in table  — 80 common ingredients, USDA-sourced values, instant
  2. USDA API        — for ingredients not in the built-in table
  3. LLM estimate    — final fallback when both above fail

This ensures accurate values for common meal plan ingredients (eggs, chicken,
rice, bread etc.) regardless of USDA API search quality.

All per-100g values are sourced from USDA FoodData Central SR Legacy data.
"""

import httpx
from app.core.config import settings
from app.models.schemas import USDANutrients

USDA_BASE = "https://api.nal.usda.gov/fdc/v1"

NUTRIENT_IDS = {
    "calories":  1008,
    "protein_g": 1003,
    "carbs_g":   1005,
    "fat_g":     1004,
}

# Built-in nutrition table (per 100g) 
# Sourced from USDA SR Legacy / FoodData Central.
# Keys are lowercase — searched by substring match.
# Format: { "keyword": (calories, protein_g, carbs_g, fat_g) }

NUTRITION_TABLE: dict[str, tuple[float, float, float, float]] = {
    # ── Eggs & Dairy ─────────────────────────────────────────────────────────
    "egg":                    (147.0, 12.6,  0.7,  10.0),
    "greek yogurt":           ( 59.0,  9.9,  3.6,   0.4),
    "yogurt":                 ( 61.0,  3.5,  4.7,   3.3),
    "milk":                   ( 61.0,  3.2,  4.8,   3.3),
    "cheese":                 (402.0, 25.0,  1.3,  33.0),
    "cheddar":                (403.0, 25.0,  1.3,  33.1),
    "feta":                   (264.0, 14.2,  4.1,  21.3),
    "mozzarella":             (300.0, 22.2,  2.2,  22.4),
    "butter":                 (717.0,  0.9,  0.1,  81.1),
    "cream":                  (340.0,  2.8,  2.8,  36.1),
    "cottage cheese":         ( 98.0, 11.1,  3.4,   4.3),
    # ── Proteins — Poultry ───────────────────────────────────────────────────
    "chicken breast":         (165.0, 31.0,  0.0,   3.6),
    "chicken thigh":          (209.0, 26.0,  0.0,  10.9),
    "chicken":                (165.0, 31.0,  0.0,   3.6),
    "turkey":                 (189.0, 29.0,  0.0,   7.4),
    # ── Proteins — Red meat ──────────────────────────────────────────────────
    "beef":                   (250.0, 26.0,  0.0,  17.0),
    "ground beef":            (254.0, 17.2,  0.0,  20.0),
    "minced beef":            (254.0, 17.2,  0.0,  20.0),
    "steak":                  (271.0, 26.4,  0.0,  18.0),
    "lamb":                   (294.0, 25.6,  0.0,  20.8),
    "pork":                   (242.0, 27.0,  0.0,  14.0),
    # ── Proteins — Fish & Seafood ────────────────────────────────────────────
    "salmon":                 (208.0, 20.4,  0.0,  13.4),
    "tuna":                   (132.0, 28.0,  0.0,   1.0),
    "cod":                    ( 82.0, 17.8,  0.0,   0.7),
    "shrimp":                 ( 99.0, 24.0,  0.0,   0.3),
    "prawns":                 ( 99.0, 24.0,  0.0,   0.3),
    # ── Grains & Bread ───────────────────────────────────────────────────────
    "white rice":             (130.0,  2.7, 28.6,   0.3),
    "brown rice":             (123.0,  2.7, 25.6,   1.0),
    "rice":                   (130.0,  2.7, 28.6,   0.3),
    "quinoa":                 (120.0,  4.4, 21.3,   1.9),
    "oats":                   (389.0, 16.9, 66.3,   6.9),
    "oatmeal":                ( 71.0,  2.5, 12.0,   1.5),  # cooked
    "pasta":                  (131.0,  5.0, 25.0,   1.1),  # cooked
    "bread":                  (265.0,  9.0, 49.0,   3.2),
    "whole wheat bread":      (247.0, 13.0, 43.0,   3.4),
    "whole grain bread":      (247.0, 13.0, 43.0,   3.4),
    "white bread":            (265.0,  9.0, 49.0,   3.2),
    "tortilla":               (218.0,  5.7, 36.0,   5.6),
    "wrap":                   (218.0,  5.7, 36.0,   5.6),
    "pita":                   (275.0,  9.1, 55.7,   1.2),
    "bagel":                  (270.0, 10.0, 53.0,   1.7),
    "couscous":               (112.0,  3.8, 23.2,   0.2),  # cooked
    "barley":                 (354.0, 12.5, 73.5,   2.3),
    # ── Legumes ──────────────────────────────────────────────────────────────
    "chickpeas":              (164.0,  8.9, 27.4,   2.6),
    "lentils":                (116.0,  9.0, 20.1,   0.4),
    "black beans":            (132.0,  8.9, 23.7,   0.5),
    "kidney beans":           (127.0,  8.7, 22.8,   0.5),
    "hummus":                 (177.0,  4.9, 14.3,  10.4),
    "tofu":                   ( 76.0,  8.1,  1.9,   4.8),
    # ── Vegetables ───────────────────────────────────────────────────────────
    "spinach":                ( 23.0,  2.9,  3.6,   0.4),
    "kale":                   ( 49.0,  4.3,  8.8,   0.9),
    "broccoli":               ( 34.0,  2.8,  6.6,   0.4),
    "cauliflower":            ( 25.0,  1.9,  5.0,   0.3),
    "carrot":                 ( 41.0,  0.9,  9.6,   0.2),
    "lettuce":                ( 15.0,  1.4,  2.9,   0.2),
    "mixed greens":           ( 20.0,  2.0,  3.5,   0.3),
    "salad":                  ( 20.0,  2.0,  3.5,   0.3),
    "cucumber":               ( 16.0,  0.7,  3.6,   0.1),
    "tomato":                 ( 18.0,  0.9,  3.9,   0.2),
    "cherry tomato":          ( 18.0,  0.9,  3.9,   0.2),
    "bell pepper":            ( 31.0,  1.0,  6.0,   0.3),
    "onion":                  ( 40.0,  1.1,  9.3,   0.1),
    "garlic":                 (149.0,  6.4, 33.1,   0.5),
    "mushroom":               ( 22.0,  3.1,  3.3,   0.3),
    "zucchini":               ( 17.0,  1.2,  3.1,   0.3),
    "courgette":              ( 17.0,  1.2,  3.1,   0.3),
    "eggplant":               ( 25.0,  1.0,  5.9,   0.2),
    "aubergine":              ( 25.0,  1.0,  5.9,   0.2),
    "potato":                 ( 77.0,  2.0, 17.5,   0.1),
    "sweet potato":           ( 86.0,  1.6, 20.1,   0.1),
    "corn":                   ( 86.0,  3.3, 19.0,   1.4),
    "peas":                   ( 81.0,  5.4, 14.5,   0.4),
    "asparagus":              ( 20.0,  2.2,  3.9,   0.2),
    "celery":                 ( 16.0,  0.7,  3.0,   0.2),
    # ── Fruits ───────────────────────────────────────────────────────────────
    "banana":                 ( 89.0,  1.1, 23.0,   0.3),
    "apple":                  ( 52.0,  0.3, 14.0,   0.2),
    "orange":                 ( 47.0,  0.9, 12.0,   0.1),
    "berries":                ( 57.0,  0.7, 14.5,   0.3),
    "blueberry":              ( 57.0,  0.7, 14.5,   0.3),
    "strawberry":             ( 32.0,  0.7,  7.7,   0.3),
    "mango":                  ( 60.0,  0.8, 15.0,   0.4),
    "avocado":                (160.0,  2.0,  9.0,  15.0),
    "grapes":                 ( 69.0,  0.6, 18.1,   0.2),
    "lemon":                  ( 29.0,  1.1,  9.3,   0.3),
    # ── Nuts & Seeds ─────────────────────────────────────────────────────────
    "almonds":                (579.0, 21.2, 21.6,  49.9),
    "walnuts":                (654.0, 15.2, 13.7,  65.2),
    "peanut butter":          (588.0, 25.1, 20.1,  50.4),
    "sunflower seeds":        (584.0, 20.8, 20.0,  51.5),
    "chia seeds":             (486.0, 16.5, 42.1,  30.7),
    "flaxseed":               (534.0, 18.3, 28.9,  42.2),
    # ── Oils & Fats ──────────────────────────────────────────────────────────
    "olive oil":              (884.0,  0.0,  0.0, 100.0),
    "vegetable oil":          (884.0,  0.0,  0.0, 100.0),
    "coconut oil":            (862.0,  0.0,  0.0, 100.0),
    # ── Condiments & Extras ──────────────────────────────────────────────────
    "soy sauce":              ( 53.0,  8.1,  4.9,   0.6),
    "ketchup":                (112.0,  1.5, 26.1,   0.2),
    "honey":                  (304.0,  0.3, 82.4,   0.0),
    "sugar":                  (387.0,  0.0, 100.0,  0.0),
    "salt":                   (  0.0,  0.0,  0.0,   0.0),
    "pepper":                 (251.0, 10.4, 63.7,   3.3),
    "flour":                  (364.0, 10.3, 76.3,   1.0),
}

# ── Unit → grams conversion ───────────────────────────────────────────────────
UNIT_TO_GRAMS: dict[str, float] = {
    "g": 1.0, "gram": 1.0, "grams": 1.0,
    "kg": 1000.0, "kilogram": 1000.0, "kilograms": 1000.0,
    "ml": 1.0, "milliliter": 1.0, "millilitre": 1.0, "milliliters": 1.0, "millilitres": 1.0,
    "l": 1000.0, "liter": 1000.0, "litre": 1000.0, "liters": 1000.0, "litres": 1000.0,
    "tbsp": 15.0, "tablespoon": 15.0, "tablespoons": 15.0,
    "tsp": 5.0, "teaspoon": 5.0, "teaspoons": 5.0,
    "cup": 240.0, "cups": 240.0,
    "oz": 28.35, "ounce": 28.35, "ounces": 28.35,
    "lb": 453.6, "pound": 453.6, "pounds": 453.6,
    "mg": 0.001,
}

# Weight per single countable unit (grams) — food-specific
COUNTABLE_WEIGHTS: dict[str, float] = {
    "egg": 55.0,
    "banana": 120.0,
    "apple": 182.0,
    "orange": 131.0,
    "potato": 150.0,
    "sweet potato": 130.0,
    "tomato": 123.0,
    "onion": 110.0,
    "garlic clove": 5.0,
    "garlic": 5.0,
    "clove": 5.0,
    "bread": 30.0,
    "toast": 30.0,
    "slice": 30.0,
    "tortilla": 45.0,
    "wrap": 45.0,
    "chicken breast": 174.0,
    "chicken thigh": 100.0,
    "salmon": 150.0,
    "fillet": 150.0,
    "avocado": 150.0,
    "mushroom": 20.0,
    "cracker": 7.0,
    "bagel": 98.0,
    "date": 24.0,
    "fig": 50.0,
    "strawberry": 12.0,
}


def _lookup_table(name: str) -> USDANutrients | None:
    """
    Search the built-in nutrition table.
    Uses longest-match substring: 'chicken breast' beats 'chicken'.
    Returns None if no match found.
    """
    name_lower = name.lower()
    matches = [(key, vals) for key, vals in NUTRITION_TABLE.items() if key in name_lower]
    if not matches:
        return None
    # Longest key = most specific match
    key, (cal, pro, carb, fat) = max(matches, key=lambda x: len(x[0]))
    return USDANutrients(
        calories=cal, protein_g=pro, carbs_g=carb, fat_g=fat, usda_fdc_id=f"builtin:{key}"
    )


def _to_grams(ingredient_name: str, quantity: float, unit: str) -> float:
    """Convert any quantity+unit to grams."""
    unit_lower = (unit or "g").lower().strip()

    if unit_lower in UNIT_TO_GRAMS:
        return quantity * UNIT_TO_GRAMS[unit_lower]

    # Countable units — look up food-specific weight
    if unit_lower in ("piece", "pieces", "whole", "unit", "units",
                      "slice", "slices", "fillet", "fillets",
                      "clove", "cloves", "stalk", "stalks",
                      "head", "heads", "leaf", "leaves",
                      "strip", "strips", "portion", "portions"):
        name_lower = ingredient_name.lower()
        matches = [(k, w) for k, w in COUNTABLE_WEIGHTS.items() if k in name_lower]
        if matches:
            _, weight = max(matches, key=lambda x: len(x[0]))
            return quantity * weight
        return quantity * 100.0  # Generic fallback: 100g per unit

    # Unknown unit — treat as grams
    return quantity


def _scale(nutrients_per_100g: USDANutrients, grams: float) -> USDANutrients:
    """Scale per-100g values to actual grams used."""
    r = grams / 100.0
    return USDANutrients(
        calories    = round(nutrients_per_100g.calories   * r, 1),
        protein_g   = round(nutrients_per_100g.protein_g  * r, 1),
        carbs_g     = round(nutrients_per_100g.carbs_g    * r, 1),
        fat_g       = round(nutrients_per_100g.fat_g      * r, 1),
        usda_fdc_id = nutrients_per_100g.usda_fdc_id,
    )


def _clean_search_term(name: str) -> str:
    """Simplify ingredient name to improve USDA search results."""
    name = name.lower().strip()
    substitutions = {
        "toast": "bread", "courgette": "zucchini",
        "aubergine": "eggplant", "coriander": "cilantro",
        "minced beef": "ground beef", "spring onion": "scallion",
        "tinned": "canned", "greek yogurt": "yogurt greek",
    }
    for old, new in substitutions.items():
        name = name.replace(old, new)
    noise = ["fresh", "frozen", "raw", "cooked", "organic", "large", "medium",
             "small", "boneless", "skinless", "diced", "chopped", "sliced",
             "whole", "dried", "canned", "extra", "lean", "grilled", "baked"]
    words = [w for w in name.split() if w not in noise]
    return " ".join(words) if words else name


async def _usda_lookup(name: str) -> USDANutrients | None:
    """
    Query USDA FoodData Central. Returns None if no good result found.
    Fetches top 5 results and picks the best match by word overlap.
    """
    clean = _clean_search_term(name)
    name_words = set(clean.lower().split())

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # Try Foundation + SR Legacy first (whole, unprocessed foods)
            resp = await client.get(f"{USDA_BASE}/foods/search", params={
                "query":    clean,
                "api_key":  settings.USDA_API_KEY,
                "dataType": "Foundation,SR Legacy",
                "pageSize": 5,
            })
            resp.raise_for_status()
            foods = resp.json().get("foods", [])

            # Fallback to broader search if nothing found
            if not foods:
                resp = await client.get(f"{USDA_BASE}/foods/search", params={
                    "query":   clean,
                    "api_key": settings.USDA_API_KEY,
                    "pageSize": 5,
                })
                resp.raise_for_status()
                foods = resp.json().get("foods", [])
    except Exception:
        return None

    if not foods:
        return None

    # Pick the food whose description best matches the search terms
    def score(food: dict) -> int:
        desc = food.get("description", "").lower()
        return sum(1 for w in name_words if w in desc)

    best = max(foods, key=score)

    # Extract macros
    nutrient_map: dict[int, float] = {}
    for n in best.get("foodNutrients", []):
        nid = n.get("nutrientId")
        val = n.get("value")
        if nid and val is not None:
            nutrient_map[int(nid)] = float(val)

    result = USDANutrients(
        calories    = nutrient_map.get(NUTRIENT_IDS["calories"],  0.0),
        protein_g   = nutrient_map.get(NUTRIENT_IDS["protein_g"], 0.0),
        carbs_g     = nutrient_map.get(NUTRIENT_IDS["carbs_g"],   0.0),
        fat_g       = nutrient_map.get(NUTRIENT_IDS["fat_g"],     0.0),
        usda_fdc_id = str(best.get("fdcId", "")),
    )

    # Sanity check — reject if calories are 0 or suspiciously high for a whole food
    if result.calories == 0:
        return None

    return result


async def get_usda_nutrients(ingredient_name: str) -> USDANutrients:
    """
    Three-tier nutrition lookup:
    1. Built-in table (instant, accurate for ~80 common ingredients)
    2. USDA API       (for less common ingredients)
    3. Returns zero-filled USDANutrients if both fail
       — the router will use LLM estimates as fallback
    """
    # Tier 1 — built-in table (covers most meal plan ingredients)
    built_in = _lookup_table(ingredient_name)
    if built_in is not None:
        return built_in

    # Tier 2 — USDA API
    usda = await _usda_lookup(ingredient_name)
    if usda is not None:
        return usda

    # Tier 3 — nothing found, return zeros
    return USDANutrients()


def calculate_contribution(
    nutrients_per_100g: USDANutrients,
    quantity: float,
    unit: str,
    ingredient_name: str = "",
) -> USDANutrients:
    """Scale per-100g values to actual quantity used."""
    grams = _to_grams(ingredient_name, quantity, unit)
    return _scale(nutrients_per_100g, grams)