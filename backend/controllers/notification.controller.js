import prisma from "../lib/prisma.js";

// ── Helper — call this from other controllers to fire a notification ──
// Usage: await createNotification(tx_or_prisma, { userId, type, message, link })
export const createNotification = async (db, { userId, type, message, link }) => {
  try {
    await db.notification.create({
      data: { userId, type, message, link: link || null },
    });
  } catch {
    // Never let a notification failure break the main operation
  }
};

// ── GET /api/notifications ─────────────────────────────────────
// Returns unread notifications for the current user (max 30).
export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    30,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/notifications/read-all ───────────────────────────
// Mark all as read.
export const markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data:  { read: true },
    });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("markAllRead error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/notifications/:id/read ───────────────────────────
export const markOneRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      data:  { read: true },
    });
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("markOneRead error:", error);
    res.status(500).json({ message: "Server error" });
  }
};