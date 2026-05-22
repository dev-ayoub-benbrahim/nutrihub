import prisma from "../lib/prisma.js";
import { generateMealPlan } from "../lib/aiService.js";

// ── POST /api/meal-plans/generate ─────────────────────────────
// Generates a single day plan (BREAKFAST, LUNCH, DINNER).
export const generate = async (req, res) => {
  try {
    const { text, allergies = [] } = req.body;
    if (!text || text.trim().length < 5)
      return res.status(400).json({ message: "Please describe your meal plan goal" });

    let aiResult;
    try {
      aiResult = await generateMealPlan(text.trim(), allergies);
    } catch (err) {
      console.error("AI service call failed:", err.message);
      return res.status(503).json({
        message: "AI service is unavailable. Make sure the Python service is running.",
        detail:  err.message,
      });
    }

    const plan = aiResult?.data;
    if (!plan || !Array.isArray(plan.meals) || plan.meals.length === 0) {
      return res.status(502).json({ message: "AI service returned an empty plan. Please try again." });
    }

    const saved = await prisma.mealPlan.create({
      data: {
        userId:        req.user.id,
        goal:          plan.goal           || text.trim(),
        calorieTarget: plan.calorie_target  || 2000,
        restrictions:  plan.restrictions   || [],
        rawInput:      text.trim(),
        meals: {
          create: plan.meals.map((meal) => ({
            dayNumber:     1,
            mealType:      meal.meal_type,
            name:          meal.name,
            description:   meal.description || null,
            totalCalories: meal.usda_total_calories  || 0,
            totalProteinG: meal.usda_total_protein_g || 0,
            totalCarbsG:   meal.usda_total_carbs_g   || 0,
            totalFatG:     meal.usda_total_fat_g     || 0,
            llmCalories:   meal.llm_total_calories   || 0,
            llmProteinG:   meal.llm_total_protein_g  || 0,
            ingredients: {
              create: (meal.ingredients || []).map((ing) => ({
                quantity:     ing.quantity || 0,
                unit:         ing.unit     || "g",
                usdaCalories: ing.usda_calories  || null,
                usdaProteinG: ing.usda_protein_g || null,
                usdaCarbsG:   ing.usda_carbs_g   || null,
                usdaFatG:     ing.usda_fat_g     || null,
                ingredient: {
                  connectOrCreate: {
                    where:  { name: (ing.name || "unknown").toLowerCase().trim() },
                    create: { name: (ing.name || "unknown").toLowerCase().trim() },
                  },
                },
              })),
            },
          })),
        },
      },
      include: {
        meals: {
          include: { ingredients: { include: { ingredient: true } } },
        },
      },
    });

    return res.json({
      success: true,
      plan:    saved,
      warnings: aiResult?.data?.validation_warnings || [],
    });
  } catch (err) {
    console.error("generate error:", err);
    return res.status(500).json({ message: "Server error", detail: err.message });
  }
};

// ── GET /api/meal-plans ─────────────────────────────────────────
// Returns the user's plan history (most recent first).
export const getUserPlans = async (req, res) => {
  try {
    const plans = await prisma.mealPlan.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    14,
      include: {
        meals: {
          include: { ingredients: { include: { ingredient: true } } },
        },
      },
    });
    return res.json({ plans });
  } catch (err) {
    console.error("getUserPlans error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/meal-plans/:id ─────────────────────────────────────
export const getPlanById = async (req, res) => {
  try {
    const plan = await prisma.mealPlan.findFirst({
      where:   { id: parseInt(req.params.id), userId: req.user.id },
      include: { meals: { include: { ingredients: { include: { ingredient: true } } } } },
    });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    return res.json({ plan });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/meal-plans/:id ──────────────────────────────────
export const deletePlan = async (req, res) => {
  try {
    const plan = await prisma.mealPlan.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    await prisma.mealPlan.delete({ where: { id: plan.id } });
    return res.json({ message: "Plan deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/meal-plans/swap ───────────────────────────────────
// Swaps a single meal via the AI microservice.
export const swapMeal = async (req, res) => {
  try {
    const { mealId, mealPlanId, prompt } = req.body;

    const meal = await prisma.meal.findFirst({
      where:   { id: parseInt(mealId), mealPlanId: parseInt(mealPlanId) },
      include: { mealPlan: { select: { userId: true, calorieTarget: true } } },
    });
    if (!meal)                                return res.status(404).json({ message: "Meal not found" });
    if (meal.mealPlan.userId !== req.user.id) return res.status(403).json({ message: "Not your plan" });

    const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const aiRes  = await fetch(`${AI_URL}/ai/swap-meal`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ prompt, meal_type: meal.mealType }),
      signal:  AbortSignal.timeout(30000),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      return res.status(502).json({ message: err.detail || "AI service error" });
    }

    const data = await aiRes.json();

    // Delete old ingredients and update the meal
    await prisma.mealIngredient.deleteMany({ where: { mealId: meal.id } });

    const updated = await prisma.meal.update({
      where: { id: meal.id },
      data: {
        name:          data.name          || meal.name,
        description:   data.description   || null,
        totalCalories: data.usda_total_calories  || data.llm_total_calories  || 0,
        totalProteinG: data.usda_total_protein_g || data.llm_total_protein_g || 0,
        llmCalories:   data.llm_total_calories   || 0,
        llmProteinG:   data.llm_total_protein_g  || 0,
        ingredients: {
          create: (data.ingredients || []).map((ing) => ({
            quantity:     ing.quantity || 0,
            unit:         ing.unit     || "g",
            usdaCalories: ing.usda_calories  || null,
            usdaProteinG: ing.usda_protein_g || null,
            ingredient: {
              connectOrCreate: {
                where:  { name: (ing.name || "unknown").toLowerCase().trim() },
                create: { name: (ing.name || "unknown").toLowerCase().trim() },
              },
            },
          })),
        },
      },
      include: { ingredients: { include: { ingredient: true } } },
    });

    return res.json({ success: true, meal: updated });
  } catch (err) {
    console.error("swapMeal error:", err);
    return res.status(500).json({ message: "Server error", detail: err.message });
  }
};