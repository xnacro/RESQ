// Express API router for RESQ physical routing, risk evaluation, and live navigation monitoring

import express from "express";
import { calculateRoute } from "../services/routing/valhallaService.js";
import { checkValhallaHealth } from "../services/routing/valhallaHealthService.js";
import { evaluateRouteRisk } from "../services/routing/routeRiskService.js";
import { calculateSafeRoutePlan } from "../services/routing/riskAwareRoutingService.js";
import {
  registerActiveRouteSession,
  updateSessionProgress,
  getSessionMonitoringStatus,
  evaluateGridRiskUpdate,
  executeDynamicReroute,
  cleanupActiveSession,
} from "../services/routing/routeMonitorService.js";

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

    // Handle RESQ risk-aware safe routing mode
    if (mode === "safe") {
      const safeResult = await calculateSafeRoutePlan({
        origin,
        destination,
        mode: "safe",
        vehicle,
        units,
        alternatives: Math.max(3, alternatives),
      });
      return res.status(200).json(safeResult);
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

// Register active route session for live 500m grid risk monitoring
router.post("/monitor/register", async (req, res) => {
  try {
    const { sessionId, routeId, routeGeometry, origin, destination, vehicle } = req.body || {};
    if (!sessionId || !routeGeometry) {
      return res.status(400).json({ success: false, message: "Missing sessionId or routeGeometry" });
    }
    const result = await registerActiveRouteSession({
      sessionId,
      routeId,
      routeGeometry,
      origin,
      destination,
      vehicle,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Update vehicle GPS progress along route and trim completed grids
router.post("/monitor/progress", (req, res) => {
  try {
    const { sessionId, currentPosition, progressFraction } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Missing sessionId" });
    }
    const result = updateSessionProgress(sessionId, { currentPosition, progressFraction });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get current monitoring status and upcoming hazards for an active route session
router.get("/monitor/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = getSessionMonitoringStatus(sessionId);
    if (!status) {
      return res.status(404).json({ success: false, message: "Active session not found" });
    }
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Simulate a risk change on a grid ahead of active route for controlled browser validation
router.post("/monitor/simulate-risk", async (req, res) => {
  try {
    const { gridId, riskScore = 85.0, riskStatus = "CRITICAL", roadClosureRisk = 90.0 } = req.body || {};
    if (!gridId) {
      return res.status(400).json({ success: false, message: "Missing gridId parameter" });
    }
    const affected = await evaluateGridRiskUpdate(gridId, { riskScore, riskStatus, roadClosureRisk });
    return res.status(200).json({ success: true, affectedCount: affected.length, affectedSessions: affected });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Execute dynamic reroute from vehicle's current location to destination
router.post("/reroute", async (req, res) => {
  try {
    const { sessionId, currentPosition } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Missing sessionId parameter" });
    }
    const rerouteResult = await executeDynamicReroute(sessionId, currentPosition);
    return res.status(200).json(rerouteResult);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup active navigation monitoring session
router.delete("/monitor/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const cleaned = cleanupActiveSession(sessionId);
    return res.status(200).json({ success: true, cleaned });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
