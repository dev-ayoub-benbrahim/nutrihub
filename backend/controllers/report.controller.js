import prisma from "../lib/prisma.js";

// ── POST /api/reports ──────────────────────────────────────────
export const createReport = async (req, res) => {
  try {
    const { reason, category = "Other", recipeId, reportedUserId } = req.body;

    if (!reason || reason.trim().length < 5)
      return res.status(400).json({ message: "Please provide a reason (minimum 5 characters)" });

    if (!recipeId && !reportedUserId)
      return res.status(400).json({ message: "Must report a recipe or a user" });

    const validCategories = ["Spam", "Inappropriate", "Misinformation", "Harassment", "Other"];
    if (!validCategories.includes(category))
      return res.status(400).json({ message: "Invalid category" });

    // Prevent duplicate reports
    const existing = await prisma.report.findFirst({
      where: {
        reporterId:     req.user.id,
        ...(recipeId       && { recipeId:       parseInt(recipeId) }),
        ...(reportedUserId && { reportedUserId: parseInt(reportedUserId) }),
      },
    });
    if (existing)
      return res.status(409).json({ message: "You have already reported this" });

    await prisma.report.create({
      data: {
        reporterId:     req.user.id,
        category,
        reason:         reason.trim(),
        ...(recipeId       && { recipeId:       parseInt(recipeId) }),
        ...(reportedUserId && { reportedUserId: parseInt(reportedUserId) }),
      },
    });

    res.status(201).json({ message: "Report submitted — our team will review it" });
  } catch (error) {
    console.error("createReport error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/expert-requests ─────────────────────────────────
export const createExpertRequest = async (req, res) => {
  try {
    const { profession, experience, qualifications, linkedin } = req.body;

    if (!profession || !experience || !qualifications)
      return res.status(400).json({ message: "Profession, experience, and qualifications are required" });

    // Only USER role can apply
    if (req.user.role !== "USER")
      return res.status(400).json({ message: "You already have an elevated role" });

    // Check for pending request
    const existing = await prisma.expertRequest.findFirst({
      where: { userId: req.user.id, status: "pending" },
    });
    if (existing)
      return res.status(409).json({ message: "You already have a pending expert request" });

    await prisma.expertRequest.create({
      data: {
        userId:         req.user.id,
        profession:     profession.trim(),
        experience:     experience.trim(),
        qualifications: qualifications.trim(),
        linkedin:       linkedin?.trim() || null,
      },
    });

    res.status(201).json({ message: "Expert verification request submitted — we'll review it within 48 hours" });
  } catch (error) {
    console.error("createExpertRequest error:", error);
    res.status(500).json({ message: "Server error" });
  }
};