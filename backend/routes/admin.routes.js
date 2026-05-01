import express from "express";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  getStats,
  getReports,
  resolveReport,
  getExpertRequests,
  reviewExpertRequest,
  getUsers,
  updateUserRole,
} from "../controllers/admin.controller.js";

const router = express.Router();

// All admin routes require ADMIN role
router.use(protect, restrictTo("ADMIN"));

router.get("/stats",                    getStats);
router.get("/reports",                  getReports);
router.put("/reports/:id/resolve",      resolveReport);
router.get("/expert-requests",          getExpertRequests);
router.put("/expert-requests/:id",      reviewExpertRequest);
router.get("/users",                    getUsers);
router.put("/users/:id/role",           updateUserRole);

export default router;