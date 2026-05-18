from pydantic import BaseModel, Field
from typing import Optional


# ── Stage 1: Parse input ──────────────────────────────────────────────────────

class ParseInputRequest(BaseModel):
    """Raw natural language from the user."""
    text: str = Field(..., min_length=5, max_length=2000,
                      description="User's natural language meal plan request")
    # Allergies are passed separately — a dedicated field prevents the user
    # from accidentally burying an allergy inside the main text where GPT
    # might miss it. The supervisor specifically requested this step.
    allergies: list[str] = Field(
        default=[],
        description="Explicit list of allergy/avoidance items e.g. ['nuts', 'dairy', 'shellfish']"
    )


class ParsedIngredient(BaseModel):
    """A single ingredient extracted by GPT-4o."""
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None


class ParsedInput(BaseModel):
    """
    Validated output from Stage 1.
    This is the structured representation of the user's natural language request.
    GPT-4o produces this; Pydantic validates it before Stage 2 begins.
    """
    ingredients:    list[ParsedIngredient] = []  # empty when using structured form input
    goal:           str                     # e.g. "lose weight", "build muscle"
    calorie_target: Optional[int] = None
    restrictions:   list[str]     = []     # dietary preferences e.g. ["vegetarian"]
    allergies:      list[str]     = []     # hard safety constraints e.g. ["nuts", "dairy"]


# ── Stage 2: Meal plan generation ────────────────────────────────────────────

class MealIngredientLLM(BaseModel):
    """
    An ingredient as returned by GPT-4o in the meal plan.
    Only name/quantity/unit are required — LLM nutrition fields are optional
    because the simplified prompt no longer asks GPT to estimate per-ingredient values.
    USDA validation in Stage 3 replaces all nutritional estimates anyway.
    """
    name:            str
    quantity:        float = 100.0
    unit:            str   = "g"
    llm_calories:    Optional[float] = None
    llm_protein_g:   Optional[float] = None
    llm_carbs_g:     Optional[float] = None
    llm_fat_g:       Optional[float] = None


class MealLLM(BaseModel):
    """A single meal as returned by GPT-4o."""
    name:                 str
    day_number:           int    # 1 = Monday … 7 = Sunday
    meal_type:            str    # BREAKFAST | LUNCH | DINNER | SNACK
    description:          Optional[str] = None   # brief cooking instructions
    ingredients:          list[MealIngredientLLM]
    llm_total_calories:   Optional[float] = None
    llm_total_protein_g:  Optional[float] = None
    llm_total_carbs_g:    Optional[float] = None
    llm_total_fat_g:      Optional[float] = None


class MealPlanLLM(BaseModel):
    """The full 7-day plan as returned by GPT-4o."""
    meals: list[MealLLM]


# ── Stage 3: USDA validation ──────────────────────────────────────────────────

class USDANutrients(BaseModel):
    """Per-100g USDA nutritional values for one ingredient."""
    calories:    float = 0.0
    protein_g:   float = 0.0
    carbs_g:     float = 0.0
    fat_g:       float = 0.0
    usda_fdc_id: Optional[str] = None


class USDAContribution(BaseModel):
    """Actual nutritional contribution for a given quantity of an ingredient."""
    calories:    float = 0.0
    protein_g:   float = 0.0
    carbs_g:     float = 0.0
    fat_g:       float = 0.0
    usda_fdc_id: Optional[str] = None


# ── Validated output ──────────────────────────────────────────────────────────

class ValidatedIngredient(BaseModel):
    name:          str
    quantity:      float
    unit:          str
    llm_calories:  Optional[float] = None
    llm_protein_g: Optional[float] = None
    usda_calories: Optional[float] = None
    usda_protein_g:Optional[float] = None
    usda_carbs_g:  Optional[float] = None
    usda_fat_g:    Optional[float] = None
    usda_fdc_id:   Optional[str]   = None
    usda_matched:  bool            = False


class ValidatedMeal(BaseModel):
    name:                  str
    day_number:            int
    meal_type:             str
    description:           Optional[str] = None
    ingredients:           list[ValidatedIngredient]
    llm_total_calories:    Optional[float] = None
    llm_total_protein_g:   Optional[float] = None
    usda_total_calories:   float = 0.0
    usda_total_protein_g:  float = 0.0
    usda_total_carbs_g:    float = 0.0
    usda_total_fat_g:      float = 0.0


class ValidationWarning(BaseModel):
    """Flagged when the generated plan deviates significantly from the user's target."""
    day_number:      int
    actual_calories: float
    target_calories: float
    deviation_pct:   float


class ValidatedMealPlan(BaseModel):
    meals:                 list[ValidatedMeal]
    goal:                  str
    calorie_target:        Optional[int]          = None
    restrictions:          list[str]              = []
    allergies:             list[str]              = []
    unmatched_ingredients: list[str]              = []
    validation_warnings:   list[ValidationWarning] = []


# ── API response wrappers ─────────────────────────────────────────────────────

class ParseResponse(BaseModel):
    success: bool
    data:    ParsedInput


class GeneratePlanResponse(BaseModel):
    success: bool
    data:    ValidatedMealPlan


class ErrorResponse(BaseModel):
    success: bool  = False
    message: str