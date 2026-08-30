// News event geocoding, location extraction, and spatial grid cell resolution service
import pool from "../../config/db.js";

// Resolves geographic coordinates for extracted location names using gazetteer and reverse geocoding
export const resolveCoordinates = async (locationText, districtHint = null, stateHint = "Assam") => {
  if (!locationText && !districtHint) return null;

  const cleanLoc = (locationText || "").trim();
  const cleanDist = (districtHint || "").trim();
  const isAssam = (stateHint || "Assam").toLowerCase() === "assam";
  const stateFilter = isAssam ? "Assam" : "Meghalaya";

  // 1. Direct gazetteer match on location string
  if (cleanLoc) {
    const locRes = await pool.query(
      `
      SELECT 
        name, 
        district, 
        state, 
        latitude, 
        longitude, 
        category
      FROM metadata.locations
      WHERE state ILIKE $1
        AND (name ILIKE $2 OR name ILIKE $3)
      ORDER BY 
        CASE WHEN name ILIKE $2 THEN 1 ELSE 2 END,
        category = 'DISTRICT' DESC
      LIMIT 1;
    `,
      [stateFilter, cleanLoc, `%${cleanLoc}%`]
    );

    if (locRes.rows.length > 0) {
      const r = locRes.rows[0];
      return {
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        matchedLocation: r.name,
        district: r.district,
        state: r.state,
        matchType: "GAZETTEER_LOCATION",
      };
    }
  }

  // 2. Match on District headquarters
  if (cleanDist) {
    const distRes = await pool.query(
      `
      SELECT 
        name, 
        district, 
        state, 
        latitude, 
        longitude, 
        category
      FROM metadata.locations
      WHERE state ILIKE $1
        AND (district ILIKE $2 OR name ILIKE $2)
      ORDER BY category = 'DISTRICT' DESC
      LIMIT 1;
    `,
      [stateFilter, `%${cleanDist}%`]
    );

    if (distRes.rows.length > 0) {
      const r = distRes.rows[0];
      return {
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        matchedLocation: r.name,
        district: r.district,
        state: r.state,
        matchType: "DISTRICT_HQ",
      };
    }
  }

  // 3. Match from 500m grid cell centers
  if (cleanLoc || cleanDist) {
    const targetName = cleanLoc || cleanDist;
    const gridRes = await pool.query(
      `
      SELECT 
        district, 
        state, 
        center_lat, 
        center_lon
      FROM grid_500m.assam
      WHERE district ILIKE $1
      LIMIT 1;
    `,
      [`%${targetName}%`]
    );

    if (gridRes.rows.length > 0) {
      const r = gridRes.rows[0];
      return {
        latitude: parseFloat(r.center_lat),
        longitude: parseFloat(r.center_lon),
        matchedLocation: targetName,
        district: r.district,
        state: r.state,
        matchType: "GRID_CENTROID",
      };
    }
  }

  return null;
};

// Resolves containing 500m grid cell for exact latitude and longitude
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

// Finds all 500m grid cells within an impact buffer radius using true spheroidal geography distance (fixes CRS east-west distortion)
export const findAffectedGridCells = async (lat, lon, bufferMeters = 5000, stateHint = "Assam") => {
  const isAssam = (stateHint || "Assam").toLowerCase() === "assam";
  const primaryTable = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
  const secondaryTable = isAssam ? "grid_500m.meghalaya" : "grid_500m.assam";

  // Use geography casting for exact geodesic distance in meters on WGS84 ellipsoid
  const qSql = `
    SELECT 
      grid_id, 
      state, 
      district,
      ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography)::numeric, 0) AS distance_m
    FROM ${primaryTable}
    WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography, $3)
    ORDER BY distance_m ASC
    LIMIT 150;
  `;

  const res = await pool.query(qSql, [lon, lat, bufferMeters]);
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
      ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography)::numeric, 0) AS distance_m
    FROM ${secondaryTable}
    WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography, $3)
    ORDER BY distance_m ASC
    LIMIT 150;
  `,
    [lon, lat, bufferMeters]
  );

  return secRes.rows;
};

export default {
  resolveCoordinates,
  findContainingGridCell,
  findAffectedGridCells,
};
