import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { createReport, createExpertRequest } from "../controllers/report.controller.js";

const router = express.Router();

router.post("/",                protect, createReport);
router.post("/expert-requests", protect, createExpertRequest);

export default router;