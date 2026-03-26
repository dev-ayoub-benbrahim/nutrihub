import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  likeRecipe,
  unlikeRecipe,
  getRecipeLikes,
  saveRecipe,
  unsaveRecipe,
  getUserSaves,
  addComment,
  deleteComment,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/Social.controller.js";

const router = express.Router();

// Likes
router.post  ("/recipes/:id/like",    protect, likeRecipe);
router.delete("/recipes/:id/like",    protect, unlikeRecipe);
router.get   ("/recipes/:id/likes",            getRecipeLikes);  // public

// Saves
router.post  ("/recipes/:id/save",    protect, saveRecipe);
router.delete("/recipes/:id/save",    protect, unsaveRecipe);
router.get   ("/users/:id/saves",              getUserSaves);    // public — profile page

// Comments
router.post  ("/recipes/:id/comments",         protect, addComment);
router.delete("/comments/:commentId",          protect, deleteComment);

// Follows
router.post  ("/users/:id/follow",    protect, followUser);
router.delete("/users/:id/follow",    protect, unfollowUser);
router.get   ("/users/:id/followers",          getFollowers);    // public
router.get   ("/users/:id/following",          getFollowing);    // public

export default router;