// RESQ Dataset Registry Service
// Manages metadata, provenance, source URLs, hashes, and processing status for all static and dynamic datasets.
import pool from "../../config/db.js";

// Initializes datasets and disaster schemas and the dataset registry table
export const initRegistrySchema = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Create schemas
    await client.query("CREATE SCHEMA IF NOT EXISTS datasets;");
    await client.query("CREATE SCHEMA IF NOT EXISTS disaster;");

    // 2. Create datasets registry table
    await client.query(`
      CREATE TABLE IF NOT EXISTS datasets.registry (
        id BIGSERIAL PRIMARY KEY,
        dataset_name VARCHAR(255) UNIQUE NOT NULL,
        factor VARCHAR(100) NOT NULL,
        source_name VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        official_url TEXT,
        implementation_url TEXT,
        source_type VARCHAR(100),
        format VARCHAR(255),
        resolution VARCHAR(255),
        temporal_coverage VARCHAR(255),
        geographic_coverage VARCHAR(255),
        version VARCHAR(100),
        source_hash VARCHAR(64),
        download_path TEXT,
        processing_status VARCHAR(30) DEFAULT 'PENDING',
        total_records INTEGER DEFAULT 0,
        processed_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure column widths are sufficient if table already existed
    await client.query(`
      ALTER TABLE datasets.registry 
        ALTER COLUMN dataset_name TYPE VARCHAR(255),
        ALTER COLUMN factor TYPE VARCHAR(100),
        ALTER COLUMN source_name TYPE VARCHAR(255),
        ALTER COLUMN provider TYPE VARCHAR(255),
        ALTER COLUMN source_type TYPE VARCHAR(100),
        ALTER COLUMN format TYPE VARCHAR(255),
        ALTER COLUMN resolution TYPE VARCHAR(255),
        ALTER COLUMN temporal_coverage TYPE VARCHAR(255),
        ALTER COLUMN geographic_coverage TYPE VARCHAR(255);
    `);

    // 3. Create disaster flood events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disaster.flood_events (
        id BIGSERIAL PRIMARY KEY,
        source_event_id VARCHAR(100),
        state VARCHAR(50) NOT NULL,
        event_date DATE,
        event_year INTEGER,
        from_time VARCHAR(50),
        to_time VARCHAR(50),
        gridcode INTEGER,
        flood_frequency INTEGER,
        source VARCHAR(100) DEFAULT 'NDEM / NRSC',
        properties JSONB,
        geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
        imported_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_flood_events_geom ON disaster.flood_events USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_flood_events_state ON disaster.flood_events (state);
      CREATE INDEX IF NOT EXISTS idx_flood_events_year ON disaster.flood_events (event_year);
      CREATE INDEX IF NOT EXISTS idx_flood_events_freq ON disaster.flood_events (flood_frequency);
    `);

    await client.query("COMMIT;");
    console.log("✅ datasets.registry and disaster.flood_events initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error("❌ Failed to initialize registry schema:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Registers or updates dataset metadata in registry
export const upsertDatasetMetadata = async (metadata) => {
  const query = `
    INSERT INTO datasets.registry (
      dataset_name, factor, source_name, provider, official_url, implementation_url,
      source_type, format, resolution, temporal_coverage, geographic_coverage,
      version, source_hash, download_path, processing_status, total_records,
      notes, updated_at
    ) VALUES (
      $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::text, $6::text,
      $7::varchar, $8::varchar, $9::varchar, $10::varchar, $11::varchar,
      $12::varchar, $13::varchar, $14::text, $15::varchar, $16::integer,
      $17::text, NOW()
    )
    ON CONFLICT (dataset_name)
    DO UPDATE SET
      factor = EXCLUDED.factor,
      source_name = EXCLUDED.source_name,
      provider = EXCLUDED.provider,
      official_url = EXCLUDED.official_url,
      implementation_url = EXCLUDED.implementation_url,
      source_type = EXCLUDED.source_type,
      format = EXCLUDED.format,
      resolution = EXCLUDED.resolution,
      temporal_coverage = EXCLUDED.temporal_coverage,
      geographic_coverage = EXCLUDED.geographic_coverage,
      version = EXCLUDED.version,
      source_hash = COALESCE(EXCLUDED.source_hash, datasets.registry.source_hash),
      download_path = COALESCE(EXCLUDED.download_path, datasets.registry.download_path),
      processing_status = COALESCE(EXCLUDED.processing_status, datasets.registry.processing_status),
      total_records = COALESCE(EXCLUDED.total_records, datasets.registry.total_records),
      notes = COALESCE(EXCLUDED.notes, datasets.registry.notes),
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    metadata.dataset_name,
    metadata.factor,
    metadata.source_name,
    metadata.provider,
    metadata.official_url,
    metadata.implementation_url,
    metadata.source_type,
    metadata.format,
    metadata.resolution,
    metadata.temporal_coverage,
    metadata.geographic_coverage,
    metadata.version || "1.0",
    metadata.source_hash || null,
    metadata.download_path || null,
    metadata.processing_status || "PENDING",
    metadata.total_records || 0,
    metadata.notes || null,
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
};

// Updates processing status for a dataset in registry
export const updateProcessingStatus = async (datasetName, status, totalRecords = 0, notes = null) => {
  const query = `
    UPDATE datasets.registry
    SET processing_status = $2::varchar,
        total_records = CASE WHEN $3::integer > 0 THEN $3::integer ELSE total_records END,
        processed_at = CASE WHEN $2::text = 'PROCESSED' THEN NOW() ELSE processed_at END,
        notes = COALESCE($4::text, notes),
        updated_at = NOW()
    WHERE dataset_name = $1::varchar
    RETURNING *;
  `;
  const res = await pool.query(query, [datasetName, status, totalRecords, notes]);
  return res.rows[0];
};

// Gets all registered datasets
export const getAllDatasets = async () => {
  const res = await pool.query("SELECT * FROM datasets.registry ORDER BY factor, dataset_name ASC;");
  return res.rows;
};

export default {
  initRegistrySchema,
  upsertDatasetMetadata,
  updateProcessingStatus,
  getAllDatasets,
};
