// RESQ RSS News Ingestion & NLP Disaster Event Pipeline Runner
// Initializes schemas, polls RSS sources, processes news items, extracts disaster events, and links affected 500m grids
import pool from "../config/db.js";
import { initNewsAndEventSchemas } from "../services/news/newsSchemaService.js";
import { syncRssSources, pollAllRssSources, computeItemHash } from "../services/news/rssService.js";
import { processPendingNewsItems, getActiveDisasterEvents } from "../services/news/newsEventService.js";

// Deterministic regional disaster test fixtures for pipeline validation
const TEST_FIXTURES = [
  {
    sourceId: "sentinel_assam",
    guid: "test-boko-flood-2026-01",
    title: "Heavy rainfall has flooded roads in Boko, Kamrup district, leaving several routes blocked.",
    description: "Incessant rains over the past 24 hours have caused severe waterlogging and flash floods across Boko subdivision. District authorities reported several road blockages and marooned villages.",
    url: "https://example.com/news/boko-flood-2026",
    publishedAt: new Date(),
  },
  {
    sourceId: "shillong_times",
    guid: "test-nongpoh-bridge-2026-01",
    title: "Officials announced a bridge closure after structural damage near Nongpoh.",
    description: "Ri-Bhoi district administration has suspended all vehicular movement over the damaged bridge near Nongpoh along the Guwahati-Shillong corridor following heavy erosion.",
    url: "https://example.com/news/nongpoh-bridge-closure",
    publishedAt: new Date(),
  },
  {
    sourceId: "northeast_now",
    guid: "test-silchar-barak-2026-01",
    title: "Barak River crosses danger mark in Silchar; flood water submerges key residential roads.",
    description: "Cachar district administration has sounded flood alert after the Barak river crossed danger level, inundating low-lying roads and affecting transport.",
    url: "https://example.com/news/silchar-barak-flood",
    publishedAt: new Date(),
  },
  {
    sourceId: "eastmojo",
    guid: "test-guwahati-traffic-noise-01",
    title: "Residents complain about traffic congestion due to peak hours in Guwahati.",
    description: "Commuters in Guwahati faced routine morning traffic snarls across GS Road today during peak office hours.",
    url: "https://example.com/news/guwahati-traffic-routine",
    publishedAt: new Date(),
  },
];

async function run() {
  console.log("===============================================================");
  console.log("📰 RESQ RSS NEWS INGESTION + NLP DISASTER EXTRACTION PIPELINE");
  console.log("===============================================================\n");

  const startTime = Date.now();

  // 1. Initialize Schemas and Tables
  console.log("🛠️ Step 1: Initializing news & disaster PostGIS schemas...");
  await initNewsAndEventSchemas();

  // 2. Synchronize RSS Source configurations
  console.log("\n📡 Step 2: Synchronizing RSS sources...");
  await syncRssSources();

  // 3. Poll Live RSS Sources
  console.log("\n🌐 Step 3: Polling configured live RSS feeds...");
  const pollResults = await pollAllRssSources();
  console.table(pollResults);

  // 4. Inject Test Fixtures into news.rss_items
  console.log("\n🧪 Step 4: Storing deterministic verification fixtures...");
  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");
    for (const fix of TEST_FIXTURES) {
      const hash = computeItemHash(fix.sourceId, fix.url, fix.title, fix.description);
      await client.query(
        `
        INSERT INTO news.rss_items (
          source_id, guid, title, description, url, published_at, content_hash, processing_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW')
        ON CONFLICT (content_hash) DO NOTHING;
      `,
        [fix.sourceId, fix.guid, fix.title, fix.description, fix.url, fix.publishedAt, hash]
      );
    }
  } finally {
    client.release();
  }

  // 5. Process Pending News Items through NLP Pipeline
  console.log("\n🧠 Step 5: Executing NLP extraction, geocoding & 500m grid linking...");
  const processSummary = await processPendingNewsItems(100);
  console.log("NLP Processing Summary:", processSummary);

  // 6. Inspect Extracted Active Disaster Events
  console.log("\n🚨 Step 6: Active Extracted Disaster Events:");
  const activeEvents = await getActiveDisasterEvents();
  console.table(
    activeEvents.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      hazard: e.hazard_type,
      severity: e.severity,
      confidence: e.confidence,
      location: e.location_text,
      state: e.state,
      lat: e.latitude,
      lon: e.longitude,
      road_blocked: e.road_blocked,
      bridge_closed: e.bridge_closed,
      corroborated_sources: e.source_count || 1,
      source: e.source_name,
    }))
  );

  // 7. Inspect Affected 500m Grid Cells with Dynamic Risk
  console.log("\n🗺️ Step 7: Linked 500m Risk Grid Cells Sample:");
  const gridLinks = await pool.query(`
    SELECT 
      l.event_id,
      l.grid_id,
      l.state,
      l.impact_score,
      e.event_type,
      e.location_text
    FROM disaster.event_grid_links l
    JOIN disaster.news_events e ON l.event_id = e.id
    ORDER BY l.impact_score DESC
    LIMIT 15;
  `);
  console.table(gridLinks.rows);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n===============================================================");
  console.log(`🎉 NEWS & NLP DISASTER EXTRACTION PIPELINE COMPLETE IN ${duration}s!`);
  console.log("===============================================================\n");

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Pipeline execution failed:", err);
  process.exit(1);
});
