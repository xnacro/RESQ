// RESQ Flood Dataset Ingestion & Susceptibility Service
// Downloads, extracts, parses NDEM/NRSC flood inundation GeoJSONL datasets and derives 500m grid flood susceptibility.
import fs from "fs";
import path from "path";
import readline from "readline";
import crypto from "crypto";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import pool from "../../config/db.js";
import { initRegistrySchema, upsertDatasetMetadata, updateProcessingStatus } from "./datasetRegistryService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directories
const DATA_DIR = path.resolve(__dirname, "../../../data/flood");
const RAW_DIR = path.join(DATA_DIR, "raw");
const EXTRACTED_DIR = path.join(DATA_DIR, "extracted");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");

// Ensure data directory hierarchy exists
[RAW_DIR, EXTRACTED_DIR, PROCESSED_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Official source and mirror metadata
export const FLOOD_DATASETS = Object.freeze({
  AssamYearlyAggregate: {
    dataset_name: "NDEM_AS_Yearly_Aggregate_Flood_Innundation_1998_to_2013_2021",
    factor: "flood_susceptibility",
    state: "Assam",
    source_name: "NDEM / NRSC (National Database for Emergency Management)",
    provider: "ramSeraph/india_natural_disasters",
    official_url: "https://ndem.nrsc.gov.in/",
    implementation_url: "https://github.com/ramSeraph/india_natural_disasters/releases/download/floods/NDEM_AS_Yearly_Aggregate_Flood_Innundation_1998_to_2013_2021.geojsonl.7z",
    archive_name: "NDEM_AS_Yearly_Aggregate_Flood_Innundation_1998_to_2013_2021.geojsonl.7z",
    extracted_name: "NDEM_AS_Yearly_Aggregate_Flood_Innundation_1998_to_2013_2021.geojsonl",
    source_type: "VECTOR_GEOJSONL",
    format: "GeoJSONL (MultiPolygon / Polygon in EPSG:4326)",
    resolution: "30m-50m satellite microwave flood inundation (RISAT/Sentinel/Radarsat)",
    temporal_coverage: "1998 to 2013, 2021 (24 observation years)",
    geographic_coverage: "Assam (State-wide flood plains)",
  },
  MeghalayaInundation: {
    dataset_name: "NDEM_ML_Floods_Inundation",
    factor: "flood_susceptibility",
    state: "Meghalaya",
    source_name: "NDEM / NRSC (National Database for Emergency Management)",
    provider: "ramSeraph/india_natural_disasters",
    official_url: "https://ndem.nrsc.gov.in/",
    implementation_url: "https://github.com/ramSeraph/india_natural_disasters/releases/download/floods/NDEM_ML_Floods_Inundation.geojsonl.7z",
    archive_name: "NDEM_ML_Floods_Inundation.geojsonl.7z",
    extracted_name: "NDEM_ML_Floods_Inundation.geojsonl",
    source_type: "VECTOR_GEOJSONL",
    format: "GeoJSONL (MultiPolygon / Polygon in EPSG:4326)",
    resolution: "30m-50m satellite microwave flood inundation",
    temporal_coverage: "2016 to 2022 (Event-level inundations)",
    geographic_coverage: "Meghalaya (West Garo Hills, plain border corridors)",
  },
});

// Computes SHA-256 hash of a file
export const computeHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

// Ingests GeoJSONL features in streaming batches into disaster.flood_events table
export const ingestGeoJsonLToDb = async (geojsonlPath, stateName, batchSize = 150, maxFeatures = null) => {
  const fileStream = fs.createReadStream(geojsonlPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch = [];
  let totalImported = 0;
  const startTime = Date.now();

  console.log(`⏳ Streaming and importing ${stateName} flood records from ${path.basename(geojsonlPath)}...`);

  // Clear existing state records before import to guarantee idempotency
  await pool.query("DELETE FROM disaster.flood_events WHERE state = $1;", [stateName]);

  const flushBatch = async (items) => {
    if (items.length === 0) return;

    const valueClauses = [];
    const params = [];
    let pIdx = 1;

    for (const item of items) {
      valueClauses.push(
        `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($${pIdx + 9}), 4326))`
      );

      params.push(
        item.source_event_id,
        item.state,
        item.event_date,
        item.event_year,
        item.from_time,
        item.to_time,
        item.gridcode,
        item.flood_frequency,
        JSON.stringify(item.properties),
        JSON.stringify(item.geometry)
      );

      pIdx += 10;
    }

    const insertSql = `
      INSERT INTO disaster.flood_events (
        source_event_id, state, event_date, event_year, from_time, to_time,
        gridcode, flood_frequency, properties, geom
      ) VALUES ${valueClauses.join(", ")};
    `;

    await pool.query(insertSql, params);
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const feat = JSON.parse(line);
    const props = feat.properties || {};

    let eventDate = null;
    let eventYear = null;
    let floodFreq = props.gridcode ?? props.frequency ?? props.freq ?? props.value ?? null;

    if (props.year) {
      eventYear = parseInt(props.year, 10);
      eventDate = `${props.year}-07-01`;
    } else if (props.from_time) {
      const parts = props.from_time.split(" ")[0].split("-");
      if (parts.length === 3) {
        eventDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        eventYear = parseInt(parts[2], 10);
      }
    }

    batch.push({
      source_event_id: String(props.id || props.ogc_fid || props.gid || totalImported + 1),
      state: stateName,
      event_date: eventDate,
      event_year: eventYear,
      from_time: props.from_time || null,
      to_time: props.to_time || null,
      gridcode: props.gridcode ?? props.value ?? null,
      flood_frequency: floodFreq,
      properties: props,
      geometry: feat.geometry,
    });

    if (batch.length >= batchSize) {
      await flushBatch(batch);
      totalImported += batch.length;
      batch = [];
      if (totalImported % 1500 === 0) {
        console.log(`  ... imported ${totalImported} features so far for ${stateName}`);
      }
    }

    if (maxFeatures && totalImported >= maxFeatures) {
      break;
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch);
    totalImported += batch.length;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Successfully imported ${totalImported} flood polygons for ${stateName} in ${durationSec}s`);
  return totalImported;
};

// Calculates and updates static flood susceptibility for state grids
export const calculateStateFloodSusceptibility = async (stateName) => {
  const tableName = stateName.toLowerCase() === "assam" ? "assam" : "meghalaya";
  const startTime = Date.now();

  console.log(`⏳ Calculating static flood susceptibility for grid_500m.${tableName}...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    if (stateName.toLowerCase() === "assam") {
      // For Assam: derive from NDEM multi-year historical recurrence frequency
      // Uses spatial intersection across distinct flood years observed in the grid cell
      // Normalization formula mapped to NRSC 5-tier classification:
      // >= 15 distinct flood years observed: 95 (Very High Hazard)
      // 10 - 14 distinct flood years: 75 (High Hazard)
      // 5 - 9 distinct flood years: 55 (Moderate Hazard)
      // 2 - 4 distinct flood years: 35 (Low Hazard)
      // 1 distinct flood year: 20 (Very Low Hazard)
      // 0 years / uninundated: 0 (Flood Free)
      const updateAssamSql = `
        WITH grid_flood_agg AS (
          SELECT 
            g.id,
            COUNT(DISTINCT e.event_year) AS distinct_flood_years,
            COUNT(e.id) AS event_match_count
          FROM grid_500m.assam g
          INNER JOIN disaster.flood_events e
            ON e.state = 'Assam' AND ST_Intersects(g.geom, e.geom)
          GROUP BY g.id
        )
        UPDATE grid_500m.assam g
        SET flood_susceptibility = CASE
              WHEN a.distinct_flood_years >= 15 THEN 95
              WHEN a.distinct_flood_years >= 10 THEN 75
              WHEN a.distinct_flood_years >= 5  THEN 55
              WHEN a.distinct_flood_years >= 2  THEN 35
              WHEN a.distinct_flood_years >= 1  THEN 20
              ELSE 0
            END,
            updated_at = NOW()
        FROM grid_flood_agg a
        WHERE g.id = a.id;
      `;
      await client.query(updateAssamSql);
    } else {
      // For Meghalaya: derive from historical inundation events count and spatial intersection
      // Max events observed in plain border corridors
      const updateMeghalayaSql = `
        WITH grid_flood_agg AS (
          SELECT 
            g.id,
            COUNT(e.id) AS event_count,
            COUNT(DISTINCT e.event_date) AS distinct_event_dates
          FROM grid_500m.meghalaya g
          INNER JOIN disaster.flood_events e
            ON e.state = 'Meghalaya' AND ST_Intersects(g.geom, e.geom)
          GROUP BY g.id
        )
        UPDATE grid_500m.meghalaya g
        SET flood_susceptibility = CASE
              WHEN a.distinct_event_dates >= 8 THEN 90
              WHEN a.distinct_event_dates >= 4 THEN 75
              WHEN a.distinct_event_dates >= 2 THEN 55
              WHEN a.distinct_event_dates >= 1 THEN 35
              ELSE 0
            END,
            updated_at = NOW()
        FROM grid_flood_agg a
        WHERE g.id = a.id;
      `;
      await client.query(updateMeghalayaSql);
    }

    // Compute distribution stats
    const statsRes = await client.query(`
      SELECT 
        COUNT(*) AS total_cells,
        COUNT(*) FILTER (WHERE flood_susceptibility > 0) AS vulnerable_cells,
        COUNT(*) FILTER (WHERE flood_susceptibility = 0) AS flood_free_cells,
        ROUND(AVG(flood_susceptibility)::numeric, 2) AS mean_susceptibility,
        MAX(flood_susceptibility) AS max_susceptibility
      FROM grid_500m.${tableName};
    `);

    await client.query("COMMIT;");
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Calculated flood susceptibility for ${stateName} in ${duration}s:`, statsRes.rows[0]);

    return {
      state: stateName,
      durationSeconds: duration,
      stats: statsRes.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error(`❌ Error calculating flood susceptibility for ${stateName}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

export default {
  FLOOD_DATASETS,
  computeHash,
  ingestGeoJsonLToDb,
  calculateStateFloodSusceptibility,
};
