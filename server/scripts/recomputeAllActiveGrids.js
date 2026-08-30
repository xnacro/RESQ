// Recomputes all currently linked grid cells in Assam and Meghalaya from active disaster events
import pool from "../config/db.js";
import { recomputeGridsFromActiveEvents, expireStaleEvents } from "../services/risk/dynamicRiskService.js";

async function runFullRecompute() {
  console.log("================================================================================");
  console.log("         RECOMPUTING ALL ACTIVE 500M GRID CELLS FROM ACTIVE EVENTS              ");
  console.log("================================================================================");

  // 1. Run event expiration
  const expireRes = await expireStaleEvents();
  console.log(`🧹 Stale Events Expired: ${expireRes.expiredEventsCount}`);

  // 2. Recompute Assam Grids
  const asGridsRes = await pool.query("SELECT DISTINCT grid_id FROM disaster.event_grid_links WHERE state = 'Assam';");
  if (asGridsRes.rows.length > 0) {
    const asIds = asGridsRes.rows.map((r) => r.grid_id);
    const asUpdate = await recomputeGridsFromActiveEvents(asIds, "Assam");
    console.log(`✅ Recomputed ${asUpdate.updatedCount} Assam grid cells!`);
  }

  // 3. Recompute Meghalaya Grids
  const mlGridsRes = await pool.query("SELECT DISTINCT grid_id FROM disaster.event_grid_links WHERE state = 'Meghalaya';");
  if (mlGridsRes.rows.length > 0) {
    const mlIds = mlGridsRes.rows.map((r) => r.grid_id);
    const mlUpdate = await recomputeGridsFromActiveEvents(mlIds, "Meghalaya");
    console.log(`✅ Recomputed ${mlUpdate.updatedCount} Meghalaya grid cells!`);
  }

  // 4. Inspect Sample Updated Cells
  const sampleCells = await pool.query(`
    SELECT grid_id, state, static_risk, news_risk, road_closure_risk, dynamic_risk, risk_score, risk_status, risk_confidence, last_dynamic_update
    FROM grid_500m.assam
    WHERE dynamic_risk > 0
    ORDER BY dynamic_risk DESC, risk_score DESC
    LIMIT 10;
  `);

  console.log("\n### Top Dynamically Elevated Grid Cells in Assam:");
  console.table(sampleCells.rows);

  process.exit(0);
}

runFullRecompute().catch((err) => {
  console.error("Recomputation failed:", err);
  process.exit(1);
});
