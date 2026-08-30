// RESQ Mode Session Lifecycle, Live Risk Monitoring, Safety Timer, and Route Monitoring
import express from "express";
import crypto from "crypto";
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
import {
  broadcastSessionUpdate,
  broadcastRiskAlert,
  broadcastSosAlert,
} from "../services/socketService.js";
import {
  registerActiveRouteSession,
  updateSessionProgress,
  getSessionMonitoringStatus,
  executeDynamicReroute,
  cleanupActiveSession,
} from "../services/routing/routeMonitorService.js";

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
      broadcastSessionUpdate(existingActive.session_id, { type: "SESSION_ENDED" });
      cleanupActiveSession(existingActive.session_id);
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

    // Spatially resolve 500m grid cell via PostGIS ST_Contains (Assam first, then Meghalaya)
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

    // Fetch authoritative risk breakdown from RESQ dynamic risk engine
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

    // Detect Risk Category Transition & Escalation
    const prevStatus = session.risk_status || "LOW";
    const prevRank = RISK_STATUS_RANKS[prevStatus] || 1;
    const currentRank = RISK_STATUS_RANKS[riskStatus] || 1;
    const isEscalation = currentRank > prevRank;

    // Update session snapshot
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

    // Active Route Corridor Progress & Reroute Evaluation
    let routeMonitoring = null;
    try {
      const progressRes = updateSessionProgress(sessionId, [parsedLon, parsedLat]);
      if (progressRes.success) {
        routeMonitoring = getSessionMonitoringStatus(sessionId);
      }
    } catch (routeErr) {
      // Ignored if session is not currently navigating a route
    }

    // Broadcast Realtime Telemetry Update via Socket.IO
    broadcastSessionUpdate(sessionId, {
      type: "LOCATION_UPDATE",
      session: updatedSession,
      grid: {
        gridId,
        district: districtName,
        state: stateName,
        geometry: gridCell?.geometry || null,
      },
      risk: {
        riskScore,
        riskStatus,
        staticRisk,
        dynamicRisk,
      },
      activeEvents,
      routeMonitoring,
    });

    if (isEscalation) {
      broadcastRiskAlert(sessionId, {
        title: `Risk Escalated to ${riskStatus}`,
        reason: activeEvents[0]?.news_title || "Elevated hazard corridor detected",
        severity: riskScore,
        gridId,
      });
    }

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
      routeMonitoring,
    });
  } catch (err) {
    console.error("Failed to update session location:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error updating session location and risk",
    });
  }
});

// 3. User Safety Check-in (Resets countdown timer)
router.post("/checkin", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required for check-in",
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
        error: "Unauthorized to check-in for this session",
      });
    }

    if (!session.is_active) {
      return res.status(400).json({
        success: false,
        error: "Cannot check in to an inactive or ended session",
      });
    }

    const now = new Date();
    const timerMins = session.safety_timer_minutes || 30;
    const newExpiresAt = new Date(now.getTime() + timerMins * 60 * 1000);

    const updates = {
      last_checkin_at: now.toISOString(),
      timer_expires_at: newExpiresAt.toISOString(),
      status: "ACTIVE",
    };

    const updatedSession = await updateResqSession(sessionId, updates);

    // Broadcast Realtime Checkin Update
    broadcastSessionUpdate(sessionId, {
      type: "CHECKIN",
      session: updatedSession,
      timer_expires_at: newExpiresAt.toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Safety check-in verified successfully",
      sessionId,
      session: updatedSession,
      timer_expires_at: newExpiresAt.toISOString(),
      last_checkin_at: now.toISOString(),
    });
  } catch (err) {
    console.error("Safety check-in error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error performing safety check-in",
    });
  }
});

// 4. Update Safety Timer Interval / Extension
router.post("/timer/update", authenticate, async (req, res) => {
  try {
    const { sessionId, safetyTimerMinutes } = req.body;
    const userId = req.user.id;

    if (!sessionId || !safetyTimerMinutes) {
      return res.status(400).json({
        success: false,
        error: "Session ID and safety timer minutes are required",
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
        error: "Unauthorized to modify safety timer for this session",
      });
    }

    const parsedMins = parseInt(safetyTimerMinutes, 10);
    if (isNaN(parsedMins) || parsedMins <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid safety timer minutes provided",
      });
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + parsedMins * 60 * 1000);

    const updates = {
      safety_timer_minutes: parsedMins,
      timer_expires_at: newExpiresAt.toISOString(),
    };

    const updatedSession = await updateResqSession(sessionId, updates);

    // Broadcast Realtime Timer Extension
    broadcastSessionUpdate(sessionId, {
      type: "TIMER_UPDATE",
      session: updatedSession,
      timer_expires_at: newExpiresAt.toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Safety timer interval updated successfully",
      sessionId,
      session: updatedSession,
    });
  } catch (err) {
    console.error("Timer update error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error updating safety timer",
    });
  }
});

// 5. Trigger Emergency SOS Dispatch
router.post("/sos", authenticate, async (req, res) => {
  try {
    const { sessionId, emergencyType = "GENERAL_DISTRESS", notes = "" } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required to trigger SOS",
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
        error: "Unauthorized to trigger SOS for this session",
      });
    }

    const emergencyAlertId = crypto.randomUUID();
    const now = new Date();

    const emergencyMeta = {
      ...(session.metadata || {}),
      emergency: {
        alertId: emergencyAlertId,
        emergencyType,
        notes,
        triggeredAt: now.toISOString(),
        triggeredBy: req.user.name || "Personnel",
        lat: session.current_lat,
        lon: session.current_lon,
        gridId: session.current_grid_id,
        district: session.current_district,
        riskScore: session.risk_score,
      },
    };

    const updates = {
      status: "SOS",
      risk_status: "CRITICAL",
      emergency_alert_id: emergencyAlertId,
      metadata: emergencyMeta,
    };

    const updatedSession = await updateResqSession(sessionId, updates);

    // Broadcast Realtime SOS Alert to all listeners
    broadcastSosAlert(sessionId, {
      type: "SOS_TRIGGERED",
      alertId: emergencyAlertId,
      session: updatedSession,
    });

    return res.status(200).json({
      success: true,
      message: "EMERGENCY SOS DISPATCHED SUCCESSFULLY",
      alertId: emergencyAlertId,
      session: updatedSession,
    });
  } catch (err) {
    console.error("SOS dispatch error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error dispatching emergency SOS",
    });
  }
});

// 6. Cancel / Resolve Active Emergency SOS
router.post("/sos/cancel", authenticate, async (req, res) => {
  try {
    const { sessionId, reason = "False alarm / Resolved safely" } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required to cancel SOS",
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
        error: "Unauthorized to cancel SOS for this session",
      });
    }

    const now = new Date();
    const updatedMeta = {
      ...(session.metadata || {}),
      emergency_resolved_at: now.toISOString(),
      emergency_cancel_reason: reason,
    };

    const updates = {
      status: "ACTIVE",
      emergency_alert_id: null,
      metadata: updatedMeta,
    };

    const updatedSession = await updateResqSession(sessionId, updates);

    // Broadcast Realtime SOS Cancellation
    broadcastSosAlert(sessionId, {
      type: "SOS_CANCELLED",
      session: updatedSession,
    });

    return res.status(200).json({
      success: true,
      message: "Emergency SOS cancelled successfully",
      sessionId,
      session: updatedSession,
    });
  } catch (err) {
    console.error("SOS cancel error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error cancelling emergency SOS",
    });
  }
});

// 7. Attach Active Travel Route to Session for Corridor Risk Monitoring
router.post("/route/attach", authenticate, async (req, res) => {
  try {
    const { sessionId, origin, destination, routeGeometry, distanceM, durationS, routeId } = req.body;
    const userId = req.user.id;

    if (!sessionId || !origin || !destination || !routeGeometry) {
      return res.status(400).json({
        success: false,
        error: "Session ID, origin, destination, and route geometry are required",
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
        error: "Unauthorized to attach route to this session",
      });
    }

    const activeRouteId = routeId || `resq_nav_${Date.now()}`;

    // Register with route monitoring engine
    await registerActiveRouteSession({
      sessionId,
      routeId: activeRouteId,
      routeGeometry,
      origin,
      destination,
      vehicle: "car",
    });

    const routeMeta = {
      routeId: activeRouteId,
      origin,
      destination,
      distanceM,
      durationS,
      attachedAt: new Date().toISOString(),
    };

    const updates = {
      route_id: activeRouteId,
      metadata: {
        ...(session.metadata || {}),
        activeRoute: routeMeta,
      },
    };

    const updatedSession = await updateResqSession(sessionId, updates);

    // Broadcast Realtime Route Attachment
    broadcastSessionUpdate(sessionId, {
      type: "ROUTE_ATTACHED",
      route: routeMeta,
      session: updatedSession,
    });

    return res.status(200).json({
      success: true,
      message: "Active travel route attached to RESQ Mode session",
      sessionId,
      routeId: activeRouteId,
      session: updatedSession,
    });
  } catch (err) {
    console.error("Route attach error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error attaching navigation route",
    });
  }
});

// 8. Detach / Conclude Active Travel Route from Session
router.post("/route/detach", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
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
        error: "Unauthorized",
      });
    }

    cleanupActiveSession(sessionId);

    const updates = {
      route_id: null,
      metadata: {
        ...(session.metadata || {}),
        activeRoute: null,
      },
    };

    const updatedSession = await updateResqSession(sessionId, updates);

    broadcastSessionUpdate(sessionId, {
      type: "ROUTE_DETACHED",
      session: updatedSession,
    });

    return res.status(200).json({
      success: true,
      message: "Navigation route detached successfully",
      sessionId,
      session: updatedSession,
    });
  } catch (err) {
    console.error("Route detach error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error detaching route",
    });
  }
});

// 9. Execute Dynamic Corridor Reroute for Active Session
router.post("/route/reroute", authenticate, async (req, res) => {
  try {
    const { sessionId, currentPosition } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required to reroute",
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
        error: "Unauthorized",
      });
    }

    const pos = currentPosition || (session.current_lon && session.current_lat ? [session.current_lon, session.current_lat] : null);
    const reroutePlan = await executeDynamicReroute(sessionId, pos);

    if (reroutePlan.success && reroutePlan.newRoute) {
      const updates = {
        route_id: reroutePlan.routeId,
        metadata: {
          ...(session.metadata || {}),
          activeRoute: {
            routeId: reroutePlan.routeId,
            distanceM: reroutePlan.newRoute.distance,
            durationS: reroutePlan.newRoute.duration,
            reroutedAt: new Date().toISOString(),
          },
        },
      };
      await updateResqSession(sessionId, updates);

      broadcastSessionUpdate(sessionId, {
        type: "ROUTE_REROUTED",
        reroutePlan,
      });
    }

    return res.status(200).json(reroutePlan);
  } catch (err) {
    console.error("Session reroute error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error calculating alternate route",
    });
  }
});

// 10. Get Live Telemetry Snapshot for Authorized / Trusted Trackers (Public UUID URL)
router.get("/:sessionId/telemetry", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await findResqSessionById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Tracking session not found or link has expired",
      });
    }

    // Resolve geometry and active events for the session's grid
    let geometry = null;
    let activeEvents = [];

    if (session.current_grid_id) {
      try {
        const asRes = await pool.query(
          "SELECT ST_AsGeoJSON(geom)::json AS geometry FROM grid_500m.assam WHERE grid_id = $1 LIMIT 1",
          [session.current_grid_id]
        );
        if (asRes.rows.length > 0) {
          geometry = asRes.rows[0].geometry;
        }
      } catch (geomErr) {
        console.warn("Telemetry geometry lookup warning:", geomErr.message);
      }

      try {
        const breakdown = await getDynamicRiskBreakdown(session.current_grid_id);
        activeEvents = breakdown?.activeEvents || [];
      } catch (evErr) {
        console.warn("Telemetry active events lookup warning:", evErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      session: {
        sessionId: session.session_id,
        userName: session.user_name,
        status: session.status,
        isActive: session.is_active,
        isEmergency: session.status === "SOS" || Boolean(session.emergency_alert_id),
        startedAt: session.started_at,
        endedAt: session.ended_at,
        lastLocationAt: session.last_location_at,
        lastCheckinAt: session.last_checkin_at,
        safetyTimerMinutes: session.safety_timer_minutes,
        timerExpiresAt: session.timer_expires_at,
        lat: session.current_lat || 26.1445,
        lon: session.current_lon || 91.7362,
        accuracy: session.current_accuracy || 10,
        gridId: session.current_grid_id || "AS_00210744",
        district: session.current_district || "Kamrup Metropolitan",
        state: session.current_state || "Assam",
        riskScore: session.risk_score || 24.8,
        riskStatus: session.risk_status || "LOW",
        staticRisk: session.static_risk || 24.8,
        dynamicRisk: session.dynamic_risk || 0,
        riskConfidence: session.risk_confidence || 0.95,
        routeId: session.route_id,
        activeRoute: session.metadata?.activeRoute || null,
        emergency: session.metadata?.emergency || null,
      },
      geometry,
      activeEvents,
    });
  } catch (err) {
    console.error("Telemetry fetch error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error reading session telemetry",
    });
  }
});

// 11. Register Trusted Tracker Heartbeat
router.post("/:sessionId/track", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { trackerName = "Trusted Monitor" } = req.body;

    const session = await findResqSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Tracking session not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Tracker ${trackerName} registered for session ${sessionId}`,
      sessionStatus: session.status,
    });
  } catch (err) {
    console.error("Tracker heartbeat error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error registering tracker",
    });
  }
});

// 12. Stop / Deactivate an active RESQ Mode Session
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

    cleanupActiveSession(sessionId);
    const endedSession = await endResqSession(sessionId, session.user_id);

    // Broadcast Realtime Session Ended Update
    broadcastSessionUpdate(sessionId, {
      type: "SESSION_ENDED",
      session: endedSession,
    });

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

// 13. Get Active Session for the Authenticated User
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

// 14. Read Session Details by Session ID
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
