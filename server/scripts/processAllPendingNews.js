// Batch process all pending news articles through NLP extraction and 500m grid linking
import pool from "../config/db.js";
import { processPendingNewsItems, getActiveDisasterEvents } from "../services/news/newsEventService.js";

async function run() {
  console.log("================================================================================");
  console.log("     BATCH PROCESSING ALL PENDING NEWS ARTICLES THROUGH NLP DISASTER ENGINE     ");
  console.log("================================================================================");

  const startTime = Date.now();
  const summary = await processPendingNewsItems(400);
  console.log("\nNLP Extraction & Linking Summary:", summary);

  const activeEvents = await getActiveDisasterEvents();
  console.log(`\n✅ Total Active Disaster Events in DB: ${activeEvents.length}`);

  const sampleEvents = activeEvents.slice(0, 10).map((e) => ({
    id: e.id,
    type: e.event_type,
    hazard: e.hazard_type,
    severity: e.severity,
    location: e.location_text,
    district: e.district,
    state: e.state,
    title: (e.news_title || "").substring(0, 60),
  }));

  console.table(sampleEvents);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Processed all articles in ${durationSec}s!`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Batch processing failed:", err);
  process.exit(1);
});
