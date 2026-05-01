import express from "express";
import multer  from "multer";
import { protect, optionalAuth } from "../middleware/auth.middleware.js";
import {
  getCommunities,
  updateCommunity,
  kickMember,
  getCommunityById,
  getCommunityRecipes,
  shareRecipeToCommunity,
  removeRecipeFromCommunity,
  getCommunityPosts,
  createCommunityPost,
  deleteCommunityPost,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  deleteCommunity,
  getPostComments,
  addPostComment,
  deletePostComment,
  getCommunityFeed,
} from "../controllers/community.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public (with optional auth for isMember flag)
router.get("/"   , optionalAuth, getCommunities);
router.get("/:id", optionalAuth, getCommunityById);

// Recipe feed
router.get   ("/:id/recipes",            optionalAuth, getCommunityRecipes);
router.post  ("/:id/recipes",            protect,      shareRecipeToCommunity);
router.delete("/:id/recipes/:recipeId",  protect,      removeRecipeFromCommunity);

// Discussion
router.get   ("/:id/posts",          optionalAuth, getCommunityPosts);
router.post  ("/:id/posts",          protect, upload.single("image"), createCommunityPost);
router.delete("/:id/posts/:postId",  protect,      deleteCommunityPost);

// Post comments
router.get   ("/:id/posts/:postId/comments",             optionalAuth, getPostComments);
router.post  ("/:id/posts/:postId/comments",             protect,      addPostComment);
router.delete("/:id/posts/:postId/comments/:commentId",  protect,      deletePostComment);

// Unified feed
router.get("/:id/feed", optionalAuth, getCommunityFeed);

// Membership
router.post  ("/",          protect, createCommunity);
router.post  ("/:id/join",  protect, joinCommunity);
router.delete("/:id/leave", protect, leaveCommunity);
router.delete("/:id",               protect, deleteCommunity);
router.put   ("/:id",               protect, updateCommunity);
router.delete("/:id/members/:userId", protect, kickMember);

export default router;