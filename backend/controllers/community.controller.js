import prisma from "../lib/prisma.js";

// ── Helpers ───────────────────────────────────────────────────
const buildMemberSet = async (userId) => {
  if (!userId) return new Set();
  const memberships = await prisma.communityMember.findMany({
    where:  { userId },
    select: { communityId: true },
  });
  return new Set(memberships.map((m) => m.communityId));
};

// ── GET /api/communities ──────────────────────────────────────
export const getCommunities = async (req, res) => {
  try {
    const communities = await prisma.community.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true } },
        _count:  { select: { members: true, communityRecipes: true } },
      },
    });

    const membershipSet = await buildMemberSet(req.user?.id);
    const result = communities.map((c) => ({
      ...c,
      isMember: membershipSet.has(c.id),
    }));

    res.json({ communities: result });
  } catch (error) {
    console.error("getCommunities error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/communities/:id ──────────────────────────────────
export const getCommunityById = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);

    const community = await prisma.community.findUnique({
      where:   { id: communityId },
      include: {
        creator: { select: { id: true, name: true, avatarURL: true } },
        members: {
          include: { user: { select: { id: true, name: true, avatarURL: true } } },
          orderBy: { joinedAt: "asc" },
          take:    20,
        },
        _count: { select: { members: true, communityRecipes: true, posts: true } },
      },
    });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    const isMember = req.user
      ? !!(await prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId, userId: req.user.id } },
        }))
      : false;

    res.json({ ...community, isMember });
  } catch (error) {
    console.error("getCommunityById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/communities/:id/recipes ─────────────────────────
// Recipe feed — all recipes shared into this community
export const getCommunityRecipes = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const communityRecipes = await prisma.communityRecipe.findMany({
      where:   { communityId },
      orderBy: { postedAt: "desc" },
      skip,
      take:    parseInt(limit),
      include: {
        postedBy: { select: { id: true, name: true, avatarURL: true } },
        recipe: {
          include: {
            user:   { select: { id: true, name: true, avatarURL: true } },
            tags:   true,
            _count: { select: { likes: true, comments: true, saves: true } },
          },
        },
      },
    });

    const total = await prisma.communityRecipe.count({ where: { communityId } });

    res.json({
      recipes: communityRecipes.map((cr) => ({
        ...cr.recipe,
        postedBy: cr.postedBy,
        postedAt: cr.postedAt,
      })),
      pagination: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getCommunityRecipes error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/communities/:id/recipes ────────────────────────
// Share a recipe into the community — must be a member
export const shareRecipeToCommunity = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const { recipeId }  = req.body;

    if (!recipeId)
      return res.status(400).json({ message: "recipeId is required" });

    // Verify membership
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: req.user.id } },
    });
    if (!membership)
      return res.status(403).json({ message: "You must be a member to share recipes" });

    // Verify ownership of the recipe
    const recipe = await prisma.recipe.findUnique({ where: { id: parseInt(recipeId) } });
    if (!recipe)
      return res.status(404).json({ message: "Recipe not found" });
    if (recipe.userId !== req.user.id)
      return res.status(403).json({ message: "You can only share your own recipes" });

    const communityRecipe = await prisma.communityRecipe.create({
      data: {
        communityId,
        recipeId:  parseInt(recipeId),
        postedById: req.user.id,
      },
    });

    res.status(201).json({ message: "Recipe shared to community", communityRecipe });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(409).json({ message: "This recipe has already been shared to this community" });
    console.error("shareRecipeToCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/communities/:id/recipes/:recipeId ────────────
export const removeRecipeFromCommunity = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const recipeId    = parseInt(req.params.recipeId);

    const cr = await prisma.communityRecipe.findUnique({
      where: { communityId_recipeId: { communityId, recipeId } },
    });
    if (!cr) return res.status(404).json({ message: "Recipe not found in this community" });

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    const isAdmin   = req.user.role === "ADMIN";
    const isCreator = community.creatorId === req.user.id;
    const isPoster  = cr.postedById === req.user.id;

    if (!isAdmin && !isCreator && !isPoster)
      return res.status(403).json({ message: "Not authorised to remove this recipe" });

    await prisma.communityRecipe.delete({
      where: { communityId_recipeId: { communityId, recipeId } },
    });

    res.json({ message: "Recipe removed from community" });
  } catch (error) {
    console.error("removeRecipeFromCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/communities/:id/posts ───────────────────────────
export const getCommunityPosts = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);

    const posts = await prisma.communityPost.findMany({
      where:   { communityId },
      orderBy: { createdAt: "desc" },
      take:    30,
      include: {
        user: { select: { id: true, name: true, avatarURL: true, role: true } },
      },
    });

    res.json({ posts });
  } catch (error) {
    console.error("getCommunityPosts error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/communities/:id/posts ──────────────────────────
export const createCommunityPost = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || content.trim().length < 2)
      return res.status(400).json({ message: "Post content is required" });

    if (content.trim().length > 1000)
      return res.status(400).json({ message: "Post must be 1000 characters or fewer" });

    // Must be a member
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: req.user.id } },
    });
    if (!membership)
      return res.status(403).json({ message: "You must be a member to post here" });

    // Handle optional image upload (multer puts it in req.file)
    let imageURL = null;
    if (req.file) {
      const { v2: cloudinary } = await import("cloudinary");
      const streamifier = await import("streamifier");
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "nutrihub/community" },
          (err, res) => err ? reject(err) : resolve(res)
        ).end(req.file.buffer);
      });
      imageURL = result.secure_url;
    }

    const { postType = "question", ingredients } = req.body;
    const validTypes = ["question", "log", "draft"];
    const type = validTypes.includes(postType) ? postType : "question";

    // Parse ingredients JSON for draft posts
    let parsedIngredients = null;
    if (type === "draft" && ingredients) {
      try { parsedIngredients = typeof ingredients === "string" ? JSON.parse(ingredients) : ingredients; }
      catch { parsedIngredients = null; }
    }

    const post = await prisma.communityPost.create({
      data: {
        communityId,
        userId:      req.user.id,
        content:     content.trim(),
        imageURL,
        postType:    type,
        ingredients: parsedIngredients,
      },
      include: {
        user: { select: { id: true, name: true, avatarURL: true, role: true } },
      },
    });

    res.status(201).json({ post });
  } catch (error) {
    console.error("createCommunityPost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/communities/:id/posts/:postId ────────────────
export const deleteCommunityPost = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const postId      = parseInt(req.params.postId);

    const post      = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post)      return res.status(404).json({ message: "Post not found" });

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    const isAdmin   = req.user.role === "ADMIN";
    const isCreator = community.creatorId === req.user.id;
    const isAuthor  = post.userId === req.user.id;

    if (!isAdmin && !isCreator && !isAuthor)
      return res.status(403).json({ message: "Not authorised to delete this post" });

    await prisma.communityPost.delete({ where: { id: postId } });
    res.json({ message: "Post deleted" });
  } catch (error) {
    console.error("deleteCommunityPost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/communities ─────────────────────────────────────
export const createCommunity = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length < 2)
      return res.status(400).json({ message: "Community name must be at least 2 characters" });

    const existing = await prisma.community.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });
    if (existing)
      return res.status(409).json({ message: "A community with that name already exists" });

    const community = await prisma.$transaction(async (tx) => {
      const c = await tx.community.create({
        data: {
          name:        name.trim(),
          description: description?.trim() || null,
          creatorId:   req.user.id,
        },
        include: {
          creator: { select: { id: true, name: true } },
          _count:  { select: { members: true, communityRecipes: true } },
        },
      });
      await tx.communityMember.create({
        data: { communityId: c.id, userId: req.user.id },
      });
      return c;
    });

    res.status(201).json({ community: { ...community, isMember: true } });
  } catch (error) {
    console.error("createCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/communities/:id/join ────────────────────────────
export const joinCommunity = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const community   = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ message: "Community not found" });

    await prisma.communityMember.create({ data: { communityId, userId: req.user.id } });

    const memberCount = await prisma.communityMember.count({ where: { communityId } });
    res.status(201).json({ message: `Joined ${community.name}`, memberCount });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(409).json({ message: "You are already a member" });
    console.error("joinCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/communities/:id/leave ────────────────────────
export const leaveCommunity = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const community   = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.creatorId === req.user.id)
      return res.status(400).json({ message: "Creators cannot leave — delete the community instead" });

    const { count } = await prisma.communityMember.deleteMany({
      where: { communityId, userId: req.user.id },
    });
    if (count === 0) return res.status(404).json({ message: "You are not a member" });

    res.json({ message: "Left community" });
  } catch (error) {
    console.error("leaveCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/communities/:id ──────────────────────────────
export const deleteCommunity = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const community   = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.creatorId !== req.user.id && req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Not authorised" });

    await prisma.community.delete({ where: { id: communityId } });
    res.json({ message: "Community deleted" });
  } catch (error) {
    console.error("deleteCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/communities/:id ─────────────────────────────────
// Edit name/description — creator only
export const updateCommunity = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const { name, description } = req.body;

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.creatorId !== req.user.id && req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Not authorised" });

    const updated = await prisma.community.update({
      where: { id: communityId },
      data: {
        ...(name        && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
      include: {
        creator: { select: { id: true, name: true } },
        _count:  { select: { members: true, communityRecipes: true } },
      },
    });

    res.json({ community: updated });
  } catch (error) {
    console.error("updateCommunity error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/communities/:id/members/:userId ───────────────
// Kick a member — creator or admin only, cannot kick yourself
export const kickMember = async (req, res) => {
  try {
    const communityId  = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.creatorId !== req.user.id && req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Only the community admin can remove members" });

    if (targetUserId === community.creatorId)
      return res.status(400).json({ message: "Cannot remove the community creator" });

    const { count } = await prisma.communityMember.deleteMany({
      where: { communityId, userId: targetUserId },
    });

    if (count === 0)
      return res.status(404).json({ message: "User is not a member of this community" });

    res.json({ message: "Member removed from community" });
  } catch (error) {
    console.error("kickMember error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/communities/:id/feed ────────────────────────────
// Unified community wall — merges recipe shares AND text posts
// sorted chronologically. Each item has a `kind` field:
//   kind: "recipe" — a shared recipe
//   kind: "post"   — a text discussion post
export const getCommunityFeed = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);

    const [communityRecipes, posts] = await Promise.all([
      prisma.communityRecipe.findMany({
        where:   { communityId },
        orderBy: { postedAt: "desc" },
        take:    30,
        include: {
          postedBy: { select: { id: true, name: true, avatarURL: true } },
          recipe: {
            include: {
              user:   { select: { id: true, name: true, avatarURL: true } },
              tags:   true,
              _count: { select: { likes: true, comments: true, saves: true } },
            },
          },
        },
      }),
      prisma.communityPost.findMany({
        where:   { communityId },
        orderBy: { createdAt: "desc" },
        take:    30,
        include: {
          user:     { select: { id: true, name: true, avatarURL: true, role: true } },
          _count:   { select: { comments: true } },
        },
      }),
    ]);

    // Shape recipe items
    const recipeItems = communityRecipes.map((cr) => ({
      kind:      "recipe",
      id:        `recipe-${cr.id}`,
      createdAt: cr.postedAt,
      postedBy:  cr.postedBy,
      recipe:    cr.recipe,
    }));

    // Shape post items
    const postItems = posts.map((p) => ({
      kind:         "post",
      id:           `post-${p.id}`,
      dbId:         p.id,
      createdAt:    p.createdAt,
      user:         p.user,
      content:      p.content,
      imageURL:     p.imageURL,
      postType:     p.postType || "question",
      ingredients:  p.ingredients,
      commentCount: p._count?.comments || 0,
    }));

    // Merge and sort by date descending
    const feed = [...recipeItems, ...postItems].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ feed });
  } catch (error) {
    console.error("getCommunityFeed error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/communities/:id/posts/:postId/comments ───────────
export const getPostComments = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const comments = await prisma.communityPostComment.findMany({
      where:   { postId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, avatarURL: true, role: true } },
      },
    });
    res.json({ comments });
  } catch (error) {
    console.error("getPostComments error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/communities/:id/posts/:postId/comments ──────────
export const addPostComment = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const postId      = parseInt(req.params.postId);
    const { content } = req.body;

    if (!content || content.trim().length < 1)
      return res.status(400).json({ message: "Comment cannot be empty" });

    if (content.trim().length > 500)
      return res.status(400).json({ message: "Comment must be 500 characters or fewer" });

    // Must be a community member
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: req.user.id } },
    });
    if (!membership)
      return res.status(403).json({ message: "Join the community to reply" });

    const comment = await prisma.communityPostComment.create({
      data:    { postId, userId: req.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, avatarURL: true, role: true } } },
    });

    res.status(201).json({ comment });
  } catch (error) {
    console.error("addPostComment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/communities/:id/posts/:postId/comments/:commentId
export const deletePostComment = async (req, res) => {
  try {
    const communityId = parseInt(req.params.id);
    const commentId   = parseInt(req.params.commentId);

    const comment   = await prisma.communityPostComment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    const isAuthor  = comment.userId === req.user.id;
    const isCreator = community.creatorId === req.user.id;
    const isAdmin   = req.user.role === "ADMIN";

    if (!isAuthor && !isCreator && !isAdmin)
      return res.status(403).json({ message: "Not authorised" });

    await prisma.communityPostComment.delete({ where: { id: commentId } });
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("deletePostComment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};