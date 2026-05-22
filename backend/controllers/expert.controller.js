import prisma from "../lib/prisma.js";

// All routes here require protect + restrictTo("EXPERT","ADMIN")

// ── GET /api/expert/recipes/:recipeId/note ────────────────────
export const getExpertNote = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.recipeId);
    const note = await prisma.expertNote.findFirst({
      where: { recipeId },
      include: {
        expert: { select: { id: true, name: true, avatarURL: true, specialisation: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ note: note || null });
  } catch (error) {
    console.error("getExpertNote error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/expert/recipes/:recipeId/note ───────────────────
// Expert adds or updates a professional annotation to a recipe
export const upsertExpertNote = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.recipeId);
    const { content } = req.body;

    if (!content || content.trim().length < 10)
      return res.status(400).json({ message: "Note must be at least 10 characters" });

    if (content.trim().length > 600)
      return res.status(400).json({ message: "Note must be 600 characters or fewer" });

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    const note = await prisma.expertNote.upsert({
      where:  { recipeId_expertId: { recipeId, expertId: req.user.id } },
      create: { recipeId, expertId: req.user.id, content: content.trim() },
      update: { content: content.trim() },
      include: {
        expert: { select: { id: true, name: true, avatarURL: true, specialisation: true } },
      },
    });

    // Notify recipe owner
    if (recipe.userId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId:  recipe.userId,
          type:    "expert_note",
          message: `${req.user.name} (Verified Expert) added a professional note to your recipe "${recipe.title}"`,
          link:    `/recipes/${recipeId}`,
        },
      });
    }

    res.status(201).json({ note });
  } catch (error) {
    console.error("upsertExpertNote error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/expert/recipes/:recipeId/note ─────────────────
export const deleteExpertNote = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.recipeId);
    await prisma.expertNote.deleteMany({
      where: { recipeId, expertId: req.user.id },
    });
    res.json({ message: "Note removed" });
  } catch (error) {
    console.error("deleteExpertNote error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/expert/communities/:communityId/posts/:postId/comments/:commentId/verify
// Expert marks their own comment as the verified answer for a post
export const markVerifiedAnswer = async (req, res) => {
  try {
    const postId    = parseInt(req.params.postId);
    const commentId = parseInt(req.params.commentId);

    // Verify this comment belongs to the requesting expert
    const comment = await prisma.communityPostComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.userId !== req.user.id)
      return res.status(403).json({ message: "You can only verify your own answers" });

    // only one verified answer per post
    const answer = await prisma.verifiedAnswer.upsert({
      where:  { postId },
      create: { postId, commentId, expertId: req.user.id },
      update: { commentId, expertId: req.user.id },
      include: {
        expert: { select: { id: true, name: true, specialisation: true } },
      },
    });

    res.status(201).json({ answer });
  } catch (error) {
    console.error("markVerifiedAnswer error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/expert/communities/:communityId/posts/:postId/verify
export const removeVerifiedAnswer = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    await prisma.verifiedAnswer.deleteMany({
      where: { postId, expertId: req.user.id },
    });
    res.json({ message: "Verified answer removed" });
  } catch (error) {
    console.error("removeVerifiedAnswer error:", error);
    res.status(500).json({ message: "Server error" });
  }
};