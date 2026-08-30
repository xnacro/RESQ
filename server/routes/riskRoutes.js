// Express Router for Risk Intelligence & Explainability API
import express from "express";
import {
  getDynamicRiskBreakdown,
  recomputeGridsFromActiveEvents,
  expireStaleEvents,
} from "../services/risk/dynamicRiskService.js";

const router = express.Router();

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
