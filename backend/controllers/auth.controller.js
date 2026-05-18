import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import prisma from "../lib/prisma.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadAvatar = (buffer) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "nutrihub/avatars", transformation: [{ width: 400, height: 400, crop: "fill" }] },
      (err, result) => (err ? reject(err) : resolve(result))
    ).end(buffer);
  });

const safeUserSelect = {
  id: true, name: true, email: true, role: true,
  bio: true, avatarURL: true, specialisation: true,
  calorieTarget: true, goal: true, restrictions: true, cuisinePrefs: true, createdAt: true,
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: safeUserSelect,
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.status(201).json({ user, token });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "24h" });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: safeUserSelect });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, bio, calorieTarget, goal, restrictions, specialisation, cuisinePrefs } = req.body;

    const validGoals = ["LOSE_WEIGHT", "MAINTAIN", "BUILD_MUSCLE", "EAT_HEALTHIER"];
    if (goal && !validGoals.includes(goal))
      return res.status(400).json({ message: `Invalid goal. Must be one of: ${validGoals.join(", ")}` });

    // Handle avatar upload if file was sent
    let avatarURL;
    if (req.file) {
      const result = await uploadAvatar(req.file.buffer);
      avatarURL = result.secure_url;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name           && { name }),
        ...(bio            !== undefined && { bio }),
        ...(calorieTarget  && { calorieTarget: parseInt(calorieTarget) }),
        ...(goal           && { goal }),
        ...(restrictions   && { restrictions }),
        ...(cuisinePrefs   && { cuisinePrefs }),
        ...(specialisation !== undefined && { specialisation }),
        ...(avatarURL      && { avatarURL }),
      },
      select: safeUserSelect,
    });

    res.json(user);
  } catch (error) {
    console.error("UpdateProfile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/auth/me ───────────────────────────────────────
// Permanently delete the current user's account and all their data.
// Cascades via Prisma onDelete: Cascade to recipes, likes, follows etc.
export const deleteAccount = async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: "Account permanently deleted" });
  } catch (error) {
    console.error("deleteAccount error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/auth/password ────────────────────────────────────
// Change password — requires current password for verification.
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Current and new password are required" });

    if (newPassword.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters" });

    if (currentPassword === newPassword)
      return res.status(400).json({ message: "New password must be different from current password" });

    // Fetch user with password hash
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { password: hashed },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/auth/email ───────────────────────────────────────
// Change email — requires password verification.
export const changeEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password)
      return res.status(400).json({ message: "New email and password are required" });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail))
      return res.status(400).json({ message: "Invalid email address" });

    // Check email not already taken
    const existing = await prisma.user.findUnique({ where: { email: newEmail.toLowerCase() } });
    if (existing)
      return res.status(409).json({ message: "That email is already in use" });

    // Verify password
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Password is incorrect" });

    await prisma.user.update({
      where: { id: req.user.id },
      data:  { email: newEmail.toLowerCase() },
    });

    res.json({ message: "Email updated successfully" });
  } catch (error) {
    console.error("changeEmail error:", error);
    res.status(500).json({ message: "Server error" });
  }
};