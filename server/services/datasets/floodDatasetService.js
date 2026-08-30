// Flood Dataset Management and Multi-Year Inundation Ingestion Service
// Connects to ISRO NDEM, NRSC Bhuvan, and Sentinel-1 SAR flood layers
import pool from "../../config/db.js";

// Validates and registers ISRO NDEM / Bhuvan flood datasets in the registry
export const registerFloodDatasets = async () => {
  const datasets = [
    {
      dataset_name: "ISRO_NDEM_Assam_Flood_Inundation_1998_2022",
      factor: "flood_susceptibility",
      source_name: "National Database for Emergency Management (NDEM) / NRSC ISRO",
      provider: "NRSC / ISRO",
      official_url: "https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=flood",
      implementation_url: "https://ndem.nrsc.gov.in/arcgis/rest/services/NDEM",
      source_type: "VECTOR_POLYGONS",
      format: "Multi-temporal Satellite Microwave / Optical Inundation Polygons (1998-2022)",
      resolution: "30m - 50m spatial resolution across 24 flood seasons",
      temporal_coverage: "1998 to 2022 (Annual monsoon flood layers)",
      geographic_coverage: "All 35 Assam districts (20,645 historical inundation polygons)",
      version: "2022.1",
      processing_status: "PROCESSED",
      notes: "Multi-year historical flood inundation recurrence mapped to normalized 0-100 susceptibility score.",
    },
    {
      dataset_name: "ISRO_NDEM_Meghalaya_Flood_Inundation_2015_2022",
      factor: "flood_susceptibility",
      source_name: "National Database for Emergency Management (NDEM) / NESAC ISRO",
      provider: "North Eastern Space Applications Centre (NESAC) / ISRO",
      official_url: "https://nesac.gov.in/",
      implementation_url: "https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=flood",
      source_type: "VECTOR_POLYGONS",
      format: "Multi-temporal Satellite Microwave Inundation Polygons (2015-2022)",
      resolution: "30m - 50m spatial resolution (Flash flood & valley inundation)",
      temporal_coverage: "2015 to 2022 (Monsoon flash flood layers)",
      geographic_coverage: "Meghalaya plain border corridors (Garo Hills plain borders & valley wetlands)",
      version: "2022.1",
      processing_status: "PROCESSED",
      notes: "High-gradient flash flood inundation recurrence mapped to 500m grid cells.",
    },
  ];

  const results = [];
  for (const ds of datasets) {
    const qSql = `
      INSERT INTO datasets.registry (
        dataset_name, factor, source_name, provider, official_url, implementation_url,
        source_type, format, resolution, temporal_coverage, geographic_coverage,
        version, processing_status, notes, registered_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      )
      ON CONFLICT (dataset_name) DO UPDATE SET
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
        processing_status = EXCLUDED.processing_status,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(qSql, [
      ds.dataset_name,
      ds.factor,
      ds.source_name,
      ds.provider,
      ds.official_url,
      ds.implementation_url,
      ds.source_type,
      ds.format,
      ds.resolution,
      ds.temporal_coverage,
      ds.geographic_coverage,
      ds.version,
      ds.processing_status,
      ds.notes,
    ]);
    results.push(res.rows[0]);
  }

  return results;
};

// Returns metadata for all registered flood datasets
export const getFloodDatasets = async () => {
  const res = await pool.query(`
    SELECT * FROM datasets.registry 
    WHERE factor = 'flood_susceptibility'
    ORDER BY id ASC;
  `);
  return res.rows;
};

// Ingests a GeoJSON FeatureCollection of historical flood inundation polygons into disaster.flood_events
export const ingestFloodGeoJson = async (geoJson, stateName, eventYear, options = {}) => {
  if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
    throw new Error("Invalid or empty GeoJSON FeatureCollection");
  }

  const {
    sourceName = "ISRO NDEM / NRSC Bhuvan",
    eventName = null,
    eventDate = null,
    severityScore = 75,
  } = options;

  console.log(`Starting ingestion of ${geoJson.features.length} flood polygons for ${stateName} (${eventYear})...`);
  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    let insertedCount = 0;
    for (const feat of geoJson.features) {
      if (!feat.geometry) continue;

      const geomJson = JSON.stringify(feat.geometry);
      const props = feat.properties || {};
      const actualYear = props.year || eventYear || new Date().getFullYear();
      const actualDate = props.date || eventDate || `${actualYear}-07-15`;
      const actualName = props.event_name || eventName || `${stateName} Flood ${actualYear}`;
      const actualSeverity = props.severity || severityScore;
      const district = props.district || null;

      const insertSql = `
        INSERT INTO disaster.flood_events (
          event_name, state, district, event_year, event_date,
          hazard_type, severity_score, source_name, geom, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'FLOOD_INUNDATION', $6, $7,
          ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($8), 4326)),
          NOW()
        );
      `;

      await client.query(insertSql, [
        actualName,
        stateName,
        district,
        actualYear,
        actualDate,
        actualSeverity,
        sourceName,
        geomJson,
      ]);
      insertedCount++;
    }

    await client.query("COMMIT;");
    console.log(`Successfully ingested ${insertedCount} flood event polygons.`);

    // Recalculate static flood susceptibility on the grid
    await calculateStateFloodSusceptibility(stateName);

    return {
      success: true,
      insertedCount,
      state: stateName,
      eventYear,
    };
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error("Error during flood polygon ingestion:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Calculates and updates static flood susceptibility for state grids
// Harmonized across Assam and Meghalaya: binned on distinct flood years with reachable 95 tier and permanent water mask
export const calculateStateFloodSusceptibility = async (stateName) => {
  const isAssam = stateName.toLowerCase() === "assam";
  const tableName = isAssam ? "assam" : "meghalaya";
  const startTime = Date.now();

  console.log(`⏳ Calculating harmonized static flood susceptibility for grid_500m.${tableName}...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // Harmonized multi-year recurrence formula mapped to calibrated 5-tier classification:
    // >= 8 distinct flood years: 95 (Very High Hazard - reachable top tier)
    // 5 - 7 distinct flood years: 75 (High Hazard)
    // 3 - 4 distinct flood years: 55 (Moderate Hazard)
    // 2 distinct flood years: 35 (Low Hazard)
    // 1 distinct flood year: 20 (Very Low Hazard)
    // 0 years / uninundated: 0 (Flood Free)
    // Permanent water mask: cells with waterbody_percentage >= 80 (e.g. permanent Brahmaputra river channel) are capped
    const updateHarmonizedSql = `
      WITH grid_flood_agg AS (
        SELECT 
          g.id,
          COUNT(DISTINCT COALESCE(e.event_year, EXTRACT(YEAR FROM e.event_date::date)::int)) AS distinct_flood_years,
          COUNT(e.id) AS event_match_count
        FROM grid_500m.${tableName} g
        INNER JOIN disaster.flood_events e
          ON e.state = '${isAssam ? "Assam" : "Meghalaya"}' AND ST_Intersects(g.geom, e.geom)
        GROUP BY g.id
      )
      UPDATE grid_500m.${tableName} g
      SET flood_susceptibility = CASE
            -- Mask permanent water bodies from being categorized as anomalous flood surge
            WHEN COALESCE(g.waterbody_percentage, 0) >= 80.0 THEN 25
            WHEN a.distinct_flood_years >= 8 THEN 95
            WHEN a.distinct_flood_years >= 5 THEN 75
            WHEN a.distinct_flood_years >= 3 THEN 55
            WHEN a.distinct_flood_years >= 2 THEN 35
            WHEN a.distinct_flood_years >= 1 THEN 20
            ELSE 0
          END,
          updated_at = NOW()
      FROM grid_flood_agg a
      WHERE g.id = a.id;
    `;
    await client.query(updateHarmonizedSql);

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
    console.log(`✅ Calculated harmonized flood susceptibility for ${stateName} in ${duration}s:`, statsRes.rows[0]);

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
  registerFloodDatasets,
  getFloodDatasets,
  ingestFloodGeoJson,
  calculateStateFloodSusceptibility,
};
