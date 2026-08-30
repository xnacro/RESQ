// Comprehensive Dynamic Risk System Audit and Verification Script
import pool from "../config/db.js";

async function runDynamicAudit() {
  console.log("================================================================================");
  console.log("             RESQ DYNAMIC RISK SYSTEM READINESS & METRICS AUDIT                 ");
  console.log("================================================================================");

  // 1. Grid Level Dynamic Factor Statistics
  const asStats = await pool.query(`
    SELECT 
      COUNT(*) AS total_cells,
      COUNT(CASE WHEN news_risk > 0 THEN 1 END) AS news_risk_gt_0,
      MAX(news_risk) AS max_news_risk,
      COUNT(CASE WHEN nlp_event_risk > 0 THEN 1 END) AS nlp_risk_gt_0,
      MAX(nlp_event_risk) AS max_nlp_risk,
      COUNT(CASE WHEN road_closure_risk > 0 THEN 1 END) AS road_closure_gt_0,
      COUNT(CASE WHEN dynamic_risk > 0 THEN 1 END) AS dynamic_risk_gt_0,
      COUNT(CASE WHEN rainfall_risk > 0 THEN 1 END) AS rainfall_gt_0,
      COUNT(CASE WHEN flood_event_risk > 0 THEN 1 END) AS flood_event_gt_0,
      COUNT(CASE WHEN earthquake_event_risk > 0 THEN 1 END) AS earthquake_event_gt_0,
      COUNT(CASE WHEN landslide_event_risk > 0 THEN 1 END) AS landslide_event_gt_0,
      COUNT(CASE WHEN citizen_report_risk > 0 THEN 1 END) AS citizen_report_gt_0,
      COUNT(CASE WHEN last_dynamic_update IS NOT NULL THEN 1 END) AS dynamically_updated_cells
    FROM grid_500m.assam;
  `);

  const mlStats = await pool.query(`
    SELECT 
      COUNT(*) AS total_cells,
      COUNT(CASE WHEN news_risk > 0 THEN 1 END) AS news_risk_gt_0,
      MAX(news_risk) AS max_news_risk,
      COUNT(CASE WHEN nlp_event_risk > 0 THEN 1 END) AS nlp_risk_gt_0,
      MAX(nlp_event_risk) AS max_nlp_risk,
      COUNT(CASE WHEN road_closure_risk > 0 THEN 1 END) AS road_closure_gt_0,
      COUNT(CASE WHEN dynamic_risk > 0 THEN 1 END) AS dynamic_risk_gt_0,
      COUNT(CASE WHEN rainfall_risk > 0 THEN 1 END) AS rainfall_gt_0,
      COUNT(CASE WHEN flood_event_risk > 0 THEN 1 END) AS flood_event_gt_0,
      COUNT(CASE WHEN earthquake_event_risk > 0 THEN 1 END) AS earthquake_event_gt_0,
      COUNT(CASE WHEN landslide_event_risk > 0 THEN 1 END) AS landslide_event_gt_0,
      COUNT(CASE WHEN citizen_report_risk > 0 THEN 1 END) AS citizen_report_gt_0,
      COUNT(CASE WHEN last_dynamic_update IS NOT NULL THEN 1 END) AS dynamically_updated_cells
    FROM grid_500m.meghalaya;
  `);

  console.log("\n### 1. ASSAM GRID DYNAMIC FACTOR DISTRIBUTION");
  console.table(asStats.rows);

  console.log("\n### 2. MEGHALAYA GRID DYNAMIC FACTOR DISTRIBUTION");
  console.table(mlStats.rows);

  // 2. Sample Ingested Events Trace
  console.log("\n### 3. SAMPLE EXTRACTED DISASTER EVENTS & TRACE");
  const sampleEvents = await pool.query(`
    SELECT 
      e.id AS event_id,
      e.rss_item_id,
      e.event_type,
      e.hazard_type,
      e.severity,
      e.confidence,
      e.location_text,
      e.district,
      e.state,
      e.latitude,
      e.longitude,
      e.road_blocked,
      e.bridge_damaged,
      e.bridge_closed,
      e.event_status,
      e.reported_at,
      e.valid_until,
      i.title AS news_title,
      s.name AS source_name,
      s.reliability_tier,
      COUNT(l.id) AS linked_grid_count
    FROM disaster.news_events e
    LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
    LEFT JOIN news.rss_sources s ON i.source_id = s.id
    LEFT JOIN disaster.event_grid_links l ON e.id = l.event_id
    GROUP BY e.id, i.title, s.name, s.reliability_tier
    ORDER BY e.reported_at DESC
    LIMIT 10;
  `);
  console.table(sampleEvents.rows);

  // 3. Sample Grid Linkage Trace
  console.log("\n### 4. SAMPLE EVENT-TO-GRID LINKS (WITH DISTANCE DECAY IMPACT)");
  const sampleLinks = await pool.query(`
    SELECT 
      l.id AS link_id,
      l.event_id,
      l.grid_id,
      l.state,
      l.impact_score,
      l.linked_at,
      e.event_type,
      e.severity,
      e.confidence,
      e.location_text
    FROM disaster.event_grid_links l
    JOIN disaster.news_events e ON l.event_id = e.id
    ORDER BY l.impact_score DESC
    LIMIT 10;
  `);
  console.table(sampleLinks.rows);

  // 4. Sample Dynamically Impacted Grid Cells Inspection
  console.log("\n### 5. SAMPLE DYNAMICALLY UPDATED GRID CELLS");
  const updatedAssamGrids = await pool.query(`
    SELECT 
      grid_id, state, district, static_risk, news_risk, nlp_event_risk, road_closure_risk,
      dynamic_risk, risk_score, risk_confidence, risk_status, last_dynamic_update
    FROM grid_500m.assam
    WHERE last_dynamic_update IS NOT NULL
    ORDER BY news_risk DESC
    LIMIT 10;
  `);
  console.table(updatedAssamGrids.rows);

  process.exit(0);
}

runDynamicAudit().catch((err) => {
  console.error("Dynamic audit failed:", err);
  process.exit(1);
});
