import express from "express";
import multer  from "multer";
import { registerUser, loginUser, getMe, updateProfile } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Multer — memory storage for Cloudinary upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 3 * 1024 * 1024 },  // 3MB max for avatars
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

router.post("/register", registerUser);
router.post("/login",    loginUser);
router.get ("/me",       protect, getMe);
router.put ("/me",       protect, upload.single("avatar"), updateProfile);

export default router;