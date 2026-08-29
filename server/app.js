import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./config/db.js";
import gridRoutes from "./routes/gridRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";

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

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
});

export default app;