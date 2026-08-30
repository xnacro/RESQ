// Coordinates Resolver & Grid Cell Spatial Linking Service for Ingested News
import pool from "../../config/db.js";
import {
  DISTRICT_CENTROIDS,
  LOCALITY_GAZETTEER,
} from "../../../nlp/location/nerLocationExtractor.js";

// Resolves extracted location text, district, and state into canonical GPS coordinates
export const resolveCoordinates = async (locationInput, districtParam, stateParam) => {
  if (!locationInput && !districtParam) return null;

  let locText = "";
  let dist = "";
  let st = "";

  if (typeof locationInput === "object" && locationInput !== null) {
    locText = (locationInput.rawText || locationInput.text || locationInput.locality || locationInput.name || "").trim();
    dist = (locationInput.district || districtParam || "").trim();
    st = (locationInput.state || stateParam || "").trim();
  } else if (typeof locationInput === "string") {
    locText = locationInput.trim();
    dist = (districtParam || "").trim();
    st = (stateParam || "").trim();
  } else if (districtParam) {
    dist = districtParam.trim();
    st = (stateParam || "").trim();
  }

  // 1. Direct Gazetteer Locality lookup
  if (locText) {
    const lower = locText.toLowerCase();
    const directMatch = LOCALITY_GAZETTEER.find(
      (l) => l.name.toLowerCase() === lower
    );
    if (directMatch) {
      return {
        lat: directMatch.lat,
        lon: directMatch.lon,
        state: directMatch.state,
        district: directMatch.district,
        source: "GAZETTEER_LOCALITY",
      };
    }
  }

  // 2. District Centroid lookup
  if (dist) {
    const distMatch = DISTRICT_CENTROIDS[dist];
    if (distMatch) {
      return {
        lat: distMatch.lat,
        lon: distMatch.lon,
        state: distMatch.state,
        district: dist,
        source: "DISTRICT_CENTROID",
      };
    }

    // Try case-insensitive matching for district
    const foundDistrictKey = Object.keys(DISTRICT_CENTROIDS).find(
      (k) => k.toLowerCase() === dist.toLowerCase()
    );
    if (foundDistrictKey) {
      const match = DISTRICT_CENTROIDS[foundDistrictKey];
      return {
        lat: match.lat,
        lon: match.lon,
        state: match.state,
        district: foundDistrictKey,
        source: "DISTRICT_CENTROID",
      };
    }
  }

  // 3. Substring match against gazetteer
  if (locText) {
    const lower = locText.toLowerCase();
    const partialMatch = LOCALITY_GAZETTEER.find(
      (l) => lower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(lower)
    );
    if (partialMatch) {
      return {
        lat: partialMatch.lat,
        lon: partialMatch.lon,
        state: partialMatch.state,
        district: partialMatch.district,
        source: "GAZETTEER_PARTIAL",
      };
    }

    // Substring match against district centroids
    const partialDistrictKey = Object.keys(DISTRICT_CENTROIDS).find(
      (k) => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
    );
    if (partialDistrictKey) {
      const match = DISTRICT_CENTROIDS[partialDistrictKey];
      return {
        lat: match.lat,
        lon: match.lon,
        state: match.state,
        district: partialDistrictKey,
        source: "DISTRICT_PARTIAL",
      };
    }
  }

  // 4. Default state centroid fallback
  if (st && st.toLowerCase() === "meghalaya") {
    return { lat: 25.5788, lon: 91.8933, state: "Meghalaya", district: "East Khasi Hills", source: "STATE_DEFAULT" };
  }

  if (st && st.toLowerCase() === "assam") {
    return { lat: 26.1445, lon: 91.7362, state: "Assam", district: "Kamrup Metropolitan", source: "STATE_DEFAULT" };
  }

  return null;
};

// Spatial point-in-polygon lookup: Finds exact 500m grid cell containing a coordinate point
export const findContainingGridCell = async (lat, lon, stateHint = "Assam") => {
  const isAssam = (stateHint || "Assam").toLowerCase() === "assam";
  const primaryTable = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
  const secondaryTable = isAssam ? "grid_500m.meghalaya" : "grid_500m.assam";

  const qSql = `
    SELECT grid_id, state, district, block, center_lat, center_lon
    FROM ${primaryTable}
    WHERE geom && ST_SetSRID(ST_Point($1, $2), 4326)
      AND ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
    LIMIT 1;
  `;
  const res = await pool.query(qSql, [lon, lat]);
  if (res.rows.length > 0) return res.rows[0];

  const secRes = await pool.query(
    `
    SELECT grid_id, state, district, block, center_lat, center_lon
    FROM ${secondaryTable}
    WHERE geom && ST_SetSRID(ST_Point($1, $2), 4326)
      AND ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
    LIMIT 1;
  `,
    [lon, lat]
  );
  return secRes.rows[0] || null;
};

// Finds all 500m grid cells within an impact buffer radius using indexed GiST bounding box expansion
export const findAffectedGridCells = async (lat, lon, bufferMeters = 5000, stateHint = "Assam") => {
  const isAssam = (stateHint || "Assam").toLowerCase() === "assam";
  const primaryTable = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
  const secondaryTable = isAssam ? "grid_500m.meghalaya" : "grid_500m.assam";
  const bufferDegrees = bufferMeters / 111320.0;

  const qSql = `
    SELECT 
      grid_id, 
      state, 
      district,
      ROUND((ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) * 111320.0)::numeric, 0) AS distance_m
    FROM ${primaryTable}
    WHERE geom && ST_Expand(ST_SetSRID(ST_Point($1, $2), 4326), $3)
      AND ST_DWithin(geom, ST_SetSRID(ST_Point($1, $2), 4326), $3)
    ORDER BY distance_m ASC
    LIMIT 150;
  `;

  const res = await pool.query(qSql, [lon, lat, bufferDegrees]);
  if (res.rows.length > 0) {
    return res.rows;
  }

  // Fallback check secondary state grid
  const secRes = await pool.query(
    `
    SELECT 
      grid_id, 
      state, 
      district,
      ROUND((ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) * 111320.0)::numeric, 0) AS distance_m
    FROM ${secondaryTable}
    WHERE geom && ST_Expand(ST_SetSRID(ST_Point($1, $2), 4326), $3)
      AND ST_DWithin(geom, ST_SetSRID(ST_Point($1, $2), 4326), $3)
    ORDER BY distance_m ASC
    LIMIT 150;
  `,
    [lon, lat, bufferDegrees]
  );

  return secRes.rows;
};

export default {
  resolveCoordinates,
  findContainingGridCell,
  findAffectedGridCells,
};
