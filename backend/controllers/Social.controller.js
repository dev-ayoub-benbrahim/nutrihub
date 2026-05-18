import prisma from "../lib/prisma.js";
import { createNotification } from "./notification.controller.js";

export const likeRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });

  try {
    await prisma.like.create({
      data: { userId: req.user.id, recipeId },
    });

    const likeCount = await prisma.like.count({ where: { recipeId } });

    // Notify recipe owner (unless they liked their own recipe)
    if (recipe.userId !== req.user.id) {
      const liker = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      await createNotification(prisma, {
        userId:  recipe.userId,
        type:    "like",
        message: `${liker.name} liked your recipe "${recipe.title}"`,
        link:    `/recipes/${recipeId}`,
      });
    }

    res.status(201).json({ message: "Recipe liked", likeCount });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "You have already liked this recipe" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const unlikeRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);

  const { count } = await prisma.like.deleteMany({
    where: { userId: req.user.id, recipeId },
  });

  if (count === 0) {
    return res.status(404).json({ message: "You have not liked this recipe" });
  }

  const likeCount = await prisma.like.count({ where: { recipeId } });
  res.status(200).json({ message: "Recipe unliked", likeCount });
};

export const getRecipeLikes = async (req, res) => {
  const recipeId = parseInt(req.params.id);

  const likes = await prisma.like.findMany({
    where: { recipeId },
    select: {
      user: {
        select: { id: true, name: true, avatarURL: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    likeCount: likes.length,
    likedBy: likes.map((l) => l.user),
  });
};

export const saveRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });

  try {
    await prisma.save.create({
      data: { userId: req.user.id, recipeId },
    });
    res.status(201).json({ message: "Recipe saved" });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Recipe already saved" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const unsaveRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);

  const { count } = await prisma.save.deleteMany({
    where: { userId: req.user.id, recipeId },
  });

  if (count === 0) {
    return res.status(404).json({ message: "Recipe not in your saved collection" });
  }

  res.status(200).json({ message: "Recipe removed from saved" });
};

export const getUserSaves = async (req, res) => {
  const userId = parseInt(req.params.id);

  const saves = await prisma.save.findMany({
    where: { userId },
    select: {
      createdAt: true,           // FIX: schema uses createdAt, not savedAt
      recipe: {
        select: {
          id:       true,
          title:    true,
          imageURL: true,
          cookTime: true,
          tags:     { select: { tag: true } },
          _count:   { select: { likes: true, comments: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" }, // FIX: createdAt not savedAt
  });

  res.status(200).json({
    count: saves.length,
    saves: saves.map((s) => ({ ...s.recipe, savedAt: s.createdAt })), // FIX: s.createdAt not s.savedAt
  });
};

export const addComment = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  if (content.trim().length > 500) {
    return res.status(400).json({ message: "Comment must be 500 characters or fewer" });
  }

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });

  const comment = await prisma.comment.create({
    data: {
      content:  content.trim(),
      userId:   req.user.id,
      recipeId,
    },
    select: {
      id:        true,
      content:   true,
      createdAt: true,
      user: { select: { id: true, name: true, avatarURL: true } },
    },
  });

  // Notify recipe owner (unless they commented on their own)
  if (recipe.userId !== req.user.id) {
    await createNotification(prisma, {
      userId:  recipe.userId,
      type:    "comment",
      message: `${req.user.name} commented on your recipe "${recipe.title}"`,
      link:    `/recipes/${recipeId}`,
    });
  }

  // Notify other users who have previously commented on this recipe
  // (excluding the current commenter and the recipe owner who was already notified)
  const priorCommenters = await prisma.comment.findMany({
    where: {
      recipeId,
      userId: {
        not:    req.user.id,
        notIn:  [recipe.userId], // owner already notified above
      },
    },
    select:  { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of priorCommenters) {
    await createNotification(prisma, {
      userId,
      type:    "comment",
      message: `${req.user.name} also commented on "${recipe.title}"`,
      link:    `/recipes/${recipeId}`,
    });
  }

  res.status(201).json({ message: "Comment posted", comment });
};

export const deleteComment = async (req, res) => {
  const commentId = parseInt(req.params.commentId);

  const comment = await prisma.comment.findUnique({
    where:  { id: commentId },
    select: { id: true, userId: true },
  });

  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const isOwner = comment.userId === req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: "You cannot delete this comment" });
  }

  await prisma.comment.delete({ where: { id: commentId } });
  res.status(200).json({ message: "Comment deleted" });
};

export const followUser = async (req, res) => {
  const followingId = parseInt(req.params.id);
  const followerId  = req.user.id;

  if (followerId === followingId) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  const userToFollow = await prisma.user.findUnique({ where: { id: followingId } });
  if (!userToFollow) return res.status(404).json({ message: "User not found" });

  try {
    await prisma.follow.create({
      data: { followerId, followingId },
    });

    // Notify the followed user
    await createNotification(prisma, {
      userId:  followingId,
      type:    "follow",
      message: `${req.user.name} started following you`,
      link:    `/users/${req.user.id}`,
    });

    res.status(201).json({ message: `You are now following ${userToFollow.name}` });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "You are already following this user" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const unfollowUser = async (req, res) => {
  const followingId = parseInt(req.params.id);
  const followerId  = req.user.id;

  const { count } = await prisma.follow.deleteMany({
    where: { followerId, followingId },
  });

  if (count === 0) {
    return res.status(404).json({ message: "You are not following this user" });
  }

  res.status(200).json({ message: "Unfollowed successfully" });
};

export const getFollowers = async (req, res) => {
  const userId = parseInt(req.params.id);

  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    select: {
      follower: {
        select: { id: true, name: true, avatarURL: true, bio: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    followerCount: follows.length,
    followers:     follows.map((f) => f.follower),
  });
};

export const getFollowing = async (req, res) => {
  const userId = parseInt(req.params.id);

  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: {
      following: {
        select: { id: true, name: true, avatarURL: true, bio: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    followingCount: follows.length,
    following:      follows.map((f) => f.following),
  });
};

// ── POST /api/social/meals/:mealId/log ───────────────────────
// Log a meal from a meal plan as eaten today.
export const logMeal = async (req, res) => {
  try {
    const mealId = parseInt(req.params.mealId);

    const meal = await prisma.meal.findUnique({
      where:   { id: mealId },
      include: { mealPlan: { select: { id: true, userId: true } } },
    });
    if (!meal) return res.status(404).json({ message: "Meal not found" });
    if (meal.mealPlan.userId !== req.user.id)
      return res.status(403).json({ message: "Not your meal plan" });

    // @@unique([userId, mealId]) prevents duplicates at DB level
    // upsert so re-tapping the checkbox never throws an error
    const log = await prisma.mealLog.upsert({
      where:  { userId_mealId: { userId: req.user.id, mealId } },
      update: { loggedAt: new Date() }, // refresh timestamp if already logged
      create: {
        userId:     req.user.id,
        mealId,
        mealPlanId: meal.mealPlan.id,
        dayNumber:  meal.dayNumber,
        calories:   meal.totalCalories || 0,
        proteinG:   meal.totalProteinG || 0,
        carbsG:     meal.totalCarbsG   || 0,
        fatG:       meal.totalFatG     || 0,
      },
    });

    res.status(201).json({ message: "Meal logged", log });
  } catch (error) {
    console.error("logMeal error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/social/nutrition/today ──────────────────────────
// Returns nutrition summary for the most recently active plan day.
// "Active day" = the day with the most recent log entry.
// Each day is self-contained — logging Day 2 never adds to Day 1.
export const getTodayNutrition = async (req, res) => {
  try {
    // Find the most recently logged day across all plans
    const latestLog = await prisma.mealLog.findFirst({
      where:   { userId: req.user.id },
      orderBy: { loggedAt: "desc" },
      select:  { mealPlanId: true, dayNumber: true },
    });

    if (!latestLog) {
      return res.json({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, mealCount: 0, dayNumber: null });
    }

    // Get all logs for that specific plan + day only
    const logs = await prisma.mealLog.findMany({
      where: {
        userId:     req.user.id,
        mealPlanId: latestLog.mealPlanId,
        dayNumber:  latestLog.dayNumber,
      },
    });

    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        proteinG: acc.proteinG + (log.proteinG || 0),
        carbsG:   acc.carbsG   + (log.carbsG   || 0),
        fatG:     acc.fatG     + (log.fatG     || 0),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    res.json({ ...totals, mealCount: logs.length, dayNumber: latestLog.dayNumber });
  } catch (error) {
    console.error("getTodayNutrition error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/social/nutrition/logged-meals ────────────────────
// Returns the IDs of all logged meals for a specific plan (?planId=X)
// or all logged meal IDs ever. Used to restore checkbox state.

// ── GET /api/social/nutrition/week ───────────────────────────
// Returns per-plan-day calorie totals (Day 1-7) for the Recharts dashboard chart.
// Groups by dayNumber on the most recent meal plan so bars never accumulate
// across multiple test sessions logged on the same calendar date.
export const getWeeklyNutrition = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the most recent meal plan for this user
    const latestPlan = await prisma.mealPlan.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestPlan) {
      return res.json({ week: [], target: req.user.calorieTarget || 2000 });
    }

    // Get all logs for this plan grouped by dayNumber
    const logs = await prisma.mealLog.findMany({
      where:   { userId, mealPlanId: latestPlan.id },
      include: { meal: { select: { totalCalories: true, totalProteinG: true, dayNumber: true } } },
    });

    // Build Day 1-7 bars
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayNum   = i + 1;
      const dayLogs  = logs.filter(l => l.dayNumber === dayNum);
      const calories = dayLogs.reduce((sum, l) => sum + (l.meal?.totalCalories || 0), 0);
      const protein  = dayLogs.reduce((sum, l) => sum + (l.meal?.totalProteinG  || 0), 0);
      return {
        day:      `Day ${dayNum}`,
        dayNum,
        calories: Math.round(calories),
        protein:  Math.round(protein),
        logged:   dayLogs.length > 0,
      };
    });

    res.json({ week: days, target: latestPlan.calorieTarget || req.user.calorieTarget || 2000 });
  } catch (error) {
    console.error('getWeeklyNutrition error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getLoggedMeals = async (req, res) => {
  try {
    const { planId } = req.query;
    const where = {
      userId: req.user.id,
      ...(planId && { mealPlanId: parseInt(planId) }),
    };

    const logs = await prisma.mealLog.findMany({
      where,
      select: { mealId: true },
    });

    res.json({ loggedMealIds: logs.map(l => l.mealId) });
  } catch (error) {
    console.error("getLoggedMeals error:", error);
    res.status(500).json({ message: "Server error" });
  }
};