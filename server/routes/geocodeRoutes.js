// Location Geocoding & Regional Gazetteer Search Route
// Resolves user search queries to normalized coordinates in Assam & Meghalaya
import express from "express";
import pool from "../config/db.js";
import {
  DISTRICT_CENTROIDS,
  LOCALITY_GAZETTEER,
  REGIONAL_CORRIDORS,
  REGIONAL_RIVERS,
} from "../../nlp/location/nerLocationExtractor.js";

const router = express.Router();

// Corridor and bridge coordinate registry for Northeast India
const CORRIDOR_COORDINATES = Object.freeze({
  "NH-27": { lat: 26.1500, lon: 91.7000, state: "Assam" },
  "NH-6": { lat: 25.9000, lon: 91.8800, state: "Meghalaya" },
  "NH-37": { lat: 26.5000, lon: 93.0000, state: "Assam" },
  "NH-17": { lat: 26.1000, lon: 90.5000, state: "Assam" },
  "NH-217": { lat: 25.5000, lon: 90.2000, state: "Meghalaya" },
  "Saraighat Bridge": { lat: 26.1762, lon: 91.6917, state: "Assam" },
  "Kolia Bhomora Bridge": { lat: 26.6080, lon: 92.8620, state: "Assam" },
  "Bogibeel Bridge": { lat: 27.4000, lon: 94.9000, state: "Assam" },
  "Naranarayan Setu": { lat: 26.2167, lon: 90.5833, state: "Assam" },
  "Dhola-Sadiya Bridge": { lat: 27.7900, lon: 95.6600, state: "Assam" },
});

// Helper: Haversine distance in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/geocode/reverse?lat=26.1445&lon=91.7362 - Reverse geocoding to locality and district
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

    // 1. Find nearest town / locality in gazetteer
    let closestLocality = null;
    let minLocalityDist = Infinity;

    for (const item of LOCALITY_GAZETTEER) {
      const dist = getDistanceKm(lat, lon, item.lat, item.lon);
      if (dist < minLocalityDist) {
        minLocalityDist = dist;
        closestLocality = item;
      }
    }

    // 2. Find nearest district centroid
    let closestDistrict = null;
    let minDistrictDist = Infinity;

    for (const [name, data] of Object.entries(DISTRICT_CENTROIDS)) {
      const dist = getDistanceKm(lat, lon, data.lat, data.lon);
      if (dist < minDistrictDist) {
        minDistrictDist = dist;
        closestDistrict = { name, ...data };
      }
    }

    // 3. Query PostGIS to get exact containing grid cell and district name
    let cellInfo = null;
    try {
      const gridRes = await pool.query(
        `SELECT grid_id, state, district, block
         FROM grid_500m.assam
         WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
         LIMIT 1;`,
        [lon, lat]
      );
      if (gridRes.rows.length > 0) {
        cellInfo = gridRes.rows[0];
      } else {
        const mlRes = await pool.query(
          `SELECT grid_id, state, district, block
           FROM grid_500m.meghalaya
           WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           LIMIT 1;`,
          [lon, lat]
        );
        if (mlRes.rows.length > 0) {
          cellInfo = mlRes.rows[0];
        }
      }
    } catch (e) {
      console.warn("Reverse geocode grid lookup warning:", e.message);
    }

    // Construct human-readable place description
    const localityName = closestLocality && minLocalityDist < 25 ? closestLocality.name : null;
    const districtName =
      cellInfo?.district ||
      closestLocality?.district ||
      closestDistrict?.name ||
      "Kamrup Metropolitan";
    const stateName = cellInfo?.state || closestLocality?.state || closestDistrict?.state || "Assam";

    const displayName = localityName
      ? `${localityName}`
      : `${districtName}`;

    return res.status(200).json({
      success: true,
      data: {
        name: displayName,
        locality: localityName,
        district: districtName,
        state: stateName,
        gridId: cellInfo?.grid_id || null,
        distanceToLocalityKm: Math.round(minLocalityDist * 10) / 10,
        lat,
        lon,
      },
    });
  } catch (error) {
    console.error("Reverse geocoding error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/geocode?q=<query> - Search places, districts, towns, rivers, highways, and bridges
router.get("/", async (req, res) => {
  try {
    const rawQuery = (req.query.q || "").trim();
    if (!rawQuery) {
      return res.status(400).json({
        success: false,
        error: "Query parameter 'q' must not be empty.",
      });
    }

    const query = rawQuery.toLowerCase();
    const candidates = [];

    // 1. Check if query is a direct 500m Grid ID (e.g. AS_00239973 or ML_00012345)
    if (/^(AS|ML)_\d{8}$/i.test(query)) {
      const isAssam = query.toUpperCase().startsWith("AS");
      const tableName = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
      const gridRes = await pool.query(
        `SELECT grid_id, state, district, center_lat, center_lon, risk_score, risk_status 
         FROM ${tableName} 
         WHERE grid_id = $1;`,
        [query.toUpperCase()]
      );

      if (gridRes.rows.length > 0) {
        const cell = gridRes.rows[0];
        candidates.push({
          name: `Grid ${cell.grid_id}`,
          category: "GRID_CELL",
          district: cell.district || "Assam/Meghalaya",
          state: cell.state,
          lat: parseFloat(cell.center_lat),
          lon: parseFloat(cell.center_lon),
          gridId: cell.grid_id,
          riskScore: parseFloat(cell.risk_score),
          riskStatus: cell.risk_status,
          score: 1.0,
        });
      }
    }

    // 2. Search Regional Towns and Localities Gazetteer
    for (const item of LOCALITY_GAZETTEER) {
      const lowerName = item.name.toLowerCase();
      if (lowerName.includes(query) || query.includes(lowerName)) {
        candidates.push({
          name: item.name,
          category: "TOWN_LOCALITY",
          district: item.district,
          state: item.state,
          lat: item.lat,
          lon: item.lon,
          score: lowerName === query ? 0.98 : 0.88,
        });
      }
    }

    // 3. Search District Centroids
    for (const [name, data] of Object.entries(DISTRICT_CENTROIDS)) {
      const lowerName = name.toLowerCase();
      if (lowerName.includes(query) || query.includes(lowerName)) {
        candidates.push({
          name: `${name} District`,
          category: "DISTRICT",
          district: name,
          state: data.state,
          lat: data.lat,
          lon: data.lon,
          score: lowerName === query ? 0.95 : 0.85,
        });
      }
    }

    // 4. Search Regional Highways and Corridors
    for (const corridor of REGIONAL_CORRIDORS) {
      const lowerName = corridor.name.toLowerCase();
      const matchAlias = (corridor.aliases || []).some((a) => a.toLowerCase().includes(query));
      if (lowerName.includes(query) || matchAlias) {
        const coord = CORRIDOR_COORDINATES[corridor.name] || { lat: 26.1445, lon: 91.7362, state: "Assam" };
        candidates.push({
          name: corridor.name,
          category: corridor.name.includes("Bridge") ? "BRIDGE_STRUCTURE" : "HIGHWAY_CORRIDOR",
          district: "Transit Corridor",
          state: coord.state,
          lat: coord.lat,
          lon: coord.lon,
          score: 0.90,
        });
      }
    }

    // 5. Search Regional Rivers
    for (const riverName of REGIONAL_RIVERS) {
      const lowerName = riverName.toLowerCase();
      if (lowerName.includes(query) || query.includes(lowerName)) {
        candidates.push({
          name: `${riverName} River Basin`,
          category: "RIVER_BASIN",
          district: "River System",
          state: "Assam / Meghalaya",
          lat: 26.1445,
          lon: 91.7362,
          score: 0.80,
        });
      }
    }

    // Sort by relevance score and deduplicate
    const seen = new Set();
    const deduped = [];
    candidates.sort((a, b) => b.score - a.score);

    for (const c of candidates) {
      const key = `${c.name}_${c.lat.toFixed(3)}_${c.lon.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(c);
      }
      if (deduped.length >= 8) break;
    }

    return res.status(200).json({
      success: true,
      query: rawQuery,
      count: deduped.length,
      candidates: deduped,
    });
  } catch (error) {
    console.error("Geocoding search error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
