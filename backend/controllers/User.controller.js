import prisma from "../lib/prisma.js";

// ── GET /api/users/:id ────────────────────────────────────────
// Public profile endpoint — returns safe user fields without password.
// Used by UserProfilePage to get name, bio, avatar, role, goal
// regardless of whether they have recipes.
export const getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id:             true,
        name:           true,
        role:           true,
        bio:            true,
        avatarURL:      true,
        specialisation: true,
        goal:           true,
        createdAt:      true,
        // intentionally exclude: email, password, restrictions, calorieTarget
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("getUserById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/users/search?q=term ─────────────────────────────
// Search users by name — for the people search feature.
export const searchUsers = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2)
      return res.status(400).json({ message: "Search query must be at least 2 characters" });

    const users = await prisma.user.findMany({
      where: {
        name: { contains: q.trim(), mode: "insensitive" },
      },
      select: {
        id:             true,
        name:           true,
        role:           true,
        bio:            true,
        avatarURL:      true,
        specialisation: true,
      },
      take: parseInt(limit),
      orderBy: { name: "asc" },
    });

    res.json({ users });
  } catch (error) {
    console.error("searchUsers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};