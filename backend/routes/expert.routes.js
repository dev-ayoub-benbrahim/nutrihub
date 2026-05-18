import express from "express";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  getExpertNote,
  upsertExpertNote,
  deleteExpertNote,
  markVerifiedAnswer,
  removeVerifiedAnswer,
} from "../controllers/expert.controller.js";

const router = express.Router();

// All routes require login + Expert or Admin role
const expertOnly = [protect, restrictTo("EXPERT", "ADMIN")];

// Expert notes on recipes
router.get   ("/recipes/:recipeId/note",    protect,    getExpertNote);     // public read
router.post  ("/recipes/:recipeId/note",    ...expertOnly, upsertExpertNote);
router.delete("/recipes/:recipeId/note",    ...expertOnly, deleteExpertNote);

// Verified answers on community posts
router.post  ("/communities/:communityId/posts/:postId/comments/:commentId/verify",
              ...expertOnly, markVerifiedAnswer);
router.delete("/communities/:communityId/posts/:postId/verify",
              ...expertOnly, removeVerifiedAnswer);

export default router;