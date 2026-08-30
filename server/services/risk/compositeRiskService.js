// RESQ Composite Risk & Spatial Aggregation Engine
// Computes multi-hazard static risk, fuses dynamic real-time feeds, and derives total risk score and confidence.
import pool from "../../config/db.js";

// Initializes raw domain schemas and tables (infrastructure, disaster, environment)
export const initDomainSchemas = async () => {
  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");
    await client.query("BEGIN;");

    // 1. Schemas
    await client.query("CREATE SCHEMA IF NOT EXISTS disaster;");
    await client.query("CREATE SCHEMA IF NOT EXISTS infrastructure;");
    await client.query("CREATE SCHEMA IF NOT EXISTS environment;");

    // 2. Raw Landslide Events / Inventory
    await client.query(`
      CREATE TABLE IF NOT EXISTS disaster.landslide_events (
        id BIGSERIAL PRIMARY KEY,
        source_id VARCHAR(100),
        state VARCHAR(50) NOT NULL,
        district VARCHAR(100),
        event_date DATE,
        slope_angle DOUBLE PRECISION,
        susceptibility_tier VARCHAR(50),
        source VARCHAR(100) DEFAULT 'GSI NLSM',
        properties JSONB,
        geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_landslide_geom ON disaster.landslide_events USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_landslide_state ON disaster.landslide_events (state);
    `);

    // 3. Raw Infrastructure: Roads Network
    await client.query(`
      CREATE TABLE IF NOT EXISTS infrastructure.roads (
        id BIGSERIAL PRIMARY KEY,
        osm_id VARCHAR(100),
        state VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        highway_type VARCHAR(50),
        surface VARCHAR(50),
        lanes INTEGER DEFAULT 1,
        maxspeed INTEGER,
        bridge BOOLEAN DEFAULT FALSE,
        tunnel BOOLEAN DEFAULT FALSE,
        properties JSONB,
        geom GEOMETRY(LINESTRING, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_roads_geom ON infrastructure.roads USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_roads_state ON infrastructure.roads (state);
      CREATE INDEX IF NOT EXISTS idx_roads_type ON infrastructure.roads (highway_type);
    `);

    // 4. Raw Infrastructure: Bridges & Critical River Crossings
    await client.query(`
      CREATE TABLE IF NOT EXISTS infrastructure.bridges (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255),
        state VARCHAR(50) NOT NULL,
        river_name VARCHAR(255),
        structure_type VARCHAR(100),
        load_capacity_tons DOUBLE PRECISION,
        properties JSONB,
        geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bridges_geom ON infrastructure.bridges USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_bridges_state ON infrastructure.bridges (state);
    `);

    // 5. Raw Environment: Waterbodies & Wetlands
    await client.query(`
      CREATE TABLE IF NOT EXISTS environment.waterbodies (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255),
        state VARCHAR(50) NOT NULL,
        waterbody_type VARCHAR(100),
        area_sqkm DOUBLE PRECISION,
        source VARCHAR(100) DEFAULT 'ISRO SAC Wetland Atlas',
        properties JSONB,
        geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_waterbodies_geom ON environment.waterbodies USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_waterbodies_state ON environment.waterbodies (state);
    `);

    await client.query("COMMIT;");
    console.log("✅ Raw domain tables (disaster, infrastructure, environment) initialized successfully.");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
};

// Computes composite static risk, total risk score, confidence, and status across all grid cells
export const computeCompositeStaticRisk = async (stateName, chunkSize = 60000) => {
  const isAssam = stateName.toLowerCase() === "assam";
  const tableName = isAssam ? "assam" : "meghalaya";
  const startTime = Date.now();

  console.log(`⏳ Computing composite static risk for grid_500m.${tableName} in chunks of ${chunkSize}...`);
  const client = await pool.connect();

  try {
    await client.query("SET default_transaction_read_only = off;");
    const maxRes = await client.query(`SELECT MAX(id) AS max_id, COUNT(*) AS total FROM grid_500m.${tableName};`);
    const maxId = parseInt(maxRes.rows[0].max_id || "0", 10);
    const total = parseInt(maxRes.rows[0].total || "0", 10);

    let startId = 1;
    let processed = 0;

    while (startId <= maxId) {
      const endId = startId + chunkSize - 1;

      // Multi-Hazard Static Risk Formulation:
      // static_risk = 0.25 * flood_susceptibility
      //             + 0.20 * landslide_susceptibility
      //             + 0.15 * (seismic_risk / 100 * 50)  [Zone V calibrated baseline]
      //             + 0.10 * river_proximity_risk        [100 if <500m, 50 if <2000m, 10 else]
      //             + 0.10 * waterbody_percentage
      //             + 0.10 * normalized_population_risk  [LEAST(100, pop_density / 25)]
      //             + 0.10 * infrastructure_exposure
      const updateSql = `
        WITH computed_static AS (
          SELECT
            id,
            ROUND((
              LEAST(100.0, GREATEST(0.0,
                0.25 * COALESCE(flood_susceptibility, 0) +
                0.20 * COALESCE(landslide_susceptibility, 0) +
                0.15 * (COALESCE(seismic_risk, 100) * 0.4) +
                0.10 * (
                  CASE 
                    WHEN distance_to_river < 500.0 THEN 90.0
                    WHEN distance_to_river < 2000.0 THEN 55.0
                    WHEN distance_to_river < 5000.0 THEN 25.0
                    ELSE 5.0
                  END
                ) +
                0.10 * COALESCE(waterbody_percentage, 0) +
                0.10 * LEAST(100.0, COALESCE(population_density, 0) / 50.0) +
                0.10 * COALESCE(infrastructure_exposure, 0)
              ))
            )::numeric, 1) AS calc_static_risk
          FROM grid_500m.${tableName}
          WHERE id BETWEEN $1 AND $2
        )
        UPDATE grid_500m.${tableName} g
        SET
          static_risk = c.calc_static_risk,
          dynamic_risk = COALESCE(g.dynamic_risk, 0),
          -- Combined risk score (when dynamic_risk = 0, equals static_risk)
          risk_score = ROUND((
            CASE 
              WHEN COALESCE(g.dynamic_risk, 0) > 0 
                THEN 0.4 * c.calc_static_risk + 0.6 * g.dynamic_risk
              ELSE c.calc_static_risk
            END
          )::numeric, 1),
          -- Confidence metric (0.95 for authoritative static baseline)
          risk_confidence = 0.95,
          -- Status classification
          risk_status = CASE
            WHEN c.calc_static_risk >= 70.0 THEN 'CRITICAL'
            WHEN c.calc_static_risk >= 45.0 THEN 'HIGH'
            WHEN c.calc_static_risk >= 25.0 THEN 'MODERATE'
            ELSE 'LOW'
          END,
          updated_at = NOW()
        FROM computed_static c
        WHERE g.id = c.id;
      `;

      await client.query(updateSql, [startId, endId]);
      processed += Math.min(chunkSize, maxId - startId + 1);
      startId += chunkSize;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Composite static risk computed for ${stateName} (${total} cells) in ${duration}s!`);
  } finally {
    client.release();
  }
};

export default {
  initDomainSchemas,
  computeCompositeStaticRisk,
};
