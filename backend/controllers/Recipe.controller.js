import prisma from "../lib/prisma.js";

// ── Built-in nutrition table (per 100g) ──────────────────────
// Same data as the AI service — kept here so Node.js can calculate
// recipe macros without calling the Python service.
const NUTRITION_TABLE = {
  "egg":            [147, 12.6, 0.7,  10.0],
  "eggs":           [147, 12.6, 0.7,  10.0],
  "chicken breast": [165, 31.0, 0.0,   3.6],
  "chicken":        [165, 31.0, 0.0,   3.6],
  "beef":           [250, 26.0, 0.0,  17.0],
  "ground beef":    [254, 17.2, 0.0,  20.0],
  "salmon":         [208, 20.4, 0.0,  13.4],
  "tuna":           [132, 28.0, 0.0,   1.0],
  "shrimp":         [ 99, 24.0, 0.0,   0.3],
  "white rice":     [130,  2.7, 28.6,  0.3],
  "brown rice":     [123,  2.7, 25.6,  1.0],
  "rice":           [130,  2.7, 28.6,  0.3],
  "pasta":          [131,  5.0, 25.0,  1.1],
  "oats":           [389, 16.9, 66.3,  6.9],
  "bread":          [265,  9.0, 49.0,  3.2],
  "potato":         [ 77,  2.0, 17.5,  0.1],
  "sweet potato":   [ 86,  1.6, 20.1,  0.1],
  "quinoa":         [120,  4.4, 21.3,  1.9],
  "lentils":        [116,  9.0, 20.1,  0.4],
  "chickpeas":      [164,  8.9, 27.4,  2.6],
  "spinach":        [ 23,  2.9,  3.6,  0.4],
  "broccoli":       [ 34,  2.8,  6.6,  0.4],
  "carrot":         [ 41,  0.9,  9.6,  0.2],
  "tomato":         [ 18,  0.9,  3.9,  0.2],
  "onion":          [ 40,  1.1,  9.3,  0.1],
  "garlic":         [149,  6.4, 33.1,  0.5],
  "mushroom":       [ 22,  3.1,  3.3,  0.3],
  "avocado":        [160,  2.0,  9.0, 15.0],
  "banana":         [ 89,  1.1, 23.0,  0.3],
  "apple":          [ 52,  0.3, 14.0,  0.2],
  "milk":           [ 61,  3.2,  4.8,  3.3],
  "cheese":         [402, 25.0,  1.3, 33.0],
  "yogurt":         [ 61,  3.5,  4.7,  3.3],
  "butter":         [717,  0.9,  0.1, 81.1],
  "olive oil":      [884,  0.0,  0.0, 100.0],
  "almonds":        [579, 21.2, 21.6, 49.9],
  "peanut butter":  [588, 25.1, 20.1, 50.4],
  "honey":          [304,  0.3, 82.4,  0.0],
  "flour":          [364, 10.3, 76.3,  1.0],
  "sugar":          [387,  0.0, 100.0, 0.0],
  "cucumber":       [ 16,  0.7,  3.6,  0.1],
  "lettuce":        [ 15,  1.4,  2.9,  0.2],
  "pepper":         [ 31,  1.0,  6.0,  0.3],
  "corn":           [ 86,  3.3, 19.0,  1.4],
  "peas":           [ 81,  5.4, 14.5,  0.4],
  "tofu":           [ 76,  8.1,  1.9,  4.8],
  "hummus":         [177,  4.9, 14.3, 10.4],
  "couscous":       [112,  3.8, 23.2,  0.2],
  "turkey":         [189, 29.0,  0.0,  7.4],
  "lamb":           [294, 25.6,  0.0, 20.8],
};

// UNIT_TO_GRAMS — standard conversions
const UNIT_TO_GRAMS = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000,
  ml: 1, milliliter: 1, millilitre: 1,
  l: 1000, liter: 1000, litre: 1000,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  cup: 240, cups: 240,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, pound: 453.6, pounds: 453.6,
};

// COUNTABLE_WEIGHTS — grams per single unit for countable foods
const COUNTABLE_WEIGHTS = {
  "egg": 55, "eggs": 55, "banana": 120, "apple": 182,
  "potato": 150, "sweet potato": 130, "tomato": 123,
  "onion": 110, "garlic": 5, "clove": 5,
  "bread": 30, "slice": 30, "tortilla": 45,
  "chicken breast": 174, "salmon": 150, "avocado": 150,
};

/**
 * Calculate macros for a single ingredient entry.
 * Returns { calories, proteinG, carbsG, fatG } or null if ingredient unknown.
 */
function calcIngredientMacros(name, quantity, unit) {
  const nameLower = (name || "").toLowerCase().trim();
  const unitLower = (unit || "g").toLowerCase().trim();

  // Convert quantity to grams
  let grams;
  if (UNIT_TO_GRAMS[unitLower] !== undefined) {
    grams = quantity * UNIT_TO_GRAMS[unitLower];
  } else {
    // Countable unit — look up food-specific weight
    const match = Object.entries(COUNTABLE_WEIGHTS)
      .filter(([k]) => nameLower.includes(k))
      .sort((a, b) => b[0].length - a[0].length)[0];
    grams = match ? quantity * match[1] : quantity * 100;
  }

  // Find best matching entry in nutrition table (longest match wins)
  const entries = Object.entries(NUTRITION_TABLE)
    .filter(([k]) => nameLower.includes(k))
    .sort((a, b) => b[0].length - a[0].length);

  if (!entries.length) return null;

  const [, [cal, pro, carb, fat]] = entries[0];
  const ratio = grams / 100;
  return {
    calories: Math.round(cal * ratio * 10) / 10,
    proteinG: Math.round(pro * ratio * 10) / 10,
    carbsG:   Math.round(carb * ratio * 10) / 10,
    fatG:     Math.round(fat * ratio * 10) / 10,
  };
}

/**
 * Given a list of ingredient objects { name, quantity, unit },
 * return total macros per serving.
 */
function calculateRecipeMacros(ingredients) {
  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
  let matched = 0;
  let hasManual = false;

  for (const ing of ingredients) {
    // Try built-in table first
    const macros = calcIngredientMacros(ing.name, ing.quantity, ing.unit);
    if (macros) {
      totalCal  += macros.calories;
      totalPro  += macros.proteinG;
      totalCarb += macros.carbsG;
      totalFat  += macros.fatG;
      matched++;
    } else if (ing.manualCalories != null) {
      // Fall back to author-supplied manual values (per 100g × quantity in grams)
      const grams = parseFloat(ing.quantity) || 0;
      const ratio = grams / 100;
      totalCal  += (ing.manualCalories || 0) * ratio;
      totalPro  += (ing.manualProtein  || 0) * ratio;
      totalCarb += (ing.manualCarbs    || 0) * ratio;
      totalFat  += (ing.manualFat      || 0) * ratio;
      matched++;
      hasManual = true;
    }
  }

  if (matched === 0) return null;

  return {
    caloriesPerServing: Math.round(totalCal),
    proteinPerServing:  Math.round(totalPro  * 10) / 10,
    carbsPerServing:    Math.round(totalCarb * 10) / 10,
    fatPerServing:      Math.round(totalFat  * 10) / 10,
    hasManualEntries:   hasManual,  // flag so UI can show different label
  };
}
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "nutrihub/recipes" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const createRecipe = async (req, res) => {
  try {
    const { title, description, prepTime, cookTime, difficulty, cuisine, ingredients, steps, tags } = req.body;

    if (!title || !description || !ingredients || !steps)
      return res.status(400).json({ message: "Title, description, ingredients and steps are required" });

    const parsedIngredients = JSON.parse(ingredients);
    const parsedSteps       = JSON.parse(steps);
    const parsedTags        = tags ? JSON.parse(tags) : [];

    let imageURL = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageURL = result.secure_url;
    }

    const recipe = await prisma.recipe.create({
      data: {
        title,
        description,
        imageURL,
        prepTime:   prepTime   ? parseInt(prepTime)   : null,
        cookTime:   cookTime   ? parseInt(cookTime)   : null,
        difficulty: difficulty || "EASY",
        cuisine:    cuisine    || null,
        userId:     req.user.id,
        // Auto-calculate macros from ingredients using the built-in nutrition table.
        // Manual entries (if provided) take precedence over auto-calculated values.
        ...(() => {
          if (req.body.caloriesPerServing) {
            // User manually entered macros — use those
            return {
              caloriesPerServing: parseFloat(req.body.caloriesPerServing) || null,
              proteinPerServing:  parseFloat(req.body.proteinPerServing)  || null,
              carbsPerServing:    parseFloat(req.body.carbsPerServing)    || null,
              fatPerServing:      parseFloat(req.body.fatPerServing)      || null,
            };
          }
          // Auto-calculate from ingredient list
          const ingredientList = Array.isArray(parsedIngredients)
            ? parsedIngredients.map(i => ({
                name:           typeof i === "string" ? i : (i.name || ""),
                quantity:       parseFloat(i.quantity) || 100,
                unit:           i.unit || "g",
                manualCalories: i.manualCalories != null ? parseFloat(i.manualCalories) : null,
                manualProtein:  i.manualProtein  != null ? parseFloat(i.manualProtein)  : null,
                manualCarbs:    i.manualCarbs    != null ? parseFloat(i.manualCarbs)    : null,
                manualFat:      i.manualFat      != null ? parseFloat(i.manualFat)      : null,
              }))
            : [];
          const autoMacros = calculateRecipeMacros(ingredientList);
          if (!autoMacros) return {};
          const { hasManualEntries, ...macroFields } = autoMacros;
          return { ...macroFields, hasManualEntries: hasManualEntries || false };
        })(),
        steps:       { create: parsedSteps.map((s) => ({ stepNumber: s.stepNumber, instruction: s.instruction })) },
        tags:        { create: parsedTags.map((tag) => ({ tag })) },
        ingredients: {
          create: await Promise.all(
            parsedIngredients.map(async (ing) => {
              const ingredient = await prisma.ingredient.upsert({
                where:  { name: ing.name.toLowerCase().trim() },
                update: {},
                create: { name: ing.name.toLowerCase().trim() },
              });
              return {
                ingredientId:    ingredient.id,
                quantity:        parseFloat(ing.quantity),
                unit:            ing.unit,
                // Store manual macros if provided — recipe-scoped only, never shared
                ...(ing.manualCalories != null && { manualCalories: parseFloat(ing.manualCalories) }),
                ...(ing.manualProtein  != null && { manualProtein:  parseFloat(ing.manualProtein)  }),
                ...(ing.manualCarbs    != null && { manualCarbs:    parseFloat(ing.manualCarbs)    }),
                ...(ing.manualFat      != null && { manualFat:      parseFloat(ing.manualFat)      }),
              };
            })
          ),
        },
      },
      include: {
        user:        { select: { id: true, name: true, avatarURL: true, role: true } },
        ingredients: { include: { ingredient: true } },
        steps:       { orderBy: { stepNumber: "asc" } },
        tags:        true,
        _count:      { select: { likes: true, comments: true, saves: true } },
      },
    });

    res.status(201).json(recipe);
  } catch (error) {
    console.error("createRecipe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getRecipes = async (req, res) => {
  try {
    const { sort = "recent", cuisine, tag, search, feed, page = 1, limit = 12 } = req.query;

    // ── "For You" feed — recipes from users the current user follows ──
    if (feed === "following" && req.user) {
      const follows = await prisma.follow.findMany({
        where:  { followerId: req.user.id },
        select: { followingId: true },
      });
      const followingIds = follows.map(f => f.followingId);
      if (followingIds.length === 0) {
        return res.json({ recipes: [], pagination: { total: 0, page: 1, limit: 12, totalPages: 0 } });
      }
      const skip  = (parseInt(page) - 1) * parseInt(limit);
      const take  = parseInt(limit);
      let where = { isPublished: true, userId: { in: followingIds } };
      // Also include cuisine-based discovery for the user's preferred cuisines
      const userProfile = await prisma.user.findUnique({
        where:  { id: req.user.id },
        select: { cuisinePrefs: true },
      });
      const cuisinePrefs = userProfile?.cuisinePrefs || [];

      // For You = followed users' recipes + cuisine preference recipes (deduped)
      if (cuisinePrefs.length > 0) {
        where = {
          isPublished: true,
          OR: [
            { userId: { in: followingIds } },
            { cuisine: { in: cuisinePrefs, mode: "insensitive" } },
          ],
        };
      }

      const followingRecipes = await prisma.recipe.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          user:   { select: { id: true, name: true, avatarURL: true, role: true } },
          tags:   true,
          _count: { select: { likes: true, comments: true, saves: true } },
        },
        skip,
        take,
      });
      const total = await prisma.recipe.count({ where });
      return res.json({
        recipes: followingRecipes,
        pagination: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) },
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // ── Search filter — checks title, description, cuisine, and tags ──
    const searchFilter = search
      ? {
          OR: [
            { title:       { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { cuisine:     { contains: search, mode: "insensitive" } },
            { tags: { some: { tag: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {};

    const where = {
      isPublished: true,
      ...searchFilter,
      ...(cuisine && { cuisine: { equals: cuisine, mode: "insensitive" } }),
      ...(tag     && { tags: { some: { tag: { equals: tag, mode: "insensitive" } } } }),
    };

    const include = {
      user:   { select: { id: true, name: true, avatarURL: true, role: true } },
      tags:   true,
      _count: { select: { likes: true, comments: true, saves: true } },
    };

    let recipes;

    if (sort === "popular") {
      recipes = await prisma.recipe.findMany({ where, include, skip, take });
      recipes.sort((a, b) => b._count.likes - a._count.likes);

    } else if (sort === "trending") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      recipes = await prisma.recipe.findMany({
        where: { ...where, likes: { some: { createdAt: { gte: sevenDaysAgo } } } },
        include, skip, take,
      });

    } else {
      recipes = await prisma.recipe.findMany({ where, orderBy: { createdAt: "desc" }, include, skip, take });
    }

    const total = await prisma.recipe.count({ where });

    res.json({
      recipes,
      pagination: { total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    console.error("getRecipes error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getRecipeById = async (req, res) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user:        { select: { id: true, name: true, avatarURL: true, role: true, specialisation: true } },
        ingredients: { include: { ingredient: true } },
        steps:       { orderBy: { stepNumber: "asc" } },
        tags:        true,
        comments: {
          include: { user: { select: { id: true, name: true, avatarURL: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: { select: { likes: true, comments: true, saves: true } },
      },
    });

    if (!recipe || !recipe.isPublished)
      return res.status(404).json({ message: "Recipe not found" });

    // Check if the current user has liked or saved this recipe
    let isLiked = false;
    let isSaved = false;
    if (req.user) {
      const [like, save] = await Promise.all([
        prisma.like.findUnique({
          where: { userId_recipeId: { userId: req.user.id, recipeId: recipe.id } },
        }),
        prisma.save.findUnique({
          where: { userId_recipeId: { userId: req.user.id, recipeId: recipe.id } },
        }),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    // Related recipes — same cuisine or shared tag, exclude current
    const relatedRecipes = await prisma.recipe.findMany({
      where: {
        isPublished: true,
        id: { not: recipe.id },
        OR: [
          ...(recipe.cuisine ? [{ cuisine: recipe.cuisine }] : []),
          ...(recipe.tags.length > 0
            ? [{ tags: { some: { tag: { in: recipe.tags.map((t) => t.tag) } } } }]
            : []),
        ],
      },
      include: {
        tags:   true,
        _count: { select: { likes: true, comments: true, saves: true } },
      },
      take: 3,
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...recipe, relatedRecipes, isLiked, isSaved });
  } catch (error) {
    console.error("getRecipeById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateRecipe = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.id);

    const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!existing)
      return res.status(404).json({ message: "Recipe not found" });

    if (existing.userId !== req.user.id)
      return res.status(403).json({ message: "Not authorised to edit this recipe" });

    const { title, description, prepTime, cookTime, difficulty, cuisine, isPublished } = req.body;

    let imageURL = existing.imageURL;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageURL = result.secure_url;
    }

    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        ...(title       !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(prepTime    !== undefined && { prepTime: parseInt(prepTime) }),
        ...(cookTime    !== undefined && { cookTime: parseInt(cookTime) }),
        ...(difficulty  !== undefined && { difficulty }),
        ...(cuisine     !== undefined && { cuisine }),
        ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        ...(req.body.caloriesPerServing !== undefined && { caloriesPerServing: req.body.caloriesPerServing ? parseFloat(req.body.caloriesPerServing) : null }),
        ...(req.body.proteinPerServing  !== undefined && { proteinPerServing:  req.body.proteinPerServing  ? parseFloat(req.body.proteinPerServing)  : null }),
        ...(req.body.carbsPerServing    !== undefined && { carbsPerServing:    req.body.carbsPerServing    ? parseFloat(req.body.carbsPerServing)    : null }),
        ...(req.body.fatPerServing      !== undefined && { fatPerServing:      req.body.fatPerServing      ? parseFloat(req.body.fatPerServing)      : null }),
        imageURL,
      },
      include: {
        user:        { select: { id: true, name: true, avatarURL: true } },
        ingredients: { include: { ingredient: true } },
        steps:       { orderBy: { stepNumber: "asc" } },
        tags:        true,
        _count:      { select: { likes: true, comments: true, saves: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("updateRecipe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteRecipe = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.id);
    const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!existing) return res.status(404).json({ message: "Recipe not found" });

    const isOwner = existing.userId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: "Not authorised to delete this recipe" });

    await prisma.recipe.delete({ where: { id: recipeId } });
    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    console.error("deleteRecipe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserRecipes = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recipes = await prisma.recipe.findMany({
      where:   { userId, isPublished: true },
      orderBy: { createdAt: "desc" },
      include: { tags: true, _count: { select: { likes: true, comments: true, saves: true } } },
      skip,
      take: parseInt(limit),
    });

    const total = await prisma.recipe.count({ where: { userId, isPublished: true } });

    res.json({ recipes, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error("getUserRecipes error:", error);
    res.status(500).json({ message: "Server error" });
  }
};