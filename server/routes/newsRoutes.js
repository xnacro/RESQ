// Express Router for RSS News Ingestion, NLP Disaster Events, Admin Controls, and Intelligence Analytics
import express from "express";
import pool from "../config/db.js";
import { pollAllRssSources } from "../services/news/rssService.js";
import {
  processPendingNewsItems,
  getActiveDisasterEvents,
  getDisasterEventById,
  getEventsForGrid,
} from "../services/news/newsEventService.js";
import {
  startNewsScheduler,
  stopNewsScheduler,
  runPipelineCycle,
  getSchedulerStatus,
} from "../services/news/newsSchedulerService.js";

const router = express.Router();

// GET /api/news/nlp/summary - Synthesized Incident Summary and Disaster Intelligence Overview
router.get("/nlp/summary", async (req, res) => {
  try {
    const events = await getActiveDisasterEvents();

    let roadBlocks = 0;
    let bridgeDamages = 0;
    let floodEvents = 0;
    let landslideEvents = 0;
    let highSeverityCount = 0;
    const affectedDistrictsSet = new Set();
    const affectedCorridorsSet = new Set();

    events.forEach((ev) => {
      if (ev.road_blocked) roadBlocks++;
      if (ev.bridge_damaged || ev.bridge_closed) bridgeDamages++;
      if (ev.hazard_type === "FLOOD" || ev.hazard_type === "FLASH_FLOOD") floodEvents++;
      if (ev.hazard_type === "LANDSLIDE") landslideEvents++;
      if (ev.severity >= 60) highSeverityCount++;
      if (ev.district) affectedDistrictsSet.add(ev.district);
      if (ev.location_text) {
        const text = ev.location_text.toLowerCase();
        if (text.includes("jorabat")) affectedCorridorsSet.add("Jorabat Corridor");
        if (text.includes("nh-27") || text.includes("nh 27")) affectedCorridorsSet.add("NH-27 Highway");
        if (text.includes("gs road")) affectedCorridorsSet.add("GS Road (Guwahati-Shillong)");
        if (text.includes("boragaon")) affectedCorridorsSet.add("Boragaon Bypass");
        if (text.includes("sivasagar")) affectedCorridorsSet.add("Sivasagar River Corridor");
        if (text.includes("cachar") || text.includes("silchar")) affectedCorridorsSet.add("Barak Valley Corridor");
      }
    });

    const affectedDistricts = Array.from(affectedDistrictsSet);
    const affectedCorridors = Array.from(affectedCorridorsSet);

    // Synthesize structured operational incident briefing
    let narrative = "Continuous NLP disaster intelligence processing is active across Assam and Meghalaya regional feeds. ";
    if (events.length === 0) {
      narrative += "No severe structural damage or critical road blockages detected in verified regional news feeds over the last 48 hours.";
    } else {
      narrative += `Currently monitoring ${events.length} active disaster developments across ${affectedDistricts.length || 1} districts. `;
      if (floodEvents > 0) {
        narrative += `${floodEvents} active flood and waterlogging alerts are registered. `;
      }
      if (roadBlocks > 0 || bridgeDamages > 0) {
        narrative += `High alert: ${roadBlocks} road blockages and ${bridgeDamages} bridge restrictions are impacting transport corridors. `;
      }
      if (affectedCorridors.length > 0) {
        narrative += `Key affected corridors include ${affectedCorridors.slice(0, 3).join(", ")}. `;
      }
      narrative += "Field operators and logistics convoys should consult the dynamic 500m risk grid before routing.";
    }

    return res.status(200).json({
      success: true,
      summary: {
        title: "Disaster Intelligence & Incident Summary",
        narrative,
        totalEvents: events.length,
        highSeverityCount,
        roadBlocks,
        bridgeDamages,
        floodEvents,
        landslideEvents,
        affectedDistricts: affectedDistricts.slice(0, 8),
        affectedCorridors: affectedCorridors.slice(0, 6),
        generatedAt: new Date().toISOString(),
        nlpModel: "RESQ-NLP-Extraction-v2.1",
      },
    });
  } catch (error) {
    console.error("NLP Summary error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/analytics - Analytics breakdown for Admin Console
router.get("/analytics", async (req, res) => {
  try {
    const sourcesCountRes = await pool.query("SELECT COUNT(*) AS count FROM news.rss_sources;");
    const itemsCountRes = await pool.query("SELECT COUNT(*) AS count FROM news.rss_items;");
    const eventsCountRes = await pool.query("SELECT COUNT(*) AS count FROM disaster.news_events;");
    const activeEventsCountRes = await pool.query("SELECT COUNT(*) AS count FROM disaster.news_events WHERE event_status = 'ACTIVE';");
    const gridLinksCountRes = await pool.query("SELECT COUNT(*) AS count FROM disaster.event_grid_links;");

    const hazardDistributionRes = await pool.query(`
      SELECT hazard_type, COUNT(*) AS count, ROUND(AVG(severity)::numeric, 1) AS avg_severity
      FROM disaster.news_events
      GROUP BY hazard_type
      ORDER BY count DESC;
    `);

    const districtDistributionRes = await pool.query(`
      SELECT district, COUNT(*) AS count, MAX(severity) AS max_severity
      FROM disaster.news_events
      WHERE district IS NOT NULL
      GROUP BY district
      ORDER BY count DESC
      LIMIT 10;
    `);

    return res.status(200).json({
      success: true,
      analytics: {
        totalSources: parseInt(sourcesCountRes.rows[0]?.count || 0, 10),
        totalItems: parseInt(itemsCountRes.rows[0]?.count || 0, 10),
        totalEvents: parseInt(eventsCountRes.rows[0]?.count || 0, 10),
        activeEvents: parseInt(activeEventsCountRes.rows[0]?.count || 0, 10),
        totalGridLinks: parseInt(gridLinksCountRes.rows[0]?.count || 0, 10),
        hazardDistribution: hazardDistributionRes.rows,
        districtDistribution: districtDistributionRes.rows,
      },
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/dsi - District Disaster Severity Index Rankings
router.get("/dsi", async (req, res) => {
  try {
    const dsiRes = await pool.query(`
      SELECT district, state,
             COUNT(DISTINCT e.id) AS active_events,
             COALESCE(ROUND(AVG(e.severity)::numeric, 1), 0) AS avg_severity,
             COALESCE(MAX(e.severity), 0) AS peak_severity,
             COUNT(DISTINCT l.grid_id) AS impacted_grids
      FROM disaster.news_events e
      LEFT JOIN disaster.event_grid_links l ON e.id = l.event_id
      WHERE e.event_status = 'ACTIVE' AND e.district IS NOT NULL
      GROUP BY district, state
      ORDER BY peak_severity DESC, active_events DESC;
    `);

    return res.status(200).json({
      success: true,
      dsi: dsiRes.rows,
    });
  } catch (error) {
    console.error("DSI fetch error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

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

// POST /api/news/sources - Create a new RSS feed source
router.post("/sources", async (req, res) => {
  try {
    const { name, url, language = "en", region = "Assam", source_type = "NEWS_RSS", reliability_tier = 2 } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, error: "Source name and URL are required" });
    }

    const insertRes = await pool.query(
      `INSERT INTO news.rss_sources (name, url, language, region, source_type, reliability_tier, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *;`,
      [name, url, language, region, source_type, parseInt(reliability_tier, 10) || 2]
    );

    return res.status(201).json({ success: true, source: insertRes.rows[0] });
  } catch (error) {
    console.error("Create source error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/news/sources/:id - Update RSS source details or toggle enabled
router.put("/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, language, region, source_type, reliability_tier, enabled } = req.body;

    const updateRes = await pool.query(
      `UPDATE news.rss_sources
       SET name = COALESCE($1, name),
           url = COALESCE($2, url),
           language = COALESCE($3, language),
           region = COALESCE($4, region),
           source_type = COALESCE($5, source_type),
           reliability_tier = COALESCE($6, reliability_tier),
           enabled = COALESCE($7, enabled)
       WHERE id = $8
       RETURNING *;`,
      [name, url, language, region, source_type, reliability_tier ? parseInt(reliability_tier, 10) : null, enabled, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Source not found" });
    }

    return res.status(200).json({ success: true, source: updateRes.rows[0] });
  } catch (error) {
    console.error("Update source error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/news/sources/:id - Delete an RSS source
router.delete("/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM news.rss_sources WHERE id = $1;", [id]);
    return res.status(200).json({ success: true, message: "Source deleted successfully" });
  } catch (error) {
    console.error("Delete source error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/items - List ingested raw news items with optional status filtering
router.get("/items", async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = `
      SELECT i.id, i.source_id, i.guid, i.title, i.published_at, i.processing_status, i.url, i.content,
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

// PATCH /api/news/events/:id/status - Override disaster event status (ACTIVE, RESOLVED, FALSE_ALARM)
router.patch("/events/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: "Status is required" });
    }

    const updateRes = await pool.query(
      `UPDATE disaster.news_events SET event_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`,
      [status.toUpperCase(), id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    return res.status(200).json({ success: true, event: updateRes.rows[0] });
  } catch (error) {
    console.error("Event status update error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/news/events - List all disaster events
router.get("/events", async (req, res) => {
  try {
    const { limit = 50, hazardType } = req.query;
    let query = `
      SELECT e.id, e.event_type, e.hazard_type, e.severity, e.confidence, e.location_text,
             e.district, e.state, e.latitude, e.longitude, e.road_blocked, e.bridge_damaged,
             e.bridge_closed, e.reported_at, e.event_status, i.title AS news_title, s.name AS source_name
      FROM disaster.news_events e
      LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
      LEFT JOIN news.rss_sources s ON i.source_id = s.id
    `;
    const params = [];

    if (hazardType) {
      params.push(hazardType.toUpperCase());
      query += ` WHERE e.hazard_type = $1`;
    }

    query += ` ORDER BY e.reported_at DESC LIMIT $${params.length + 1};`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, events: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/poll - Trigger manual polling of all enabled RSS sources
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

// GET /api/news/cron/status - Get background cron scheduler status and metrics
router.get("/cron/status", (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/cron/start - Start automated background cron scheduler
router.post("/cron/start", (req, res) => {
  try {
    const { intervalMinutes = 15, runImmediately = true } = req.body;
    const status = startNewsScheduler(parseInt(intervalMinutes, 10), runImmediately === true);
    res.json({ success: true, message: "News scheduler started", ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/cron/stop - Stop automated background cron scheduler
router.post("/cron/stop", (req, res) => {
  try {
    const status = stopNewsScheduler();
    res.json({ success: true, message: "News scheduler stopped", ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/cron/run-now - Trigger an immediate end-to-end cron pipeline cycle
router.post("/cron/run-now", async (req, res) => {
  try {
    const result = await runPipelineCycle();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
