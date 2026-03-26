import express from "express";
import multer from "multer"; 
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  getUserRecipes,
} from "../controllers/recipe.controller.js";
import { protect } from "../middleware/auth.middleware.js";
 
const router = express.Router();


const storage = multer.memoryStorage();
 
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});
 
 
// Public routes 
router.get("/",              getRecipes);        
router.get("/user/:userId",  getUserRecipes);    
router.get("/:id",           getRecipeById);     
 
// Protected routes 
router.post(  "/",    protect, upload.single("image"), createRecipe);
router.put(   "/:id", protect, upload.single("image"), updateRecipe);
router.delete("/:id", protect,                         deleteRecipe);
 
export default router;