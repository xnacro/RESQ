import express from "express";
import {
  generateGrids,
  getProcessingStatus,
  getGridByPoint,
  getIntersectingGrids,
} from "../controllers/gridController.js";

const router = express.Router();

// Administrative endpoint to generate 500m grids
router.post("/generate", generateGrids);

// Processing status
router.get("/status", getProcessingStatus);

// Spatial queries
router.get("/point", getGridByPoint);
router.post("/intersect", getIntersectingGrids);

export default router;
