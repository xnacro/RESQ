// Express Router for RSS News Ingestion & NLP Disaster Events
import express from "express";
import pool from "../config/db.js";
import { pollAllRssSources } from "../services/news/rssService.js";
import {
  processPendingNewsItems,
  getActiveDisasterEvents,
  getDisasterEventById,
  getEventsForGrid,
} from "../services/news/newsEventService.js";

const router = express.Router();

// GET /api/news/sources - List all configured RSS sources
router.get("/sources", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, url, language, region, source_type, reliability_tier, enabled, last_polled_at, last_status
      FROM news.rss_sources
      ORDER BY reliability_tier ASC, name ASC;
    `);
    res.json({ success: true, count: result.rows.length, sources: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/items - List ingested raw news items with optional status filtering
router.get("/items", async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = `
      SELECT i.id, i.source_id, i.guid, i.title, i.published_at, i.processing_status, i.url,
             s.name AS source_name, s.reliability_tier
      FROM news.rss_items i
      LEFT JOIN news.rss_sources s ON i.source_id = s.id
    `;
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      query += ` WHERE i.processing_status = $1`;
    }

    query += ` ORDER BY i.published_at DESC NULLS LAST, i.id DESC LIMIT $${params.length + 1};`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, items: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/events/active - List active disaster events
router.get("/events/active", async (req, res) => {
  try {
    const events = await getActiveDisasterEvents();
    res.json({ success: true, count: events.length, events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/events/grid/:gridId - List disaster events affecting a specific 500m grid cell
router.get("/events/grid/:gridId", async (req, res) => {
  try {
    const { gridId } = req.params;
    const events = await getEventsForGrid(gridId);
    res.json({ success: true, gridId, count: events.length, events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/events/:id - Get detailed single disaster event with linked 500m grids
router.get("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getDisasterEventById(id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Disaster event not found" });
    }
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/events - List all disaster events
router.get("/events", async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(
      `
      SELECT e.id, e.event_type, e.hazard_type, e.severity, e.confidence, e.location_text,
             e.district, e.state, e.latitude, e.longitude, e.road_blocked, e.bridge_damaged,
             e.bridge_closed, e.reported_at, e.event_status, i.title AS news_title, s.name AS source_name
      FROM disaster.news_events e
      LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
      LEFT JOIN news.rss_sources s ON i.source_id = s.id
      ORDER BY e.reported_at DESC
      LIMIT $1;
    `,
      [parseInt(limit, 10)]
    );
    res.json({ success: true, count: result.rows.length, events: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/poll - Trigger polling of all enabled RSS sources
router.post("/poll", async (req, res) => {
  try {
    console.log("⚡ Triggered RSS polling via API endpoint...");
    const pollResults = await pollAllRssSources();
    res.json({ success: true, message: "RSS polling completed", results: pollResults });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/process-pending - Trigger NLP extraction and 500m grid linking on pending items
router.post("/process-pending", async (req, res) => {
  try {
    const { batchSize = 50 } = req.body;
    console.log(`⚡ Processing up to ${batchSize} pending RSS items via API endpoint...`);
    const summary = await processPendingNewsItems(parseInt(batchSize, 10));
    res.json({ success: true, message: "Pending news NLP processing completed", summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
