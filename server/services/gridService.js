import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolved path to map/state.json
const DEFAULT_GEOJSON_PATH = path.resolve(__dirname, "../../map/state.json");

// Hardcoded state configurations to prevent SQL injection and guarantee strict schema compliance
export const STATE_CONFIG = Object.freeze({
  Assam: {
    stateName: "Assam",
    tableName: "assam",
    prefix: "AS",
    searchNames: ["assam"],
    sridProj: 32646, // WGS 84 / UTM Zone 46N (metric projection standard for NE India)
    gridSizeM: 500,
  },
  Meghalaya: {
    stateName: "Meghalaya",
    tableName: "meghalaya",
    prefix: "ML",
    searchNames: ["meghalaya"],
    sridProj: 32646,
    gridSizeM: 500,
  },
});

// Initializes PostGIS extension, grid_500m schema, and all tables & indexes.
export const initGridSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Enable PostGIS
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

    // 2. Create schema
    await client.query("CREATE SCHEMA IF NOT EXISTS grid_500m;");

    // 3. Create processing status table
    await client.query(`
      CREATE TABLE IF NOT EXISTS grid_500m.processing_status (
        id BIGSERIAL PRIMARY KEY,
        state VARCHAR(50) NOT NULL,
        grid_size_m INTEGER NOT NULL,
        source_file VARCHAR(255) NOT NULL,
        source_hash VARCHAR(64) NOT NULL,
        status VARCHAR(30) NOT NULL,
        total_cells INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_state_grid_hash UNIQUE (state, grid_size_m, source_hash)
      );
    `);

    // 4. Create state grid tables and indexes
    for (const key of Object.keys(STATE_CONFIG)) {
      const config = STATE_CONFIG[key];
      const tableSql = `
        CREATE TABLE IF NOT EXISTS grid_500m.${config.tableName} (
          id BIGSERIAL PRIMARY KEY,
          grid_id VARCHAR(50) UNIQUE NOT NULL,
          state VARCHAR(50) NOT NULL DEFAULT '${config.stateName}',
          district VARCHAR(100),
          block VARCHAR(100),
          center_lat DOUBLE PRECISION,
          center_lon DOUBLE PRECISION,
          geom GEOMETRY(POLYGON, 4326) NOT NULL,

          -- Static factors
          elevation_mean DOUBLE PRECISION,
          elevation_min DOUBLE PRECISION,
          elevation_max DOUBLE PRECISION,
          slope_mean DOUBLE PRECISION,
          distance_to_river DOUBLE PRECISION,
          waterbody_percentage DOUBLE PRECISION,
          flood_susceptibility DOUBLE PRECISION DEFAULT 0,
          landslide_susceptibility DOUBLE PRECISION DEFAULT 0,
          seismic_risk DOUBLE PRECISION DEFAULT 0,
          population_density DOUBLE PRECISION DEFAULT 0,
          infrastructure_exposure DOUBLE PRECISION DEFAULT 0,
          static_risk DOUBLE PRECISION DEFAULT 0,

          -- Dynamic factors
          rainfall_risk DOUBLE PRECISION DEFAULT 0,
          flood_event_risk DOUBLE PRECISION DEFAULT 0,
          earthquake_event_risk DOUBLE PRECISION DEFAULT 0,
          landslide_event_risk DOUBLE PRECISION DEFAULT 0,
          news_risk DOUBLE PRECISION DEFAULT 0,
          nlp_event_risk DOUBLE PRECISION DEFAULT 0,
          citizen_report_risk DOUBLE PRECISION DEFAULT 0,
          road_closure_risk DOUBLE PRECISION DEFAULT 0,
          dynamic_risk DOUBLE PRECISION DEFAULT 0,

          -- Final risk intelligence
          risk_score DOUBLE PRECISION DEFAULT 0,
          risk_confidence DOUBLE PRECISION DEFAULT 0,
          risk_status VARCHAR(30) DEFAULT 'UNKNOWN',

          last_dynamic_update TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_${config.tableName}_geom 
          ON grid_500m.${config.tableName} USING GIST (geom);

        CREATE INDEX IF NOT EXISTS idx_${config.tableName}_grid_id 
          ON grid_500m.${config.tableName} (grid_id);

        CREATE INDEX IF NOT EXISTS idx_${config.tableName}_center 
          ON grid_500m.${config.tableName} (center_lat, center_lon);
      `;
      await client.query(tableSql);
    }

    await client.query("COMMIT;");
    console.log("✅ PostGIS and grid_500m schema initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error("❌ Failed to initialize grid_500m schema:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Computes the SHA-256 hash of a file.
export const computeFileHash = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
};

// Reads GeoJSON file and extracts geometry for a specified state.
export const extractStateGeometry = (filePath, stateKey) => {
  const config = STATE_CONFIG[stateKey];
  if (!config) {
    throw new Error(`Unsupported state: ${stateKey}. Allowed states: ${Object.keys(STATE_CONFIG).join(", ")}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const geojson = JSON.parse(raw);

  let matchingFeatures = [];
  if (geojson.type === "FeatureCollection" && Array.isArray(geojson.features)) {
    matchingFeatures = geojson.features.filter((f) => {
      const stName = (f.properties?.ST_NM || f.properties?.name || f.properties?.STATE || "").trim().toLowerCase();
      return config.searchNames.some((sn) => stName === sn.toLowerCase());
    });
  } else if (geojson.type === "Feature") {
    const stName = (geojson.properties?.ST_NM || geojson.properties?.name || "").trim().toLowerCase();
    if (config.searchNames.some((sn) => stName === sn.toLowerCase())) {
      matchingFeatures = [geojson];
    }
  }

  if (matchingFeatures.length === 0) {
    throw new Error(`State '${config.stateName}' not found in GeoJSON: ${filePath}`);
  }

  if (matchingFeatures.length === 1) {
    return matchingFeatures[0].geometry;
  }

  // If multiple features represent the state, bundle as GeometryCollection
  return {
    type: "GeometryCollection",
    geometries: matchingFeatures.map((f) => f.geometry),
  };
};

// Generates 500m x 500m grid for a single state idempotently.
export const generateStateGrid = async (stateKey, options = {}) => {
  const config = STATE_CONFIG[stateKey];
  if (!config) {
    throw new Error(`Unknown state: ${stateKey}`);
  }

  const sourceFile = options.sourceFile || DEFAULT_GEOJSON_PATH;
  const force = !!options.force;
  const gridSizeM = options.gridSizeM || config.gridSizeM;

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`GeoJSON source file not found at: ${sourceFile}`);
  }

  const sourceHash = computeFileHash(sourceFile);
  const relativeSourcePath = path.relative(path.resolve(__dirname, "../../"), sourceFile);

  // 1. Ensure schema & tables exist
  await initGridSchema();

  // 2. Check processing status
  const statusRes = await pool.query(
    `SELECT * FROM grid_500m.processing_status 
     WHERE state = $1 AND grid_size_m = $2 AND source_hash = $3`,
    [config.stateName, gridSizeM, sourceHash]
  );

  const existingStatus = statusRes.rows[0];

  if (!force && existingStatus && existingStatus.status === "COMPLETED") {
    // Verify count in actual table
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM grid_500m.${config.tableName}`);
    const actualCount = countRes.rows[0]?.total || 0;

    if (actualCount > 0) {
      console.log(`ℹ️ State ${config.stateName} already processed (${actualCount} cells). Skipping.`);
      return {
        state: config.stateName,
        status: "SKIPPED",
        totalCells: actualCount,
        sourceHash,
      };
    }
  }

  // 3. Mark as PROCESSING in processing_status
  await pool.query(
    `INSERT INTO grid_500m.processing_status 
      (state, grid_size_m, source_file, source_hash, status, started_at, updated_at)
     VALUES ($1, $2, $3, $4, 'PROCESSING', NOW(), NOW())
     ON CONFLICT (state, grid_size_m, source_hash)
     DO UPDATE SET 
       status = 'PROCESSING',
       started_at = NOW(),
       completed_at = NULL,
       error_message = NULL,
       updated_at = NOW()`,
    [config.stateName, gridSizeM, relativeSourcePath, sourceHash]
  );

  const client = await pool.connect();
  const startTime = Date.now();

  try {
    console.log(`⏳ Generating 500m grid for ${config.stateName}...`);

    const geometry = extractStateGeometry(sourceFile, stateKey);
    const geojsonStr = JSON.stringify(geometry);

    await client.query("BEGIN;");

    // Clear existing state grid to ensure clean idempotent insert
    await client.query(`TRUNCATE TABLE grid_500m.${config.tableName} RESTART IDENTITY;`);

    // PostGIS Grid Generation Query:
    // 1. Transform GeoJSON boundary to metric projection (EPSG:32646 - UTM Zone 46N)
    // 2. Generate 500m square grid with ST_SquareGrid(500, geom)
    // 3. Intersect grid with boundary, clip edge cells cleanly
    // 4. Dump to single Polygons (ensuring strictly GEOMETRY(POLYGON, 4326))
    // 5. Transform back to WGS 84 (EPSG:4326)
    // 6. Calculate centroid lat/lon and deterministic sequential grid IDs (e.g. AS_00000001)
    const gridQuery = `
      WITH boundary AS (
        SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), ${config.sridProj}) AS geom
      ),
      raw_grid AS (
        SELECT g.geom AS cell_proj
        FROM boundary b,
             ST_SquareGrid($2, b.geom) g
        WHERE ST_Intersects(g.geom, b.geom)
      ),
      processed AS (
        SELECT
          CASE 
            WHEN ST_Covers(b.geom, r.cell_proj) THEN r.cell_proj
            ELSE ST_CollectionExtract(ST_MakeValid(ST_Intersection(r.cell_proj, b.geom)), 3)
          END AS geom_proj
        FROM raw_grid r, boundary b
      ),
      dumped AS (
        SELECT (ST_Dump(geom_proj)).geom AS poly_proj
        FROM processed
        WHERE ST_Area(geom_proj) > 1 -- filter out sub-metre slivers
      ),
      transformed AS (
        SELECT 
          ST_Transform(poly_proj, 4326) AS geom_4326
        FROM dumped
      ),
      with_centers AS (
        SELECT
          geom_4326 AS geom,
          ST_Y(ST_Centroid(geom_4326)) AS center_lat,
          ST_X(ST_Centroid(geom_4326)) AS center_lon
        FROM transformed
      )
      INSERT INTO grid_500m.${config.tableName} (
        grid_id,
        state,
        center_lat,
        center_lon,
        geom,
        created_at,
        updated_at
      )
      SELECT
        '${config.prefix}_' || LPAD(ROW_NUMBER() OVER (ORDER BY center_lat DESC, center_lon ASC)::text, 8, '0') AS grid_id,
        '${config.stateName}' AS state,
        center_lat,
        center_lon,
        geom,
        NOW(),
        NOW()
      FROM with_centers;
    `;

    await client.query(gridQuery, [geojsonStr, gridSizeM]);

    const countRes = await client.query(`SELECT COUNT(*)::int AS total FROM grid_500m.${config.tableName}`);
    const totalCells = countRes.rows[0]?.total || 0;

    await client.query("COMMIT;");

    const durationMs = Date.now() - startTime;
    console.log(`✅ Generated ${totalCells} cells for ${config.stateName} in ${(durationMs / 1000).toFixed(2)}s`);

    // Update processing_status to COMPLETED
    await pool.query(
      `UPDATE grid_500m.processing_status 
       SET status = 'COMPLETED',
           total_cells = $1,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE state = $2 AND grid_size_m = $3 AND source_hash = $4`,
      [totalCells, config.stateName, gridSizeM, sourceHash]
    );

    return {
      state: config.stateName,
      status: "COMPLETED",
      totalCells,
      durationMs,
      sourceHash,
    };
  } catch (error) {
    await client.query("ROLLBACK;");

    // Record failure in processing_status
    await pool.query(
      `UPDATE grid_500m.processing_status 
       SET status = 'FAILED',
           error_message = $1,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE state = $2 AND grid_size_m = $3 AND source_hash = $4`,
      [error.message, config.stateName, gridSizeM, sourceHash]
    );

    console.error(`❌ Error generating grid for ${config.stateName}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

// Generates 500m grids for all configured states (Assam and Meghalaya).
export const generateAllStateGrids = async (options = {}) => {
  const results = {};
  for (const stateKey of Object.keys(STATE_CONFIG)) {
    const res = await generateStateGrid(stateKey, options);
    results[stateKey] = res;
  }
  return results;
};

// Spatial query helper: Find grid containing a specific coordinate point (lat, lon).
export const getGridByPoint = async (lat, lon, stateKey = null) => {
  const statesToSearch = stateKey ? [stateKey] : Object.keys(STATE_CONFIG);

  for (const key of statesToSearch) {
    const config = STATE_CONFIG[key];
    if (!config) continue;

    const query = `
      SELECT id, grid_id, state, district, block, center_lat, center_lon,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM grid_500m.${config.tableName}
      WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      LIMIT 1;
    `;
    const res = await pool.query(query, [lon, lat]);
    if (res.rows.length > 0) {
      return res.rows[0];
    }
  }

  return null;
};

// Spatial query helper: Find grids intersecting with a GeoJSON polygon/geometry.
export const getGridsByGeometry = async (geoJsonGeometry, stateKey = "Assam", limit = 100) => {
  const config = STATE_CONFIG[stateKey];
  if (!config) throw new Error(`Unknown state: ${stateKey}`);

  const query = `
    SELECT id, grid_id, state, district, block, center_lat, center_lon,
           ST_AsGeoJSON(geom)::json AS geometry
    FROM grid_500m.${config.tableName}
    WHERE ST_Intersects(geom, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
    LIMIT $2;
  `;
  const res = await pool.query(query, [JSON.stringify(geoJsonGeometry), limit]);
  return res.rows;
};

export default {
  STATE_CONFIG,
  initGridSchema,
  computeFileHash,
  extractStateGeometry,
  generateStateGrid,
  generateAllStateGrids,
  getGridByPoint,
  getGridsByGeometry,
};
