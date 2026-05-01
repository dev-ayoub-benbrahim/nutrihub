import express from "express";
import multer from "multer"; // npm install multer
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  getUserRecipes,
} from "../controllers/recipe.controller.js";
import { protect, optionalAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// ─── Multer Config ────────────────────────────────────────────────
// Why memoryStorage: we don't want to write files to disk on the server.
// We receive the buffer and stream it directly to Cloudinary.
// This is more efficient and works well on cloud hosting (Render)
// where the filesystem is ephemeral anyway.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// ─── Routes ───────────────────────────────────────────────────────

// Public routes — optionalAuth so req.user is set when logged in
// This enables isLiked / isSaved flags without requiring login
router.get("/",              optionalAuth, getRecipes);
router.get("/user/:userId",  getUserRecipes);
router.get("/:id",           optionalAuth, getRecipeById);

// Protected routes — login required
router.post(  "/",    protect, upload.single("image"), createRecipe);
router.put(   "/:id", protect, upload.single("image"), updateRecipe);
router.delete("/:id", protect,                         deleteRecipe);

export default router;