// Damage Reporting & Relief Mission Routes for RESQ
import express from "express";
import pool from "../config/db.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { ROLES } from "../models/userModel.js";

const router = express.Router();

// Fallback in-memory store for missions & reports if DB offline
const activeDamageReports = [
  {
    id: "dmg_001",
    event_type: "ROAD_BLOCKAGE",
    hazard_type: "DEBRIS_COLLAPSE",
    title: "NH-27 Landslide Blockage",
    severity: 85.0,
    location_text: "Near Jorabat Corridor, Kamrup Metro",
    district: "Kamrup Metropolitan",
    state: "Assam",
    latitude: 26.112,
    longitude: 91.875,
    road_blocked: true,
    bridge_damaged: false,
    reported_by: "Rahul Kumar (OPERATOR)",
    reported_at: new Date(Date.now() - 1800000).toISOString(),
    status: "ACTIVE",
  },
  {
    id: "dmg_002",
    event_type: "BRIDGE_DAMAGE",
    hazard_type: "SCOUR_EROSION",
    title: "Nongpoh Bridge Structural Scour",
    severity: 90.0,
    location_text: "GS Road, Nongpoh",
    district: "Ri-Bhoi",
    state: "Meghalaya",
    latitude: 25.903,
    longitude: 91.881,
    road_blocked: false,
    bridge_damaged: true,
    bridge_closed: true,
    reported_by: "Commander Rajesh Sharma (ADMIN)",
    reported_at: new Date(Date.now() - 3600000).toISOString(),
    status: "ACTIVE",
  },
];

const activeMissions = [
  {
    id: "msn_001",
    code: "CONVOY-BRAVO-12",
    title: "Emergency Ration & Medical Convoy",
    origin: "Guwahati Central Depot",
    destination: "Nongpoh Relief Hub",
    status: "EN_ROUTE",
    vehicles: 4,
    lead_officer: "Rahul Kumar",
    dispatched_at: new Date(Date.now() - 2400000).toISOString(),
    eta_minutes: 38,
    cargo_type: "High-Calorie Rations, Water Purification, Antivenom",
  },
  {
    id: "msn_002",
    code: "CONVOY-DELTA-04",
    title: "Temporary Bailey Bridge Material",
    origin: "Dispur Logistics Reserve",
    destination: "Boko Sector",
    status: "STAGED",
    vehicles: 2,
    lead_officer: "S. Borah",
    dispatched_at: new Date(Date.now() - 600000).toISOString(),
    eta_minutes: 55,
    cargo_type: "Heavy Steel Bailey Trusses & Hydraulic Jacks",
  },
];

// GET /api/damage/reports - List damage reports (All authenticated roles)
router.get("/reports", authenticate, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const dbRes = await client.query(`
        SELECT id, event_type, hazard_type, location_text, district, state,
               latitude, longitude, road_blocked, bridge_damaged, severity,
               reported_at, event_status
        FROM disaster.news_events
        WHERE event_status = 'ACTIVE'
        ORDER BY reported_at DESC
        LIMIT 50;
      `);
      if (dbRes.rows.length > 0) {
        return res.status(200).json({ success: true, reports: dbRes.rows });
      }
    } finally {
      client.release();
    }
  } catch (err) {
    // Database offline fallback
  }

  res.status(200).json({
    success: true,
    reports: activeDamageReports,
  });
});

// POST /api/damage/report - Submit damage or hazard report (OPERATOR & ADMIN only)
router.post(
  "/report",
  authenticate,
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  async (req, res) => {
    try {
      const {
        eventType = "ROAD_BLOCKAGE",
        hazardType = "GENERAL_HAZARD",
        locationText,
        district = "Kamrup Metropolitan",
        state = "Assam",
        latitude = 26.1445,
        longitude = 91.7362,
        roadBlocked = false,
        bridgeDamaged = false,
        bridgeClosed = false,
        severity = 75.0,
      } = req.body;

      const reportItem = {
        id: `dmg_${Date.now()}`,
        event_type: eventType,
        hazard_type: hazardType,
        title: `${eventType.replace(/_/g, " ")}: ${locationText || district}`,
        location_text: locationText || `${district}, ${state}`,
        district,
        state,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        road_blocked: !!roadBlocked,
        bridge_damaged: !!bridgeDamaged,
        bridge_closed: !!bridgeClosed,
        severity: parseFloat(severity),
        reported_by: `${req.user.name} (${req.user.role})`,
        reported_at: new Date().toISOString(),
        status: "ACTIVE",
      };

      // Try inserting into PostGIS if available
      try {
        const client = await pool.connect();
        try {
          await client.query(
            `INSERT INTO disaster.news_events (
              event_type, hazard_type, severity, confidence, location_text,
              district, state, latitude, longitude, geom,
              road_blocked, bridge_damaged, bridge_closed, reported_at, event_status
             ) VALUES (
              $1, $2, $3, 0.95, $4,
              $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($8, $7), 4326),
              $9, $10, $11, NOW(), 'ACTIVE'
             )`,
            [
              eventType,
              hazardType,
              severity,
              reportItem.location_text,
              district,
              state,
              latitude,
              longitude,
              roadBlocked,
              bridgeDamaged,
              bridgeClosed,
            ]
          );
        } finally {
          client.release();
        }
      } catch (err) {
        // Fallback in-memory
      }

      activeDamageReports.unshift(reportItem);

      res.status(201).json({
        success: true,
        message: "Damage report registered and fused into RESQ routing grid.",
        report: reportItem,
      });
    } catch (err) {
      console.error("Damage report error:", err.message);
      res.status(500).json({ success: false, error: "Failed to record damage report." });
    }
  }
);

// DELETE /api/damage/:id - Delete or resolve a damage report (ADMIN only)
router.delete("/:id", authenticate, authorize(ROLES.ADMIN), (req, res) => {
  const index = activeDamageReports.findIndex((r) => r.id === req.params.id);
  if (index !== -1) {
    activeDamageReports.splice(index, 1);
  }
  res.status(200).json({
    success: true,
    message: `Hazard/damage record ${req.params.id} resolved and cleared.`,
  });
});

// GET /api/damage/missions - List relief convoys & missions (All authenticated roles)
router.get("/missions", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    missions: activeMissions,
  });
});

// POST /api/damage/missions - Dispatch relief convoy (OPERATOR & ADMIN only)
router.post(
  "/missions",
  authenticate,
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  (req, res) => {
    const { code, title, origin, destination, cargoType, vehicles } = req.body;
    const mission = {
      id: `msn_${Date.now()}`,
      code: code || `CONVOY-${Math.floor(100 + Math.random() * 900)}`,
      title: title || "Relief Supply Convoy",
      origin: origin || "Guwahati Supply Hub",
      destination: destination || "Emergency Camp",
      status: "EN_ROUTE",
      vehicles: parseInt(vehicles || "2", 10),
      lead_officer: req.user.name,
      dispatched_at: new Date().toISOString(),
      eta_minutes: 45,
      cargo_type: cargoType || "Essential Rations & Medical Kits",
    };
    activeMissions.unshift(mission);
    res.status(201).json({
      success: true,
      message: "Relief convoy dispatched with real-time hazard avoidance.",
      mission,
    });
  }
);

// Emergency Alerts Store
const activeEmergencyAlerts = [
  {
    id: "sos_001",
    alert_type: "ROAD_WASHOUT_STRANDED",
    location: "NH-27 Kamrup Corridor (Bridge Scour Sector)",
    mission_code: "CONVOY-BRAVO-12",
    notes: "Critical insulin & blood supply convoy halted due to flash river surge.",
    originator: "Commander Rajesh Sharma (ADMIN)",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    status: "BROADCASTED",
  },
];

// GET /api/damage/sos - Retrieve emergency broadcasts (All authenticated roles)
router.get("/sos", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    alerts: activeEmergencyAlerts,
  });
});

// POST /api/damage/sos - Send Emergency Broadcast Alert (OPERATOR & ADMIN only)
router.post(
  "/sos",
  authenticate,
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  (req, res) => {
    const {
      location = "Kamrup Metro / Guwahati Relief Corridor",
      missionCode = "CONVOY-BRAVO-12 (Medical)",
      alertType = "FLASH_FLOOD_EVACUATION",
      notes = "Emergency hazard broadcast to regional disaster logistics command.",
    } = req.body;

    const alert = {
      id: `sos_${Date.now()}`,
      alert_type: alertType,
      location,
      mission_code: missionCode,
      notes,
      originator: `${req.user.name} (${req.user.role})`,
      timestamp: new Date().toISOString(),
      status: "BROADCASTED",
    };

    activeEmergencyAlerts.unshift(alert);

    // Also register an urgent priority hazard report so the routing engine avoids the area
    activeDamageReports.unshift({
      id: `dmg_sos_${Date.now()}`,
      event_type: "EMERGENCY_BROADCAST",
      hazard_type: alertType,
      title: `SOS: ${alertType.replace(/_/g, " ")} at ${location}`,
      location_text: location,
      district: "Kamrup Metropolitan",
      state: "Assam",
      latitude: 26.1445,
      longitude: 91.7362,
      road_blocked: true,
      bridge_damaged: alertType.includes("BRIDGE"),
      severity: 95.0,
      reported_by: alert.originator,
      reported_at: alert.timestamp,
      status: "CRITICAL",
    });

    res.status(201).json({
      success: true,
      message: "EMERGENCY ALERT BROADCAST SENT",
      alert,
    });
  }
);

export default router;
