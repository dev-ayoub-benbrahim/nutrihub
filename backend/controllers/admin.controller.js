import prisma from "../lib/prisma.js";

// Middleware check (used in routes) 
// Routes should use: protect, restrictTo("ADMIN")

// ── GET /api/admin/stats 
export const getStats = async (req, res) => {
  try {
    const [users, recipes, reports, expertRequests, communities] = await Promise.all([
      prisma.user.count(),
      prisma.recipe.count(),
      prisma.report.count({ where: { resolved: false } }),
      prisma.expertRequest.count({ where: { status: "pending" } }),
      prisma.community.count(),
    ]);
    res.json({ users, recipes, pendingReports: reports, pendingExpertRequests: expertRequests, communities });
  } catch (error) {
    console.error("getStats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/reports 
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

// ── PUT /api/admin/reports/:id/resolve 
export const resolveReport = async (req, res) => {
  try {
    const { resolvedNote } = req.body;
    await prisma.report.update({
      where: { id: parseInt(req.params.id) },
      data:  { resolved: true, resolvedNote: resolvedNote || null },
    });
    res.json({ message: "Report resolved" });
  } catch (error) {
    console.error("resolveReport error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/expert-requests 
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

// ── PUT /api/admin/expert-requests/:id 
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