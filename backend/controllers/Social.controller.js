import prisma from "../lib/prisma.js";
import { createNotification } from "./notification.controller.js";

export const likeRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });
  try {
    await prisma.like.create({ data: { userId: req.user.id, recipeId } });
    const likeCount = await prisma.like.count({ where: { recipeId } });
    if (recipe.userId !== req.user.id) {
      const liker = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      await createNotification(prisma, { userId: recipe.userId, type: "like", message: `${liker.name} liked your recipe "${recipe.title}"`, link: `/recipes/${recipeId}` });
    }
    res.status(201).json({ message: "Recipe liked", likeCount });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ message: "You have already liked this recipe" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const unlikeRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const { count } = await prisma.like.deleteMany({ where: { userId: req.user.id, recipeId } });
  if (count === 0) return res.status(404).json({ message: "You have not liked this recipe" });
  const likeCount = await prisma.like.count({ where: { recipeId } });
  res.status(200).json({ message: "Recipe unliked", likeCount });
};

export const getRecipeLikes = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const likes = await prisma.like.findMany({
    where: { recipeId },
    select: { user: { select: { id: true, name: true, avatarURL: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ likeCount: likes.length, likedBy: likes.map((l) => l.user) });
};

export const saveRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });
  try {
    await prisma.save.create({ data: { userId: req.user.id, recipeId } });
    res.status(201).json({ message: "Recipe saved" });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ message: "Recipe already saved" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const unsaveRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const { count } = await prisma.save.deleteMany({ where: { userId: req.user.id, recipeId } });
  if (count === 0) return res.status(404).json({ message: "Recipe not in your saved collection" });
  res.status(200).json({ message: "Recipe removed from saved" });
};

export const getUserSaves = async (req, res) => {
  const userId = parseInt(req.params.id);
  const saves = await prisma.save.findMany({
    where: { userId },
    select: {
      createdAt: true,
      recipe: { select: { id: true, title: true, imageURL: true, cookTime: true, tags: { select: { tag: true } }, _count: { select: { likes: true, comments: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ count: saves.length, saves: saves.map((s) => ({ ...s.recipe, savedAt: s.createdAt })) });
};

export const addComment = async (req, res) => {
  const recipeId = parseInt(req.params.id);
  const { content } = req.body;
  if (!content || content.trim().length === 0) return res.status(400).json({ message: "Comment content is required" });
  if (content.trim().length > 500) return res.status(400).json({ message: "Comment must be 500 characters or fewer" });
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });
  const comment = await prisma.comment.create({
    data: { content: content.trim(), userId: req.user.id, recipeId },
    select: { id: true, content: true, createdAt: true, user: { select: { id: true, name: true, avatarURL: true } } },
  });
  if (recipe.userId !== req.user.id) {
    await createNotification(prisma, { userId: recipe.userId, type: "comment", message: `${req.user.name} commented on your recipe "${recipe.title}"`, link: `/recipes/${recipeId}` });
  }
  const priorCommenters = await prisma.comment.findMany({
    where: { recipeId, userId: { not: req.user.id, notIn: [recipe.userId] } },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const { userId } of priorCommenters) {
    await createNotification(prisma, { userId, type: "comment", message: `${req.user.name} also commented on "${recipe.title}"`, link: `/recipes/${recipeId}` });
  }
  res.status(201).json({ message: "Comment posted", comment });
};

export const deleteComment = async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, userId: true } });
  if (!comment) return res.status(404).json({ message: "Comment not found" });
  if (comment.userId !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ message: "You cannot delete this comment" });
  await prisma.comment.delete({ where: { id: commentId } });
  res.status(200).json({ message: "Comment deleted" });
};

export const followUser = async (req, res) => {
  const followingId = parseInt(req.params.id);
  const followerId  = req.user.id;
  if (followerId === followingId) return res.status(400).json({ message: "You cannot follow yourself" });
  const userToFollow = await prisma.user.findUnique({ where: { id: followingId } });
  if (!userToFollow) return res.status(404).json({ message: "User not found" });
  try {
    await prisma.follow.create({ data: { followerId, followingId } });
    await createNotification(prisma, { userId: followingId, type: "follow", message: `${req.user.name} started following you`, link: `/users/${req.user.id}` });
    res.status(201).json({ message: `You are now following ${userToFollow.name}` });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ message: "You are already following this user" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const unfollowUser = async (req, res) => {
  const followingId = parseInt(req.params.id);
  const { count } = await prisma.follow.deleteMany({ where: { followerId: req.user.id, followingId } });
  if (count === 0) return res.status(404).json({ message: "You are not following this user" });
  res.status(200).json({ message: "Unfollowed successfully" });
};

export const getFollowers = async (req, res) => {
  const userId = parseInt(req.params.id);
  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    select: { follower: { select: { id: true, name: true, avatarURL: true, bio: true } }, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ followerCount: follows.length, followers: follows.map((f) => f.follower) });
};

export const getFollowing = async (req, res) => {
  const userId = parseInt(req.params.id);
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { following: { select: { id: true, name: true, avatarURL: true, bio: true } }, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ followingCount: follows.length, following: follows.map((f) => f.following) });
};

// ── POST /api/social/meals/:id/log ───────────────────────────
export const logMeal = async (req, res) => {
  try {
    const userId = req.user.id;
    const mealId = parseInt(req.params.id || req.params.mealId);
    const { mealPlanId, dayNumber = 1 } = req.body;

    if (isNaN(mealId)) return res.status(400).json({ message: "Invalid meal ID" });

    const meal = await prisma.meal.findUnique({
      where:   { id: mealId },
      include: { mealPlan: { select: { id: true, userId: true } } },
    });
    if (!meal) return res.status(404).json({ message: "Meal not found" });
    if (meal.mealPlan.userId !== userId) return res.status(403).json({ message: "Not your meal" });

    const planId = mealPlanId ? parseInt(mealPlanId) : meal.mealPlan.id;

    // Clear today's logs from a different plan — prevents chart stacking
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    await prisma.mealLog.deleteMany({
      where: { userId, loggedAt: { gte: todayStart, lte: todayEnd }, mealPlanId: { not: planId } },
    });

    await prisma.mealLog.upsert({
      where:  { userId_mealId: { userId, mealId } },
      update: { loggedAt: new Date(), mealPlanId: planId },
      create: {
        userId, mealId, mealPlanId: planId,
        dayNumber: parseInt(dayNumber), loggedAt: new Date(),
        calories: meal.totalCalories || 0, proteinG: meal.totalProteinG || 0,
        carbsG: meal.totalCarbsG || 0, fatG: meal.totalFatG || 0,
      },
    });

    res.json({ message: "Meal logged" });
  } catch (error) {
    console.error("logMeal error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/social/meals/:id/log ─────────────────────────
export const unlogMeal = async (req, res) => {
  try {
    const userId = req.user.id;
    const mealId = parseInt(req.params.id);
    await prisma.mealLog.deleteMany({ where: { userId, mealId } });
    res.json({ message: "Meal unlogged" });
  } catch (error) {
    console.error("unlogMeal error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/social/nutrition/today ──────────────────────────
export const getTodayNutrition = async (req, res) => {
  try {
    const latestLog = await prisma.mealLog.findFirst({
      where:   { userId: req.user.id },
      orderBy: { loggedAt: "desc" },
      select:  { mealPlanId: true, dayNumber: true },
    });
    if (!latestLog) return res.json({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, mealCount: 0, dayNumber: null });

    const logs = await prisma.mealLog.findMany({
      where: { userId: req.user.id, mealPlanId: latestLog.mealPlanId, dayNumber: latestLog.dayNumber },
    });
    const totals = logs.reduce(
      (acc, log) => ({ calories: acc.calories + (log.calories || 0), proteinG: acc.proteinG + (log.proteinG || 0), carbsG: acc.carbsG + (log.carbsG || 0), fatG: acc.fatG + (log.fatG || 0) }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
    res.json({ ...totals, mealCount: logs.length, dayNumber: latestLog.dayNumber });
  } catch (error) {
    console.error("getTodayNutrition error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/social/nutrition/week ───────────────────────────
export const getWeeklyNutrition = async (req, res) => {
  try {
    const userId = req.user.id;
    const days   = [];

    for (let i = 6; i >= 0; i--) {
      const d     = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end   = new Date(new Date(start).setHours(23, 59, 59, 999));

      const logs = await prisma.mealLog.findMany({
        where:   { userId, loggedAt: { gte: start, lte: end } },
        include: { meal: { select: { totalCalories: true, totalProteinG: true } } },
      });

      const seen     = new Set();
      const calories = logs.reduce((sum, l) => {
        if (seen.has(l.mealId)) return sum;
        seen.add(l.mealId);
        return sum + (l.meal?.totalCalories || 0);
      }, 0);
      const protein = logs.reduce((sum, l) => sum + (l.meal?.totalProteinG || 0), 0);

      days.push({
        day:      start.toLocaleDateString('en', { weekday: 'short' }),
        date:     start.toISOString().split('T')[0],
        calories: Math.round(calories),
        protein:  Math.round(protein),
      });
    }

    const latestPlan = await prisma.mealPlan.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select:  { calorieTarget: true },
    });

    res.json({ week: days, target: latestPlan?.calorieTarget || req.user.calorieTarget || 2000 });
  } catch (error) {
    console.error('getWeeklyNutrition error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/nutrition/logged-meals ────────────────────
export const getLoggedMeals = async (req, res) => {
  try {
    const { planId } = req.query;
    const where = {
      userId: req.user.id,
      ...(planId && { mealPlanId: parseInt(planId) }),
    };
    const logs = await prisma.mealLog.findMany({ where, select: { mealId: true } });
    res.json({ loggedMealIds: logs.map(l => l.mealId) });
  } catch (error) {
    console.error("getLoggedMeals error:", error);
    res.status(500).json({ message: "Server error" });
  }
};