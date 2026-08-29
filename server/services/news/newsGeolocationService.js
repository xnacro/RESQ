// News Geolocation & 500m Grid Spatial Association Service
// Resolves NLP extracted places to coordinates and associates events with affected PostGIS grid cells
import pool from "../../config/db.js";
import { LOCALITY_GAZETTEER, DISTRICT_CENTROIDS } from "../../../nlp/location/nerLocationExtractor.js";

// Resolves best coordinates from extracted location entities
export const resolveCoordinates = async (locationEntity) => {
  // 1. If exact coordinates were already identified
  if (locationEntity.coordinates && locationEntity.coordinates.lat && locationEntity.coordinates.lon) {
    return {
      lat: locationEntity.coordinates.lat,
      lon: locationEntity.coordinates.lon,
      resolutionType: locationEntity.locality ? "EXACT_LOCALITY" : "DISTRICT_CENTROID",
      confidence: locationEntity.confidence || 0.8,
    };
  }

  // 2. Lookup locality in local gazetteer directly
  if (locationEntity.locality) {
    const match = LOCALITY_GAZETTEER.find(
      (g) => g.name.toLowerCase() === locationEntity.locality.toLowerCase()
    );
    if (match) {
      return {
        lat: match.lat,
        lon: match.lon,
        resolutionType: "EXACT_LOCALITY",
        confidence: 0.9,
      };
    }
  }

  // 3. Fast in-memory district centroid lookup
  if (locationEntity.district && DISTRICT_CENTROIDS[locationEntity.district]) {
    const distMatch = DISTRICT_CENTROIDS[locationEntity.district];
    return {
      lat: distMatch.lat,
      lon: distMatch.lon,
      resolutionType: "DISTRICT_CENTROID",
      confidence: 0.65,
    };
  }

  return null;
};

// Finds the primary containing 500m grid cell for given coordinates
export const findContainingGridCell = async (lat, lon) => {
  const client = await pool.connect();
  try {
    // Check Assam grid first
    const asRes = await client.query(
      `
      SELECT grid_id, state, district, block, center_lat, center_lon
      FROM grid_500m.assam
      WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
      LIMIT 1;
    `,
      [lon, lat]
    );

    if (asRes.rows.length > 0) {
      return asRes.rows[0];
    }

    // Check Meghalaya grid
    const mlRes = await client.query(
      `
      SELECT grid_id, state, district, block, center_lat, center_lon
      FROM grid_500m.meghalaya
      WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
      LIMIT 1;
    `,
      [lon, lat]
    );

    if (mlRes.rows.length > 0) {
      return mlRes.rows[0];
    }

    return null;
  } finally {
    client.release();
  }
};

// Finds all 500m grid cells within an impact buffer radius using fast GiST spatial index filtering
export const findAffectedGridCells = async (lat, lon, bufferMeters = 1500, stateHint = "Assam") => {
  const isAssam = (stateHint || "Assam").toLowerCase() === "assam";
  const primaryTable = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
  const secondaryTable = isAssam ? "grid_500m.meghalaya" : "grid_500m.assam";
  const bufferDegrees = bufferMeters / 111320.0;

  const client = await pool.connect();
  try {
    const qSql = `
      SELECT 
        grid_id, 
        state, 
        district,
        ROUND((ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) * 111320.0)::numeric, 0) AS distance_m
      FROM ${primaryTable}
      WHERE ST_DWithin(geom, ST_SetSRID(ST_Point($1, $2), 4326), $3)
      ORDER BY distance_m ASC
      LIMIT 25;
    `;

    const res = await client.query(qSql, [lon, lat, bufferDegrees]);
    if (res.rows.length > 0) {
      return res.rows;
    }

    // Fallback check secondary state grid
    const secRes = await client.query(
      `
      SELECT 
        grid_id, 
        state, 
        district,
        ROUND((ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) * 111320.0)::numeric, 0) AS distance_m
      FROM ${secondaryTable}
      WHERE ST_DWithin(geom, ST_SetSRID(ST_Point($1, $2), 4326), $3)
      ORDER BY distance_m ASC
      LIMIT 25;
    `,
      [lon, lat, bufferDegrees]
    );

    return secRes.rows;
  } finally {
    client.release();
  }
};

export default {
  resolveCoordinates,
  findContainingGridCell,
  findAffectedGridCells,
};
