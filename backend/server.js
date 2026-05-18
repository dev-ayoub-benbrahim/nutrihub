import express         from "express";
import cors            from "cors";
import dotenv          from "dotenv";
import rateLimit       from "express-rate-limit";
import authRoutes          from "./routes/auth.routes.js";
import recipeRoutes        from "./routes/Recipe.routes.js";
import socialRoutes        from "./routes/Social.routes.js";
import communityRoutes     from "./routes/community.routes.js";
import userRoutes          from "./routes/user.routes.js";
import notificationRoutes  from "./routes/notification.routes.js";
import reportRoutes        from "./routes/report.routes.js";
import adminRoutes         from "./routes/admin.routes.js";
import expertRoutes        from "./routes/expert.routes.js";
import mealPlanRoutes      from "./routes/mealPlan.routes.js";

dotenv.config();

const app    = express();
const isProd = process.env.NODE_ENV === "production";

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isProd ? 1000 : 2000,
  message:  { message: "Too many requests, please try again later" },
  skip:     (req) => !isProd && req.path === "/api/auth/me",
}));

app.use("/api/auth",          authRoutes);
app.use("/api/recipes",       recipeRoutes);
app.use("/api/social",        socialRoutes);
app.use("/api/communities",   communityRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports",       reportRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/expert",        expertRoutes);
app.use("/api/meal-plans",    mealPlanRoutes);

app.get("/", (req, res) => res.json({ message: "NutriHub API is running ✅" }));
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ message: "Something went wrong" }); });

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`NutriHub API running on port ${PORT} [${isProd ? "production" : "development"}]`));
// Extend timeout to 3 minutes for AI meal plan generation (default 30s kills the pipeline)
server.setTimeout(180000);