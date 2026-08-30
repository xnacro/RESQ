// Location Geocoding & Regional Gazetteer Search Route
// Exposes clean RESQ geocoding endpoints backed by resqGeocoderService
import express from "express";
import resqGeocoderService from "../services/geocoding/resqGeocoderService.js";

const router = express.Router();

// GET /api/geocode/reverse?lat=26.1445&lon=91.7362 - Reverse geocodes coordinates to human-readable locality and containing 500m grid cell ID
router.get("/reverse", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: "Valid numeric 'lat' and 'lon' query parameters are required.",
      });
    }

    const result = await resqGeocoderService.reverseGeocode(lat, lon);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/geocode?q=<query> - Search places, districts, towns, rivers, highways, bridges, and 500m grid cells
router.get("/", async (req, res) => {
  try {
    const rawQuery = (req.query.q || "").trim();
    if (!rawQuery) {
      return res.status(400).json({
        success: false,
        error: "Query parameter 'q' must not be empty.",
      });
    }

    const result = await resqGeocoderService.forwardGeocode(rawQuery);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
