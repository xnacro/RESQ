// RESQ Flood Hazard Service - NRSC/Bhuvan WMS Integration
// Handles external OGC WMS flood hazard capabilities, classification schemes, and spatial sampling.
import https from "https";
import pool from "../config/db.js";

// Official NRSC/Bhuvan Flood Hazard WMS endpoint
export const NRSC_WMS_CONFIG = Object.freeze({
  baseUrl: "https://bhuvan-ras2.nrsc.gov.in/cgi-bin/hazard.exe",
  layerName: "as_hz",
  title: "Assam_Hazard",
  srid: 4326,
  supportedFormats: ["image/png", "image/jpeg", "image/tiff"],
});

// Official 5-tier classification scheme decoded from NRSC GetLegendGraphic
// Maps NRSC flood hazard categories to normalized 0-100 susceptibility scores
export const NRSC_HAZARD_CLASSES = Object.freeze([
  {
    category: "Very High",
    level: 5,
    rgb: { r: 245, g: 122, b: 182 },
    hex: "#F57AB6",
    normalizedScore: 95,
    description: "Inundated in almost all historical major flood years (>70-80% frequency)",
  },
  {
    category: "High",
    level: 4,
    rgb: { r: 255, g: 170, b: 0 },
    hex: "#FFAA00",
    normalizedScore: 75,
    description: "Inundated in 50%-70% of historical flood years",
  },
  {
    category: "Moderate",
    level: 3,
    rgb: { r: 255, g: 190, b: 140 },
    hex: "#FFBE8C",
    normalizedScore: 55,
    description: "Inundated in 30%-50% of historical flood years",
  },
  {
    category: "Low",
    level: 2,
    rgb: { r: 255, g: 211, b: 127 },
    hex: "#FFD37F",
    normalizedScore: 35,
    description: "Inundated in 15%-30% of historical flood years",
  },
  {
    category: "Very Low",
    level: 1,
    rgb: { r: 255, g: 235, b: 175 },
    hex: "#FFEBAF",
    normalizedScore: 20,
    description: "Inundated only during rare/extreme historical flood events (<15% frequency)",
  },
  {
    category: "Flood Free",
    level: 0,
    rgb: { r: 255, g: 255, b: 255 },
    hex: "#FFFFFF",
    normalizedScore: 0,
    description: "No recorded inundation in historical satellite observations",
  },
]);

// Helper to perform HTTP GET with timeout and SSL handling
const fetchWms = (targetUrl) => {
  return new Promise((resolve, reject) => {
    https
      .get(targetUrl, { rejectUnauthorized: false, timeout: 15000 }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      })
      .on("error", reject)
      .on("timeout", () => reject(new Error("NRSC WMS request timed out after 15s")));
  });
};

// Tests connectivity and retrieves GetCapabilities from NRSC WMS
export const checkNrscCapabilities = async () => {
  const url = `${NRSC_WMS_CONFIG.baseUrl}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`;
  const response = await fetchWms(url);

  if (response.statusCode !== 200) {
    throw new Error(`NRSC WMS returned HTTP status ${response.statusCode}`);
  }

  const xmlText = response.body.toString("utf8");

  // Extract key capabilities metadata
  const titleMatch = xmlText.match(/<Title>(.*?)<\/Title>/);
  const layerMatch = xmlText.match(/<Name>(.*?)<\/Name>/);
  const bboxMatch = xmlText.match(/<EX_GeographicBoundingBox>[\s\S]*?<\/EX_GeographicBoundingBox>/);

  return {
    accessible: true,
    version: "1.3.0",
    serviceTitle: titleMatch ? titleMatch[1] : "Unknown",
    primaryLayer: layerMatch ? layerMatch[1] : "as_hz",
    bboxXml: bboxMatch ? bboxMatch[0] : null,
    queryable: false, // Layer queryable is 0 in NRSC MapServer configuration
    wfsSupported: false,
    wcsSupported: false,
    formats: ["image/png", "image/jpeg", "image/tiff"],
  };
};

// Returns official NRSC flood classification scheme and normalization scale
export const getClassificationScheme = () => {
  return {
    source: "NRSC/ISRO Flood Hazard Atlas of Assam (Bhuvan OGC Service)",
    classes: NRSC_HAZARD_CLASSES,
    normalizationScale: "0-100",
  };
};

// Samples flood hazard raster for a specific bounding box from NRSC WMS
export const sampleWmsTile = async (minLat, minLon, maxLat, maxLon, width = 10, height = 10) => {
  const wmsUrl = `${NRSC_WMS_CONFIG.baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${NRSC_WMS_CONFIG.layerName}&STYLES=default&CRS=EPSG:4326&BBOX=${minLat},${minLon},${maxLat},${maxLon}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/png`;
  const response = await fetchWms(wmsUrl);
  return response;
};

// Spatial verification: fetches sample grids from database and verifies coordinate alignment with WMS
export const verifyGridSpatialAssociation = async (state = "Assam", limit = 5) => {
  const tableName = state.toLowerCase() === "assam" ? "assam" : "meghalaya";

  const query = `
    SELECT grid_id, state, center_lat, center_lon,
           ST_YMin(geom) as min_lat, ST_XMin(geom) as min_lon,
           ST_YMax(geom) as max_lat, ST_XMax(geom) as max_lon
    FROM grid_500m.${tableName}
    ORDER BY id
    LIMIT $1;
  `;

  const res = await pool.query(query, [limit]);
  const results = [];

  for (const row of res.rows) {
    let wmsStatus = null;
    if (state.toLowerCase() === "assam") {
      try {
        const resp = await sampleWmsTile(row.min_lat, row.min_lon, row.max_lat, row.max_lon, 10, 10);
        wmsStatus = { statusCode: resp.statusCode, byteLength: resp.body.length };
      } catch (err) {
        wmsStatus = { error: err.message };
      }
    } else {
      wmsStatus = { note: "NRSC hazard.exe mapfile is exclusive to Assam (as_hz.map)" };
    }

    results.push({
      grid_id: row.grid_id,
      center_lat: row.center_lat,
      center_lon: row.center_lon,
      bbox: [row.min_lat, row.min_lon, row.max_lat, row.max_lon],
      wms: wmsStatus,
    });
  }

  return results;
};

export default {
  NRSC_WMS_CONFIG,
  NRSC_HAZARD_CLASSES,
  checkNrscCapabilities,
  getClassificationScheme,
  sampleWmsTile,
  verifyGridSpatialAssociation,
};
