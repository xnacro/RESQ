import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./config/db.js";
import gridRoutes from "./routes/gridRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";
import riskRoutes from "./routes/riskRoutes.js";
import geocodeRoutes from "./routes/geocodeRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import damageRoutes from "./routes/damageRoutes.js";
import { initializeUserSchema } from "./models/userModel.js";
import { startNewsScheduler } from "./services/news/newsSchedulerService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/", (req, res) => {
  res.send("RESQ API is running...");
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/damage", damageRoutes);
app.use("/api/grid", gridRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/routes", routeRoutes);

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // Initialize authentication schema and demo users
  await initializeUserSchema();
  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");

    // Start background news ingestion cron if enabled in environment
    if (process.env.ENABLE_NEWS_CRON === "true") {
      const cronInterval = parseInt(process.env.NEWS_CRON_INTERVAL_MINUTES || "15", 10);
      startNewsScheduler(cronInterval, false);
    }
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
});

export default app;