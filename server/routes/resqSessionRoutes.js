// RESQ Mode Session Lifecycle and Live Risk Monitoring API Routes
import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  createResqSession,
  findResqSessionById,
  findActiveSessionByUserId,
  updateResqSession,
  endResqSession,
} from "../models/resqSessionModel.js";
import { getDynamicRiskBreakdown } from "../services/risk/dynamicRiskService.js";

const router = express.Router();

const RISK_STATUS_RANKS = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// 1. Start a new RESQ Mode Safety Session
router.post("/start", authenticate, async (req, res) => {
  try {
    const { safetyTimerMinutes = 30, trustedContacts = [], metadata = {} } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.fullName || "Field Personnel";
    const userMobile = req.user.mobile || null;

    // Check if user already has an active session
    const existingActive = await findActiveSessionByUserId(userId);
    if (existingActive) {
      // Auto-end the existing session and start a new clean session
      await endResqSession(existingActive.session_id, userId);
    }

    const session = await createResqSession({
      userId,
      userName,
      userMobile,
      safetyTimerMinutes: parseInt(safetyTimerMinutes, 10) || 30,
      trustedContacts,
      metadata,
    });

    const shareUrl = `/resq/track/${session.session_id}`;

    return res.status(201).json({
      success: true,
      message: "RESQ Mode session started successfully",
      sessionId: session.session_id,
      shareUrl,
      session,
    });
  } catch (err) {
    console.error("Failed to start RESQ session:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error starting RESQ Mode session",
    });
  }
});

// 2. Update Live GPS Location, Resolve 500m Grid, and Compute Authoritative Risk
router.post("/location", authenticate, async (req, res) => {
  try {
    const { sessionId, lat, lon, accuracy = 10, speed = 0, heading = 0 } = req.body;
    const userId = req.user.id;

    if (!sessionId || lat == null || lon == null) {
      return res.status(400).json({
        success: false,
        error: "Session ID, latitude, and longitude are required",
      });
    }

    const session = await findResqSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "RESQ Mode session not found",
      });
    }

    if (session.user_id !== userId && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to update location for this session",
      });
    }

    if (!session.is_active) {
      return res.status(400).json({
        success: false,
        error: "Cannot update location on an inactive or ended session",
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    // 1. Spatially resolve 500m grid cell via PostGIS ST_Contains (Assam first, then Meghalaya)
    let gridCell = null;
    try {
      const asRes = await pool.query(
        `SELECT grid_id, state, district, block, center_lat, center_lon,
                ST_AsGeoJSON(geom)::json AS geometry
         FROM grid_500m.assam
         WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
         LIMIT 1;`,
        [parsedLon, parsedLat]
      );

      if (asRes.rows.length > 0) {
        gridCell = asRes.rows[0];
      } else {
        const mlRes = await pool.query(
          `SELECT grid_id, state, district, block, center_lat, center_lon,
                  ST_AsGeoJSON(geom)::json AS geometry
           FROM grid_500m.meghalaya
           WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           LIMIT 1;`,
          [parsedLon, parsedLat]
        );
        if (mlRes.rows.length > 0) {
          gridCell = mlRes.rows[0];
        }
      }
    } catch (dbErr) {
      console.warn("PostGIS grid spatial lookup warning:", dbErr.message);
    }

    const gridId = gridCell?.grid_id || session.current_grid_id || "AS_00210744";
    const districtName = gridCell?.district || session.current_district || "Kamrup Metropolitan";
    const stateName = gridCell?.state || session.current_state || "Assam";

    // 2. Fetch authoritative risk breakdown from RESQ dynamic risk engine
    let riskBreakdown = null;
    try {
      riskBreakdown = await getDynamicRiskBreakdown(gridId);
    } catch (riskErr) {
      console.warn("Dynamic risk calculation warning:", riskErr.message);
    }

    const riskScore = riskBreakdown?.riskSummary?.riskScore ?? session.risk_score ?? 24.8;
    const riskStatus = riskBreakdown?.riskSummary?.riskStatus ?? session.risk_status ?? "LOW";
    const staticRisk = riskBreakdown?.riskSummary?.staticRisk ?? session.static_risk ?? 24.8;
    const dynamicRisk = riskBreakdown?.riskSummary?.dynamicRisk ?? session.dynamic_risk ?? 0;
    const riskConfidence = riskBreakdown?.riskSummary?.riskConfidence ?? session.risk_confidence ?? 0.95;
    const activeEvents = riskBreakdown?.activeEvents || [];
    const factorChannels = riskBreakdown?.dynamicFactorChannels || {};

    // 3. Detect Risk Category Transition & Escalation
    const prevStatus = session.risk_status || "LOW";
    const prevRank = RISK_STATUS_RANKS[prevStatus] || 1;
    const currentRank = RISK_STATUS_RANKS[riskStatus] || 1;
    const isEscalation = currentRank > prevRank;

    // 4. Update session snapshot
    const sessionUpdates = {
      current_lat: parsedLat,
      current_lon: parsedLon,
      current_accuracy: parseFloat(accuracy) || 10,
      current_grid_id: gridId,
      current_district: districtName,
      current_state: stateName,
      static_risk: staticRisk,
      dynamic_risk: dynamicRisk,
      risk_score: riskScore,
      risk_status: riskStatus,
      risk_confidence: riskConfidence,
      last_location_at: new Date().toISOString(),
    };

    const updatedSession = await updateResqSession(sessionId, sessionUpdates);

    return res.status(200).json({
      success: true,
      sessionId,
      session: updatedSession,
      grid: {
        gridId,
        district: districtName,
        state: stateName,
        block: gridCell?.block || "Guwahati",
        centerLat: gridCell?.center_lat || parsedLat,
        centerLon: gridCell?.center_lon || parsedLon,
        geometry: gridCell?.geometry || null,
        inCoverage: Boolean(gridCell),
      },
      risk: {
        riskScore,
        riskStatus,
        staticRisk,
        dynamicRisk,
        riskConfidence,
        factorChannels,
      },
      activeEvents,
      riskTransition: {
        previousStatus: prevStatus,
        currentStatus: riskStatus,
        isEscalation,
      },
    });
  } catch (err) {
    console.error("Failed to update session location:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error updating session location and risk",
    });
  }
});

// 3. Stop / Deactivate an active RESQ Mode Session
router.post("/stop", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required to end RESQ Mode",
      });
    }

    const session = await findResqSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "RESQ Mode session not found",
      });
    }

    if (session.user_id !== userId && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to stop this session",
      });
    }

    const endedSession = await endResqSession(sessionId, session.user_id);

    return res.status(200).json({
      success: true,
      message: "RESQ Mode session ended successfully",
      sessionId,
      session: endedSession,
    });
  } catch (err) {
    console.error("Failed to stop RESQ session:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error stopping RESQ Mode session",
    });
  }
});

// 4. Get Active Session for the Authenticated User
router.get("/active/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const activeSession = await findActiveSessionByUserId(userId);

    if (!activeSession) {
      return res.status(200).json({
        success: true,
        active: false,
        session: null,
      });
    }

    return res.status(200).json({
      success: true,
      active: true,
      session: activeSession,
      shareUrl: `/resq/track/${activeSession.session_id}`,
    });
  } catch (err) {
    console.error("Failed to retrieve active session:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error checking active session",
    });
  }
});

// 5. Read Session Details by Session ID
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await findResqSessionById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "RESQ Mode session not found",
      });
    }

    return res.status(200).json({
      success: true,
      session,
      shareUrl: `/resq/track/${session.session_id}`,
    });
  } catch (err) {
    console.error("Failed to fetch session details:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error retrieving session",
    });
  }
});

export default router;
