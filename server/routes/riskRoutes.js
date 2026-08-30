// Express Router for Risk Intelligence & Explainability API
import express from "express";
import {
  getDynamicRiskBreakdown,
  recomputeGridsFromActiveEvents,
  expireStaleEvents,
} from "../services/risk/dynamicRiskService.js";

const router = express.Router();

// GET /api/risk/point?lat=26.1445&lon=91.7362 - Real-time point-to-grid risk lookup with geometry
router.get("/point", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: "Valid numeric 'lat' and 'lon' query parameters are required.",
      });
    }

    // 1. Spatial point lookup using PostGIS ST_Contains (Assam first, then Meghalaya)
    let cell = null;
    const client = await (await import("../config/db.js")).default.connect();

    try {
      const asRes = await client.query(
        `SELECT grid_id, state, district, block, center_lat, center_lon,
                ST_AsGeoJSON(geom)::json AS geometry
         FROM grid_500m.assam
         WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
         LIMIT 1;`,
        [lon, lat]
      );

      if (asRes.rows.length > 0) {
        cell = asRes.rows[0];
      } else {
        const mlRes = await client.query(
          `SELECT grid_id, state, district, block, center_lat, center_lon,
                  ST_AsGeoJSON(geom)::json AS geometry
           FROM grid_500m.meghalaya
           WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           LIMIT 1;`,
          [lon, lat]
        );
        if (mlRes.rows.length > 0) {
          cell = mlRes.rows[0];
        }
      }
    } finally {
      client.release();
    }

    if (!cell) {
      return res.status(404).json({
        success: false,
        inCoverage: false,
        message: "Location is outside RESQ operational coverage area (Assam & Meghalaya).",
      });
    }

    // 2. Fetch complete risk breakdown and active events
    const breakdown = await getDynamicRiskBreakdown(cell.grid_id);

    return res.status(200).json({
      success: true,
      inCoverage: true,
      data: {
        ...breakdown,
        geometry: cell.geometry,
        block: cell.block,
      },
    });
  } catch (error) {
    console.error("Point risk lookup error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/risk/grid/:gridId - Get detailed static and dynamic risk breakdown with active evidence
router.get("/grid/:gridId", async (req, res) => {
  try {
    const { gridId } = req.params;
    const breakdown = await getDynamicRiskBreakdown(gridId);

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        error: `Grid cell ${gridId} not found in Assam or Meghalaya risk grid`,
      });
    }

    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/risk/recompute - Targeted recomputation of dynamic risk for specified grid IDs
router.post("/recompute", async (req, res) => {
  try {
    const { gridIds = [], state = "Assam" } = req.body;
    if (!Array.isArray(gridIds) || gridIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "gridIds array must be provided with at least one grid_id",
      });
    }

    const result = await recomputeGridsFromActiveEvents(gridIds, state);
    res.json({
      success: true,
      message: `Recomputed dynamic risk for ${result.updatedCount} grid cells`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/risk/expire - Trigger on-demand stale event expiration and dynamic risk decay
router.post("/expire", async (req, res) => {
  try {
    const result = await expireStaleEvents();
    res.json({
      success: true,
      message: `Expired ${result.expiredEventsCount} events and recalibrated ${result.affectedGridsCount} grid cells`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
