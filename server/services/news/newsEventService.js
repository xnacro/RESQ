// End-to-End RSS News to Disaster Event Processor & Spatial Grid Linker
import pool from "../../config/db.js";
import { extractDisasterEvent } from "../../../nlp/extraction/eventExtractor.js";
import { resolveCoordinates, findAffectedGridCells } from "./newsGeolocationService.js";
import { clusterAndCorroborateEvent } from "./corroborationService.js";
import { recomputeGridsFromActiveEvents } from "../risk/dynamicRiskService.js";
import { classifyDisasterText } from "../ml/disasterClassifierService.js";

// Processes all pending RSS news items through NLP extraction, deduplication, and 500m grid linking
export const processPendingNewsItems = async (batchLimit = 50) => {
  const summary = {
    processed: 0,
    filteredOut: 0,
    eventsCreated: 0,
    gridsLinked: 0,
    failed: 0,
  };

  const affectedAssamGrids = new Set();
  const affectedMeghalayaGrids = new Set();

  // ML configuration flags
  const mlEnabled = process.env.ML_CLASSIFIER_ENABLED !== "false";
  const mlMode = process.env.ML_CLASSIFIER_MODE || "shadow"; // 'off' | 'shadow' | 'active'
  const mlThreshold = parseFloat(process.env.ML_CONFIDENCE_THRESHOLD) || 0.70;

  // 1. Fetch pending items ordered by published date
  const itemsRes = await pool.query(
    `
    SELECT 
      i.id, i.source_id, i.guid, i.title, i.description, i.url, i.published_at,
      s.reliability_tier, s.source_type, s.region
    FROM news.rss_items i
    JOIN news.rss_sources s ON i.source_id = s.id
    WHERE i.processing_status = 'NEW'
    ORDER BY i.published_at DESC
    LIMIT $1;
  `,
    [batchLimit]
  );

  if (itemsRes.rows.length === 0) {
    return summary;
  }

  for (const row of itemsRes.rows) {
    summary.processed++;
    try {
      // 2. Extract structured disaster event via NLP pipeline
      const nlpResult = extractDisasterEvent(
        row.title,
        row.description,
        row.source_id,
        row.url
      );

      if (!nlpResult.isDisasterEvent) {
        await pool.query(
          `UPDATE news.rss_items SET processing_status = 'FILTERED' WHERE id = $1;`,
          [row.id]
        );
        summary.filteredOut++;
        continue;
      }

      // 3. Execute ML classification on combined headline + description
      let mlResult = null;
      if (mlEnabled && mlMode !== "off") {
        try {
          const combinedText = `${row.title || ""} ${row.description || ""}`.trim();
          mlResult = classifyDisasterText(combinedText);
        } catch (err) {
          console.warn(`[ML-INFERENCE] Error classifying item #${row.id}:`, err.message);
        }
      }

      // Attach ML metadata to extraction payload for audit trail
      if (mlResult && mlResult.isReady) {
        nlpResult.ml = {
          label: mlResult.label,
          confidence: mlResult.confidence,
          probabilities: mlResult.probabilities,
          modelVersion: mlResult.modelVersion,
          isDisaster: mlResult.isDisaster,
          mode: mlMode,
        };
      }

      // 4. In Active Mode: Apply Conservative Event Gate
      if (mlMode === "active" && mlResult && mlResult.isReady && !mlResult.fallback) {
        const isQualifiedActive = mlResult.label === "ACTIVE_DISASTER" && mlResult.confidence >= mlThreshold;
        if (!isQualifiedActive) {
          console.log(`[ML-GATE] Filtered non-active item #${row.id}: Label=${mlResult.label}, Conf=${mlResult.confidence}`);
          await pool.query(
            `UPDATE news.rss_items SET processing_status = 'NLP_PROCESSED_NON_ACTIVE' WHERE id = $1;`,
            [row.id]
          );
          summary.filteredOut++;
          continue;
        }
      }

      // 5. In Shadow Mode: Log comparison telemetry without modifying event creation
      if (mlMode === "shadow" && mlResult && mlResult.isReady) {
        console.log(
          `[SHADOW-EVAL] Item #${row.id}: Legacy=ACTIVE vs ML=${mlResult.label} (Conf: ${mlResult.confidence})`
        );
      }

      // 6. Resolve Geolocation Coordinates
      const geoResult = await resolveCoordinates(nlpResult.location);

      if (!geoResult) {
        // Event extracted but could not resolve to coordinates
        await pool.query(
          `UPDATE news.rss_items SET processing_status = 'NLP_PROCESSED' WHERE id = $1;`,
          [row.id]
        );
        continue;
      }

      // 7. Adjust confidence based on source reliability tier
      let finalConfidence = nlpResult.confidence;
      if (row.reliability_tier === 1) {
        finalConfidence = Math.min(0.98, finalConfidence + 0.15);
      } else if (row.reliability_tier === 3) {
        finalConfidence = Math.max(0.3, finalConfidence - 0.10);
      }

      // 8. Insert Disaster News Event
      const state = nlpResult.location.state || (geoResult.lat > 25.7 && geoResult.lon > 91.5 ? "Assam" : "Meghalaya");
      const insertEventSql = `
        INSERT INTO disaster.news_events (
          rss_item_id, event_type, hazard_type, severity, confidence,
          location_text, district, state, latitude, longitude, geom,
          asset_type, asset_name, road_blocked, bridge_damaged, bridge_closed,
          event_time, reported_at, valid_until, event_status,
          nlp_model, nlp_version, raw_extraction
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, ST_SetSRID(ST_Point($10, $9), 4326),
          $11, $12, $13, $14, $15,
          $16, NOW(), NOW() + INTERVAL '48 hours', 'ACTIVE',
          $17, $18, $19
        )
        RETURNING id;
      `;

      const eventRes = await pool.query(insertEventSql, [
        row.id,
        nlpResult.eventType,
        nlpResult.hazardType,
        nlpResult.severity,
        finalConfidence,
        nlpResult.location.rawText,
        nlpResult.location.district,
        state,
        geoResult.lat,
        geoResult.lon,
        nlpResult.asset.type,
        nlpResult.asset.name,
        nlpResult.impact.roadBlocked,
        nlpResult.impact.bridgeDamaged,
        nlpResult.impact.bridgeClosed,
        nlpResult.temporal.eventTime,
        nlpResult.nlpMeta.model,
        nlpResult.nlpMeta.version,
        JSON.stringify(nlpResult),
      ]);

      const eventId = eventRes.rows[0].id;
      summary.eventsCreated++;

      // 9. Corroborate and Cluster Multi-Source Reports
      await clusterAndCorroborateEvent(eventId, nlpResult, geoResult.lat, geoResult.lon);

      // 10. Find Affected 500m Grid Cells within 5km to 12km regional impact radius
      const bufferMeters =
        nlpResult.hazardType === "FLOOD" || nlpResult.hazardType === "FLASH_FLOOD"
          ? 12000
          : nlpResult.asset.type === "ROAD" || nlpResult.asset.type === "BRIDGE"
          ? 6000
          : 5000;
      const affectedGrids = await findAffectedGridCells(geoResult.lat, geoResult.lon, bufferMeters, state);

      if (affectedGrids.length > 0) {
        const eventIds = [];
        const gridIds = [];
        const states = [];
        const impactScores = [];

        affectedGrids.forEach((g) => {
          eventIds.push(eventId);
          gridIds.push(g.grid_id);
          states.push(g.state);

          const distanceRatio = Math.max(0, 1 - g.distance_meters / bufferMeters);
          const impactScore = Math.round(nlpResult.severity * finalConfidence * distanceRatio * 100) / 100;
          impactScores.push(impactScore);

          if (g.state === "Assam") {
            affectedAssamGrids.add(g.grid_id);
          } else {
            affectedMeghalayaGrids.add(g.grid_id);
          }
        });

        await pool.query(
          `
          INSERT INTO disaster.event_grid_links (event_id, grid_id, state, impact_score)
          SELECT unnest($1::int[]), unnest($2::text[]), unnest($3::varchar[]), unnest($4::float[])
          ON CONFLICT (event_id, grid_id) DO UPDATE SET impact_score = EXCLUDED.impact_score;
        `,
          [eventIds, gridIds, states, impactScores]
        );

        summary.gridsLinked += affectedGrids.length;
      }

      // Update source item status to GRID_LINKED
      await pool.query(
        `UPDATE news.rss_items SET processing_status = 'GRID_LINKED' WHERE id = $1;`,
        [row.id]
      );
    } catch (err) {
      console.error(`Failed to process news item #${row.id}:`, err.message);
      summary.failed++;
      await pool.query(
        `UPDATE news.rss_items SET processing_status = 'FAILED' WHERE id = $1;`,
        [row.id]
      );
    }
  }

  // 11. Recompute Dynamic Risk for Affected 500m Grids
  if (affectedAssamGrids.size > 0 || affectedMeghalayaGrids.size > 0) {
    try {
      await recomputeGridsFromActiveEvents(affectedAssamGrids, affectedMeghalayaGrids);
    } catch (riskErr) {
      console.error("Failed to recompute dynamic risk after news processing:", riskErr.message);
    }
  }

  return summary;
};

// Retrieves currently active disaster events from database with linked grid counts
export const getActiveDisasterEvents = async () => {
  const query = `
    SELECT 
      e.id, e.event_type, e.hazard_type, e.severity, e.confidence,
      e.location_text, e.district, e.state, e.latitude, e.longitude,
      e.asset_type, e.asset_name, e.road_blocked, e.bridge_damaged, e.bridge_closed,
      e.event_time, e.reported_at, e.valid_until, e.event_status,
      e.raw_extraction,
      i.title AS news_title, i.url AS news_url, s.name AS source_name, s.reliability_tier,
      COUNT(l.grid_id) AS impacted_grids_count
    FROM disaster.news_events e
    JOIN news.rss_items i ON e.rss_item_id = i.id
    JOIN news.rss_sources s ON i.source_id = s.id
    LEFT JOIN disaster.event_grid_links l ON e.id = l.event_id
    WHERE e.event_status = 'ACTIVE' AND e.valid_until > NOW()
    GROUP BY e.id, i.title, i.url, s.name, s.reliability_tier
    ORDER BY e.reported_at DESC;
  `;
  const res = await pool.query(query);
  return res.rows;
};

// Retrieves a single disaster event by ID with all linked 500m grid cell IDs
export const getDisasterEventById = async (eventId) => {
  const eventRes = await pool.query(
    `
    SELECT 
      e.id, e.event_type, e.hazard_type, e.severity, e.confidence,
      e.location_text, e.district, e.state, e.latitude, e.longitude,
      e.asset_type, e.asset_name, e.road_blocked, e.bridge_damaged, e.bridge_closed,
      e.event_time, e.reported_at, e.valid_until, e.event_status, e.raw_extraction,
      i.title AS news_title, i.url AS news_url, s.name AS source_name
    FROM disaster.news_events e
    JOIN news.rss_items i ON e.rss_item_id = i.id
    JOIN news.rss_sources s ON i.source_id = s.id
    WHERE e.id = $1;
  `,
    [eventId]
  );

  if (eventRes.rows.length === 0) return null;

  const gridsRes = await pool.query(
    `
    SELECT grid_id, state, impact_score, linked_at
    FROM disaster.event_grid_links
    WHERE event_id = $1
    ORDER BY impact_score DESC;
  `,
    [eventId]
  );

  return {
    event: eventRes.rows[0],
    impactedGrids: gridsRes.rows,
  };
};

// Retrieves disaster events affecting a specific 500m grid cell ID
export const getEventsForGrid = async (gridId) => {
  const res = await pool.query(
    `
    SELECT 
      e.id, e.event_type, e.hazard_type, e.severity, e.confidence,
      e.location_text, e.district, e.state, e.latitude, e.longitude,
      e.road_blocked, e.bridge_damaged, e.bridge_closed,
      l.impact_score, l.linked_at,
      i.title AS news_title, s.name AS source_name
    FROM disaster.event_grid_links l
    JOIN disaster.news_events e ON l.event_id = e.id
    JOIN news.rss_items i ON e.rss_item_id = i.id
    JOIN news.rss_sources s ON i.source_id = s.id
    WHERE l.grid_id = $1 AND e.event_status = 'ACTIVE' AND e.valid_until > NOW()
    ORDER BY l.impact_score DESC;
  `,
    [gridId]
  );
  return res.rows;
};

export default {
  processPendingNewsItems,
  getActiveDisasterEvents,
  getDisasterEventById,
  getEventsForGrid,
};
