// High-performance batch relinking of active disaster events
import pool from "../config/db.js";
import { findAffectedGridCells } from "../services/news/newsGeolocationService.js";
import { recomputeGridsFromActiveEvents } from "../services/risk/dynamicRiskService.js";

async function runRelink() {
  console.log("================================================================================");
  console.log("         BATCH RELINKING ACTIVE DISASTER EVENTS (FAST BATCH INSERT)            ");
  console.log("================================================================================");

  const eventsRes = await pool.query(`
    SELECT id, event_type, hazard_type, severity, confidence, latitude, longitude, state, road_blocked, bridge_closed
    FROM disaster.news_events
    WHERE event_status = 'ACTIVE';
  `);

  console.log(`Found ${eventsRes.rows.length} active disaster events.`);
  const rowsToInsert = [];
  const affectedAssamGrids = new Set();
  const affectedMeghalayaGrids = new Set();

  for (const ev of eventsRes.rows) {
    if (!ev.latitude || !ev.longitude) continue;

    const bufferMeters =
      ev.hazard_type === "FLOOD" || ev.hazard_type === "FLASH_FLOOD"
        ? 12000
        : ev.road_blocked || ev.bridge_closed
        ? 6000
        : 5000;

    const state = ev.state || "Assam";
    const grids = await findAffectedGridCells(parseFloat(ev.latitude), parseFloat(ev.longitude), bufferMeters, state);

    const finalConfidence = parseFloat(ev.confidence || 0.9);
    const severity = parseFloat(ev.severity || 60);

    for (const grid of grids) {
      const distanceM = parseFloat(grid.distance_m || 0);
      const decay = Math.max(0.15, 1.0 - distanceM / bufferMeters);
      const impactScore = Math.round(severity * finalConfidence * decay * 10) / 10;

      rowsToInsert.push({
        eventId: ev.id,
        gridId: grid.grid_id,
        state: grid.state,
        impactScore,
      });

      if ((grid.state || "Assam").toLowerCase() === "assam") {
        affectedAssamGrids.add(grid.grid_id);
      } else {
        affectedMeghalayaGrids.add(grid.grid_id);
      }
    }
  }

  console.log(`Collected ${rowsToInsert.length} grid links to batch insert.`);

  // Single transaction batch insert with UNNEST for maximum speed (<100ms)
  if (rowsToInsert.length > 0) {
    const eventIds = rowsToInsert.map((r) => r.eventId);
    const gridIds = rowsToInsert.map((r) => r.gridId);
    const states = rowsToInsert.map((r) => r.state);
    const scores = rowsToInsert.map((r) => r.impactScore);

    await pool.query(`
      INSERT INTO disaster.event_grid_links (event_id, grid_id, state, impact_score)
      SELECT * FROM UNNEST($1::bigint[], $2::varchar[], $3::varchar[], $4::numeric[])
      ON CONFLICT (event_id, grid_id) DO UPDATE SET impact_score = EXCLUDED.impact_score;
    `, [eventIds, gridIds, states, scores]);

    console.log(`✅ Batch inserted ${rowsToInsert.length} grid links successfully.`);
  }

  // Recompute dynamic risk for affected cells
  if (affectedAssamGrids.size > 0) {
    const asRes = await recomputeGridsFromActiveEvents(Array.from(affectedAssamGrids), "Assam");
    console.log(`✅ Recalibrated ${asRes.updatedCount} Assam grid cells!`);
  }

  if (affectedMeghalayaGrids.size > 0) {
    const mlRes = await recomputeGridsFromActiveEvents(Array.from(affectedMeghalayaGrids), "Meghalaya");
    console.log(`✅ Recalibrated ${mlRes.updatedCount} Meghalaya grid cells!`);
  }

  // Inspect user coordinate cell
  const userCell = await pool.query(`
    SELECT grid_id, static_risk, dynamic_risk, risk_score, risk_status, news_risk
    FROM grid_500m.assam
    WHERE ST_Contains(geom, ST_SetSRID(ST_Point(91.6986, 26.1898), 4326));
  `);
  console.log("\nUser GPS Cell Status (North Guwahati / Amingaon):", userCell.rows[0]);

  process.exit(0);
}

runRelink().catch((err) => {
  console.error("Relinking failed:", err);
  process.exit(1);
});
