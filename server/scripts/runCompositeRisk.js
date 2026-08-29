// Pipeline script to compute composite static risk and risk status classification
import pool from "../config/db.js";
import { initDomainSchemas, computeCompositeStaticRisk } from "../services/risk/compositeRiskService.js";

async function run() {
  console.log("===============================================================");
  console.log("⚡ RESQ COMPOSITE STATIC RISK CALCULATION ENGINE");
  console.log("===============================================================\n");

  // 1. Initialize raw domain schemas
  await initDomainSchemas();

  // 2. Compute composite static risk for Meghalaya & Assam
  await computeCompositeStaticRisk("Meghalaya", 60000);
  await computeCompositeStaticRisk("Assam", 60000);

  // 3. Statistical breakdown for Assam
  const asStats = await pool.query(`
    SELECT 
      risk_status,
      COUNT(*) AS cell_count,
      ROUND((COUNT(*) * 100.0 / 317842), 2) AS percentage,
      ROUND(AVG(static_risk)::numeric, 1) AS mean_static_risk,
      ROUND(MIN(static_risk)::numeric, 1) AS min_static_risk,
      ROUND(MAX(static_risk)::numeric, 1) AS max_static_risk
    FROM grid_500m.assam
    GROUP BY risk_status
    ORDER BY mean_static_risk DESC;
  `);

  console.log("\n📊 ASSAM COMPOSITE RISK STATUS BREAKDOWN (317,842 cells):");
  console.table(asStats.rows);

  // 4. Statistical breakdown for Meghalaya
  const mlStats = await pool.query(`
    SELECT 
      risk_status,
      COUNT(*) AS cell_count,
      ROUND((COUNT(*) * 100.0 / 91144), 2) AS percentage,
      ROUND(AVG(static_risk)::numeric, 1) AS mean_static_risk,
      ROUND(MIN(static_risk)::numeric, 1) AS min_static_risk,
      ROUND(MAX(static_risk)::numeric, 1) AS max_static_risk
    FROM grid_500m.meghalaya
    GROUP BY risk_status
    ORDER BY mean_static_risk DESC;
  `);

  console.log("\n📊 MEGHALAYA COMPOSITE RISK STATUS BREAKDOWN (91,144 cells):");
  console.table(mlStats.rows);

  // 5. Landmark Probes with Static Risk & Risk Score
  const points = [
    { name: "Guwahati Urban Core (AS)", lat: 26.185, lon: 91.750, table: "grid_500m.assam" },
    { name: "Kaziranga Floodplain (AS)", lat: 26.580, lon: 93.350, table: "grid_500m.assam" },
    { name: "Dima Hasao Hill Range (AS)", lat: 25.180, lon: 93.020, table: "grid_500m.assam" },
    { name: "Silchar / Barak Basin (AS)", lat: 24.825, lon: 92.795, table: "grid_500m.assam" },
    { name: "Shillong Plateau Urban Core (ML)", lat: 25.578, lon: 91.893, table: "grid_500m.meghalaya" },
    { name: "Cherrapunji Escarpment (ML)", lat: 25.280, lon: 91.730, table: "grid_500m.meghalaya" },
    { name: "Tura / West Garo Hills (ML)", lat: 25.515, lon: 90.220, table: "grid_500m.meghalaya" },
  ];

  const landmarkProbes = [];
  for (const pt of points) {
    const res = await pool.query(
      `
      SELECT 
        grid_id,
        flood_susceptibility AS flood,
        landslide_susceptibility AS landslide,
        seismic_risk AS seismic,
        ROUND(population_density::numeric, 0) AS pop_den,
        ROUND(infrastructure_exposure::numeric, 0) AS infra,
        static_risk,
        dynamic_risk,
        risk_score,
        risk_confidence AS confidence,
        risk_status AS status
      FROM ${pt.table}
      WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
      LIMIT 1;
    `,
      [pt.lon, pt.lat]
    );

    if (res.rows[0]) {
      landmarkProbes.push({ landmark: pt.name, ...res.rows[0] });
    }
  }

  console.log("\n📍 LANDMARK MULTI-HAZARD RISK ASSESSMENTS:");
  console.table(landmarkProbes);

  console.log("\n===============================================================");
  console.log("🎉 RESQ SINGLE SOURCE OF TRUTH (SSOT) RISK ENGINE OPERATIONAL!");
  console.log("===============================================================\n");

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Error running composite risk pipeline:", err);
  process.exit(1);
});
