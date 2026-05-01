import express from "express";
import { getUserById, searchUsers } from "../controllers/User.controller.js";

const router = express.Router();

// Both routes are public — user profiles are visible to anyone
router.get("/search", searchUsers);   // GET /api/users/search?q=term
router.get("/:id",    getUserById);   // GET /api/users/:id

export default router;