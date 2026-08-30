import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./config/db.js";
import gridRoutes from "./routes/gridRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";
import riskRoutes from "./routes/riskRoutes.js";
import geocodeRoutes from "./routes/geocodeRoutes.js";
import { startNewsScheduler } from "./services/news/newsSchedulerService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// Health check
app.get("/", (req, res) => {
  res.send("RESQ Server is running");
});

// API Routes
app.use("/api/grid", gridRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/geocode", geocodeRoutes);

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
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