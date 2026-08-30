// Express API router for RESQ physical routing engine

import express from "express";
import { calculateRoute } from "../services/routing/valhallaService.js";
import { checkValhallaHealth } from "../services/routing/valhallaHealthService.js";
import { evaluateRouteRisk } from "../services/routing/routeRiskService.js";

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

// Compute physical route and evaluate 500m grid risk profile
router.post("/", async (req, res) => {
  try {
    const {
      origin,
      destination,
      mode = "fastest",
      vehicle = "car",
      units = "kilometers",
      alternatives = 2,
    } = req.body || {};

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request must include both 'origin' and 'destination' objects or coordinate arrays.",
        },
      });
    }

    const routeResult = await calculateRoute({
      origin,
      destination,
      mode,
      vehicle,
      units,
      alternatives,
    });

    // Enrich primary route with PostGIS 500m grid risk evaluation
    if (routeResult.success && routeResult.route?.geometry) {
      try {
        const riskEval = await evaluateRouteRisk(routeResult.route.geometry);
        routeResult.route.riskScore = riskEval.riskSnapshot.meanRisk;
        routeResult.route.riskStatus = riskEval.riskSnapshot.routeStatus;
        routeResult.route.isBlocked = riskEval.riskSnapshot.isBlocked;
        routeResult.route.riskSnapshot = riskEval.riskSnapshot;
        routeResult.route.hazards = riskEval.hazards;
        routeResult.route.routeGridIds = riskEval.routeGridIds;
        routeResult.route.totalGrids = riskEval.totalGrids;
      } catch (riskErr) {
        console.warn("Route risk evaluation warning:", riskErr.message);
      }
    }

    // Enrich alternative routes if returned
    if (routeResult.success && Array.isArray(routeResult.alternatives)) {
      for (const alt of routeResult.alternatives) {
        if (alt.geometry) {
          try {
            const altRisk = await evaluateRouteRisk(alt.geometry);
            alt.riskScore = altRisk.riskSnapshot.meanRisk;
            alt.riskStatus = altRisk.riskSnapshot.routeStatus;
            alt.isBlocked = altRisk.riskSnapshot.isBlocked;
            alt.riskSnapshot = altRisk.riskSnapshot;
          } catch (e) {
            console.warn("Alt risk evaluation warning:", e.message);
          }
        }
      }
    }

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
