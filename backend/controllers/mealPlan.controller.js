import prisma from "../lib/prisma.js";
import { generateMealPlan } from "../lib/aiService.js";

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
    console.log("AI result keys:", Object.keys(aiResult || {}));
    console.log("plan keys:", Object.keys(aiResult?.data || {}));
    console.log("meals count:", aiResult?.data?.meals?.length);

    const plan = aiResult.data;

    const saved = await prisma.mealPlan.create({
      data: {
        userId:        req.user.id,
        goal:          plan.goal          || "general",
        calorieTarget: plan.calorie_target || 2000,
        restrictions:  plan.restrictions  || [],
        rawInput:      text.trim(),
        meals: {
          create: plan.meals.map((meal) => ({
            dayNumber:     meal.day_number,
            mealType:      meal.meal_type,
            name:          meal.name,
            description:   meal.description || null,
            totalCalories: meal.usda_total_calories  || 0,
            totalProteinG: meal.usda_total_protein_g || 0,
            totalCarbsG:   meal.usda_total_carbs_g   || 0,
            totalFatG:     meal.usda_total_fat_g     || 0,
            llmCalories:   meal.llm_total_calories,
            llmProteinG:   meal.llm_total_protein_g,
            ingredients: {
              create: meal.ingredients.map((ing) => ({
                quantity:     ing.quantity,
                unit:         ing.unit,
                usdaCalories: ing.usda_calories,
                usdaProteinG: ing.usda_protein_g,
                usdaCarbsG:   ing.usda_carbs_g,
                usdaFatG:     ing.usda_fat_g,
                ingredient: {
                  connectOrCreate: {
                    where:  { name: ing.name.toLowerCase().trim() },
                    create: { name: ing.name.toLowerCase().trim() },
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
          orderBy: [{ dayNumber: "asc" }, { mealType: "asc" }],
        },
      },
    });

    res.status(201).json({
      mealPlan: saved,
      warnings:  plan.validation_warnings   || [],
      unmatched: plan.unmatched_ingredients || [],
    });
  } catch (error) {
    console.error("generate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserPlans = async (req, res) => {
  try {
    const plans = await prisma.mealPlan.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    10,
      include: {
        meals: {
          orderBy: [{ dayNumber: "asc" }, { mealType: "asc" }],
          select: { id: true, dayNumber: true, mealType: true, name: true, totalCalories: true },
        },
      },
    });
    res.json({ plans });
  } catch (error) {
    console.error("getUserPlans error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const plan = await prisma.mealPlan.findFirst({
      where:   { id: parseInt(req.params.id), userId: req.user.id },
      include: {
        meals: {
          include: { ingredients: { include: { ingredient: true } } },
          orderBy: [{ dayNumber: "asc" }, { mealType: "asc" }],
        },
      },
    });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ plan });
  } catch (error) {
    console.error("getPlanById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deletePlan = async (req, res) => {
  try {
    await prisma.mealPlan.deleteMany({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    res.json({ message: "Plan deleted" });
  } catch (error) {
    console.error("deletePlan error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/meal-plans/swap ──────────────────────────────────
// Swap a single meal via the Python AI microservice.
export const swapMeal = async (req, res) => {
  try {
    const { mealId, mealPlanId, prompt } = req.body;

    const meal = await prisma.meal.findFirst({
      where: { id: parseInt(mealId), mealPlanId: parseInt(mealPlanId) },
      include: { mealPlan: { select: { userId: true, calorieTarget: true } } },
    });
    if (!meal)                                return res.status(404).json({ message: "Meal not found" });
    if (meal.mealPlan.userId !== req.user.id) return res.status(403).json({ message: "Not your plan" });

    // Route through the AI microservice — backend has no openai package
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

    // Update the meal record
    const updated = await prisma.meal.update({
      where: { id: meal.id },
      data: {
        name:          data.name,
        description:   data.description || null,
        totalCalories: data.llm_total_calories   || 0,
        totalProteinG: data.llm_total_protein_g  || 0,
        totalCarbsG:   data.llm_total_carbs_g    || 0,
        totalFatG:     data.llm_total_fat_g      || 0,
        ingredients: {
          deleteMany: {},  // remove old ingredients
          create: (data.ingredients || []).map(ing => ({
            quantity:     ing.quantity,
            unit:         ing.unit,
            usdaCalories: ing.llm_calories    || null,
            usdaProteinG: ing.llm_protein_g   || null,
            usdaCarbsG:   ing.llm_carbs_g     || null,
            usdaFatG:     ing.llm_fat_g       || null,
            ingredient: {
              connectOrCreate: {
                where:  { name: ing.name.toLowerCase().trim() },
                create: { name: ing.name.toLowerCase().trim() },
              },
            },
          })),
        },
      },
      include: { ingredients: { include: { ingredient: true } } },
    });

    res.json({ meal: updated });
  } catch (error) {
    console.error("swapMeal error:", error);
    res.status(500).json({ message: "Server error", detail: error.message });
  }
};