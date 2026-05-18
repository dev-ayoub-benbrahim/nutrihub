import express from "express";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { getUserById, searchUsers, getSuggestedUsers } from "../controllers/User.controller.js";

const router = express.Router();

// Routes ordered so specific paths are matched before /:id
router.get("/search",    searchUsers);              // GET /api/users/search?q=term
router.get("/suggested", optionalAuth, getSuggestedUsers);         // GET /api/users/suggested
router.get("/:id",       getUserById);               // GET /api/users/:id

export default router;