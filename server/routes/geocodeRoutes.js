// Location Geocoding & Regional Gazetteer Search Route
// Resolves user search queries to normalized coordinates in Assam & Meghalaya using composite geocoding pipeline

import express from "express";
import { forwardGeocode, reverseGeocode } from "../services/geocoding/resqGeocoderService.js";

const router = express.Router();

// GET /api/geocode/reverse?lat=26.1445&lon=91.7362 - Reverse geocoding to locality, district, and PostGIS grid ID
router.get("/reverse", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat ?? req.query.latitude);
    const lon = parseFloat(req.query.lon ?? req.query.lng ?? req.query.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: "Valid numeric 'lat' and 'lon' query parameters are required.",
      });
    }

    const result = await reverseGeocode(lat, lon);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Reverse geocoding route error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/geocode?q=<query> - Search places, districts, towns, stations, bridges, and grid cells
router.get("/", async (req, res) => {
  try {
    const rawQuery = (req.query.q || req.query.query || "").trim();
    if (!rawQuery) {
      return res.status(400).json({
        success: false,
        error: "Query parameter 'q' must not be empty.",
      });
    }

    const result = await forwardGeocode(rawQuery);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Geocoding search route error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
