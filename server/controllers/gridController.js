import gridService from "../services/gridService.js";
import pool from "../config/db.js";

// Trigger 500m grid generation for Assam and Meghalaya
// POST /api/grid/generate
// Body: { force?: boolean, state?: "Assam" | "Meghalaya" }
export const generateGrids = async (req, res) => {
  try {
    const { force = false, state } = req.body || {};

    let result;
    if (state) {
      const stateResult = await gridService.generateStateGrid(state, { force });
      result = { [state]: stateResult };
    } else {
      result = await gridService.generateAllStateGrids({ force });
    }

    // Format clean response conforming to requested format
    const formattedResult = {};
    for (const [key, val] of Object.entries(result)) {
      formattedResult[key] = {
        status: val.status,
        totalCells: val.totalCells,
        durationMs: val.durationMs,
      };
    }

    return res.status(200).json({
      success: true,
      result: formattedResult,
    });
  } catch (error) {
    console.error("Error in generateGrids controller:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get current processing status for all states
// GET /api/grid/status
export const getProcessingStatus = async (req, res) => {
  try {
    const statusRes = await pool.query(
      `SELECT state, grid_size_m, source_file, source_hash, status, total_cells, started_at, completed_at, error_message, updated_at 
       FROM grid_500m.processing_status 
       ORDER BY state ASC;`
    );

    return res.status(200).json({
      success: true,
      data: statusRes.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Point-in-grid spatial query
// GET /api/grid/point?lat=26.1445&lon=91.7362&state=Assam
export const getGridByPoint = async (req, res) => {
  try {
    const { lat, lon, state } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameters: 'lat' and 'lon'.",
      });
    }

    const grid = await gridService.getGridByPoint(parseFloat(lat), parseFloat(lon), state);
    if (!grid) {
      return res.status(404).json({
        success: false,
        message: "No grid cell found containing the specified coordinates.",
      });
    }

    return res.status(200).json({
      success: true,
      data: grid,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Disaster geometry spatial intersection query
// POST /api/grid/intersect
// Body: { geometry: GeoJSONGeometry, state?: "Assam" | "Meghalaya", limit?: number }
export const getIntersectingGrids = async (req, res) => {
  try {
    const { geometry, state = "Assam", limit = 100 } = req.body;
    if (!geometry) {
      return res.status(400).json({
        success: false,
        error: "Missing required 'geometry' object in request body.",
      });
    }

    const grids = await gridService.getGridsByGeometry(geometry, state, limit);
    return res.status(200).json({
      success: true,
      count: grids.length,
      data: grids,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export default {
  generateGrids,
  getProcessingStatus,
  getGridByPoint,
  getIntersectingGrids,
};
