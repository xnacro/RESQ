// Express API router for RESQ physical routing engine

import express from "express";
import { calculateRoute } from "../services/routing/valhallaService.js";
import { checkValhallaHealth } from "../services/routing/valhallaHealthService.js";

const router = express.Router();

// Health check endpoint for routing engine status
router.get("/health", async (req, res) => {
  try {
    const health = await checkValhallaHealth();
    res.status(health.healthy ? 200 : 503).json({
      success: health.healthy,
      data: health,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error.message,
      },
    });
  }
});

// Compute physical route between origin and destination
router.post("/", async (req, res) => {
  try {
    const { origin, destination, mode = "fastest", vehicle = "car", alternatives = 2 } = req.body || {};

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request must include both 'origin' and 'destination' objects with 'lat' and 'lon'.",
        },
      });
    }

    const routeResult = await calculateRoute({
      origin,
      destination,
      mode,
      vehicle,
      alternatives,
    });

    return res.status(200).json(routeResult);
  } catch (error) {
    const statusCode = error.status || 500;
    const errorCode = error.code || "ROUTING_ERROR";

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message,
        details: error.details,
      },
    });
  }
});

export default router;
