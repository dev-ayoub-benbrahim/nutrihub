import prisma from "../lib/prisma.js";


export const likeRecipe = async (req, res) => {
  const recipeId = parseInt(req.params.id);
 
  // Confirm the recipe exists before trying to like it
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return res.status(404).json({ message: "Recipe not found" });
 
  try {
    await prisma.like.create({
      data: { userId: req.user.id, recipeId },
    });
 
    // Return updated count so the frontend can update the UI without
    const likeCount = await prisma.like.count({ where: { recipeId } });
    res.status(201).json({ message: "Recipe liked", likeCount });
  } catch (error) {
    // P2002 is Prisma's unique constraint violation code
    if (error.code === "P2002") {
      return res.status(409).json({ message: "You have already liked this recipe" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
 
// DELETE /api/social/recipes/:id/like
// Unlike a recipe. We use deleteMany so that if the like doesn't exist
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
 
// GET /api/social/recipes/:id/likes
// Returns the list of users who liked a recipe.
export const getRecipeLikes = async (req, res) => {
  const recipeId = parseInt(req.params.id);
 
  const likes = await prisma.like.findMany({
    where: { recipeId },
    select: {
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
 
  res.status(200).json({
    likeCount: likes.length,
    likedBy: likes.map((l) => l.user),
  });
};
 
// POST /api/social/recipes/:id/save
// Save a recipe to the user's personal collection.
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
 
// DELETE /api/social/recipes/:id/save
// Remove a recipe from the user's saved collection.
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
 
// GET /api/social/users/:id/saves
// Get all recipes a user has saved 
export const getUserSaves = async (req, res) => {
  const userId = parseInt(req.params.id);
 
  const saves = await prisma.save.findMany({
    where: { userId },
    select: {
      savedAt: true,
      recipe: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
          cookTime: true,
          tags: { select: { tag: true } },
          _count: { select: { likes: true, comments: true } },
        },
      },
    },
    orderBy: { savedAt: "desc" },
  });
 
  res.status(200).json({
    count: saves.length,
    saves: saves.map((s) => ({ ...s.recipe, savedAt: s.savedAt })),
  });
};
 
 
// POST /api/social/recipes/:id/comments
// Post a comment on a recipe. 
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
      content: content.trim(),
      userId: req.user.id,
      recipeId,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
 
  res.status(201).json({ message: "Comment posted", comment });
};
 
// DELETE /api/social/comments/:commentId
// Delete a comment. Only the comment author or an ADMIN can delete.
export const deleteComment = async (req, res) => {
  const commentId = parseInt(req.params.commentId);
 
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
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

 
// POST /api/social/users/:id/follow
// Follow another user. Blocks self-follow. The @@unique([followerId,
// followingId]) constraint prevents duplicate follow records.
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
 
    res.status(201).json({ message: `You are now following ${userToFollow.name}` });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "You are already following this user" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
 
// DELETE /api/social/users/:id/follow
// Unfollow a user.
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
 
// GET /api/social/users/:id/followers
// Returns the list of users following a given user.
export const getFollowers = async (req, res) => {
  const userId = parseInt(req.params.id);
 
  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    select: {
      follower: {
        select: { id: true, name: true, avatarUrl: true, bio: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
 
  res.status(200).json({
    followerCount: follows.length,
    followers: follows.map((f) => f.follower),
  });
};
 
// GET /api/social/users/:id/following
// Returns the list of users that a given user is following.
export const getFollowing = async (req, res) => {
  const userId = parseInt(req.params.id);
 
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: {
      following: {
        select: { id: true, name: true, avatarUrl: true, bio: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
 
  res.status(200).json({
    followingCount: follows.length,
    following: follows.map((f) => f.following),
  });
};