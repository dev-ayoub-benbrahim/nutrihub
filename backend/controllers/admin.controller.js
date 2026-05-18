import prisma from "../lib/prisma.js";

// ── Middleware check (used in routes) ─────────────────────────
// Routes should use: protect, restrictTo("ADMIN")

// ── GET /api/admin/stats ──────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const now     = new Date();
    const week    = new Date(now - 7  * 24 * 60 * 60 * 1000);
    const month   = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersThisWeek,
      totalRecipes, newRecipesThisWeek,
      totalMealPlans, mealPlansThisWeek,
      pendingReports, pendingExpertRequests,
      totalCommunities, totalLikes, totalComments,
      // Most active communities by post count
      topCommunities,
      // Most liked recipes this week
      topRecipes,
      // New users per day for the last 7 days
      usersByDay,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: week } } }),
      prisma.recipe.count(),
      prisma.recipe.count({ where: { createdAt: { gte: week } } }),
      prisma.mealPlan.count(),
      prisma.mealPlan.count({ where: { createdAt: { gte: week } } }),
      prisma.report.count({ where: { resolved: false } }),
      prisma.expertRequest.count({ where: { status: "pending" } }),
      prisma.community.count(),
      prisma.like.count(),
      prisma.comment.count(),
      prisma.community.findMany({
        take: 5,
        orderBy: { posts: { _count: "desc" } },
        select: {
          id: true, name: true, imageUrl: true,
          _count: { select: { posts: true, members: true } },
        },
      }),
      prisma.recipe.findMany({
        where:   { createdAt: { gte: week } },
        take:    5,
        orderBy: { likes: { _count: "desc" } },
        select: {
          id: true, title: true, imageURL: true,
          user: { select: { name: true } },
          _count: { select: { likes: true } },
        },
      }),
      // Count new users per day for the last 7 days
      prisma.$queryRaw`
        SELECT DATE("createdAt") as day, COUNT(*)::int as count
        FROM users
        WHERE "createdAt" >= ${week}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
    ]);

    res.json({
      totalUsers, newUsersThisWeek,
      totalRecipes, newRecipesThisWeek,
      totalMealPlans, mealPlansThisWeek,
      pendingReports, pendingExpertRequests,
      totalCommunities, totalLikes, totalComments,
      topCommunities, topRecipes,
      userGrowth: usersByDay,
    });
  } catch (error) {
    console.error("getStats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/reports ────────────────────────────────────
export const getReports = async (req, res) => {
  try {
    const { resolved = "false", page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * 20;

    const reports = await prisma.report.findMany({
      where:   { resolved: resolved === "true" },
      orderBy: { createdAt: "desc" },
      skip,
      take: 20,
      include: {
        reporter: { select: { id: true, name: true, email: true, avatarURL: true } },
      },
    });

    // Attach recipe or reported user details
    const enriched = await Promise.all(reports.map(async (r) => {
      let recipe       = null;
      let reportedUser = null;
      if (r.recipeId) {
        recipe = await prisma.recipe.findUnique({
          where:  { id: r.recipeId },
          select: { id: true, title: true, userId: true, imageURL: true },
        });
      }
      if (r.reportedUserId) {
        reportedUser = await prisma.user.findUnique({
          where:  { id: r.reportedUserId },
          select: { id: true, name: true, email: true, role: true, avatarURL: true },
        });
      }
      return { ...r, recipe, reportedUser };
    }));

    const total = await prisma.report.count({ where: { resolved: resolved === "true" } });
    res.json({ reports: enriched, total });
  } catch (error) {
    console.error("getReports error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/admin/reports/:id/resolve ────────────────────────
export const resolveReport = async (req, res) => {
  try {
    const { action, adminMessage } = req.body;
    // action: "dismiss" | "warn" | "delete"

    const report = await prisma.report.findUnique({
      where:   { id: parseInt(req.params.id) },
      include: {
        reporter: { select: { id: true } },
        recipe:   { select: { id: true, title: true, userId: true } },
      },
    });
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Update report status
    await prisma.report.update({
      where: { id: report.id },
      data:  { resolved: true, resolvedNote: adminMessage || action || null },
    });

    // Notify the reporter of the outcome
    if (report.reporterId) {
      const reporterMsg = action === "delete"
        ? `Your report on "${report.recipe?.title || "content"}" has been reviewed. The content has been removed for violating community guidelines.`
        : action === "warn"
        ? `Your report on "${report.recipe?.title || "content"}" has been reviewed. The content owner has been warned.`
        : `Your report on "${report.recipe?.title || "content"}" has been reviewed. No violation was found — thank you for helping keep the community safe.`;

      await prisma.notification.create({
        data: {
          userId:  report.reporterId,
          type:    "report_resolved",
          message: reporterMsg,
          link:    report.recipe?.id ? `/recipes/${report.recipe.id}` : "/",
        },
      });
    }

    // Notify the content owner if action was taken
    if (report.recipe?.userId && (action === "delete" || action === "warn")) {
      const ownerMsg = action === "delete"
        ? `Your recipe "${report.recipe.title}" has been removed following a community report. ${adminMessage ? "Reason: " + adminMessage : "It was found to violate community guidelines."}`
        : `Your recipe "${report.recipe.title}" has received a warning following a community report. ${adminMessage ? "Note: " + adminMessage : "Please review our community guidelines."}`;

      await prisma.notification.create({
        data: {
          userId:  report.recipe.userId,
          type:    "content_moderated",
          message: ownerMsg,
          link:    `/recipes/${report.recipe.id}`,
        },
      });
    }

    // Delete the recipe if action is delete
    if (action === "delete" && report.recipe?.id) {
      await prisma.recipe.delete({ where: { id: report.recipe.id } }).catch(() => {});
    }

    res.json({ message: "Report resolved and notifications sent" });
  } catch (error) {
    console.error("resolveReport error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/expert-requests ────────────────────────────
export const getExpertRequests = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const requests = await prisma.expertRequest.findMany({
      where:   { status },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatarURL: true } },
      },
    });
    res.json({ requests });
  } catch (error) {
    console.error("getExpertRequests error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/admin/expert-requests/:id ───────────────────────
// Approve or reject an expert request
export const reviewExpertRequest = async (req, res) => {
  try {
    const { decision, adminNote } = req.body; // decision: "approved" | "rejected"

    if (!["approved", "rejected"].includes(decision))
      return res.status(400).json({ message: "Decision must be approved or rejected" });

    const request = await prisma.expertRequest.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Update request status
    await prisma.expertRequest.update({
      where: { id: request.id },
      data:  { status: decision, adminNote: adminNote || null },
    });

    // If approved — promote the user to EXPERT
    if (decision === "approved") {
      await prisma.user.update({
        where: { id: request.userId },
        data:  { role: "EXPERT" },
      });
    }

    res.json({ message: `Request ${decision}` });
  } catch (error) {
    console.error("reviewExpertRequest error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/users ──────────────────────────────────────
export const getUsers = async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * 20;
    const where = q ? { name: { contains: q, mode: "insensitive" } } : {};

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, avatarURL: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: 20,
    });
    const total = await prisma.user.count({ where });
    res.json({ users, total });
  } catch (error) {
    console.error("getUsers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/admin/users/:id/role ─────────────────────────────
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["USER", "EXPERT", "ADMIN"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const user = await prisma.user.update({
      where:  { id: parseInt(req.params.id) },
      data:   { role },
      select: { id: true, name: true, role: true },
    });
    res.json({ user });
  } catch (error) {
    console.error("updateUserRole error:", error);
    res.status(500).json({ message: "Server error" });
  }
};