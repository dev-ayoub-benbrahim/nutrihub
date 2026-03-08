import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import rateLimit from "express-rate-limit"
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173", 
  credentials: true,
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requests per window per IP
  message: { message: "Too many requests, please try again later" },
});
app.use(limiter);

// Routes
app.use("/api/auth", authRoutes)

app.get("/", (req, res) => {
  res.json({ message: "NutriHub API is running" });
});

//404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

//Error handler
app.use((err, req, res, next) =>{
  console.error(err.stack)
  res.status(500).json({message: "Something went wrong"})
})


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`NutriHub API running on port ${PORT}`));