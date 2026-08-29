import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./config/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    res.send("Server is running");
});

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