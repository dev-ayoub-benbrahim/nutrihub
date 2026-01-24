import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes)

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.listen(5000, () => console.log("Server running on port 5000"));
