import express from "express";
import multer  from "multer";
import { protect } from "../middleware/auth.middleware.js";
import { createReport, createExpertRequest } from "../controllers/report.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.post("/",                protect,                               createReport);
router.post("/expert-requests", protect, upload.single("credential"),  createExpertRequest);

export default router;