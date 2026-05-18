import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { generate, getUserPlans, getPlanById, deletePlan, swapMeal } from "../controllers/mealPlan.controller.js";

const router = express.Router();

router.post  ("/generate", protect, generate);
router.get   ("/",         protect, getUserPlans);
router.get   ("/:id",      protect, getPlanById);
router.delete("/:id",      protect, deletePlan);

router.post("/swap", protect, swapMeal);

export default router;