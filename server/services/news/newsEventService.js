// End-to-End RSS News to Disaster Event Processor & Spatial Grid Linker
import pool from "../../config/db.js";
import { extractDisasterEvent } from "../../../nlp/extraction/eventExtractor.js";
import { resolveCoordinates, findAffectedGridCells } from "./newsGeolocationService.js";
import { clusterAndCorroborateEvent } from "./corroborationService.js";
import { recomputeGridsFromActiveEvents } from "../risk/dynamicRiskService.js";

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

      // 3. Resolve Geolocation Coordinates
      const geoResult = await resolveCoordinates(nlpResult.location);

      if (!geoResult) {
        // Event extracted but could not resolve to coordinates
        await pool.query(
          `UPDATE news.rss_items SET processing_status = 'NLP_PROCESSED' WHERE id = $1;`,
          [row.id]
        );
        continue;
      }

      // 4. Adjust confidence based on source reliability tier
      let finalConfidence = nlpResult.confidence;
      if (row.reliability_tier === 1) {
        finalConfidence = Math.min(0.98, finalConfidence + 0.15);
      } else if (row.reliability_tier === 3) {
        finalConfidence = Math.max(0.3, finalConfidence - 0.10);
      }

      // 5. Insert Disaster News Event
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

      // 6. Corroborate and Cluster Multi-Source Reports
      await clusterAndCorroborateEvent(eventId, nlpResult, geoResult.lat, geoResult.lon);

      // 7. Find Affected 500m Grid Cells within 5km to 12km regional impact radius
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

        for (const grid of affectedGrids) {
          const distanceM = parseFloat(grid.distance_m || 0);
          const decay = Math.max(0.15, 1.0 - distanceM / bufferMeters);
          const impactScore = Math.round(nlpResult.severity * finalConfidence * decay * 10) / 10;

          eventIds.push(eventId);
          gridIds.push(grid.grid_id);
          states.push(grid.state);
          impactScores.push(impactScore);

          if ((grid.state || "Assam").toLowerCase() === "assam") {
            affectedAssamGrids.add(grid.grid_id);
          } else {
            affectedMeghalayaGrids.add(grid.grid_id);
          }
          summary.gridsLinked++;
        }

        // Fast batch insert with UNNEST
        await pool.query(
          `
          INSERT INTO disaster.event_grid_links (event_id, grid_id, state, impact_score)
          SELECT * FROM UNNEST($1::bigint[], $2::varchar[], $3::varchar[], $4::numeric[])
          ON CONFLICT (event_id, grid_id) DO UPDATE SET impact_score = EXCLUDED.impact_score;
        `,
          [eventIds, gridIds, states, impactScores]
        );
      }

      // Update item status to GRID_LINKED
      await pool.query(
        `UPDATE news.rss_items SET processing_status = 'GRID_LINKED' WHERE id = $1;`,
        [row.id]
      );
    } catch (itemErr) {
      console.error(`❌ Error processing RSS item ${row.id}:`, itemErr.message);
      summary.failed++;
      await pool.query(
        `UPDATE news.rss_items SET processing_status = 'FAILED', error_message = $1 WHERE id = $2;`,
        [itemErr.message, row.id]
      );
    }
  }

  // 8. Recompute complete dynamic risk state for all affected grid cells at the end of the batch
  if (affectedAssamGrids.size > 0) {
    await recomputeGridsFromActiveEvents(Array.from(affectedAssamGrids), "Assam");
  }
  if (affectedMeghalayaGrids.size > 0) {
    await recomputeGridsFromActiveEvents(Array.from(affectedMeghalayaGrids), "Meghalaya");
  }

  return summary;
};

// Fetches all active disaster events with spatial coordinates and metadata
export const getActiveDisasterEvents = async () => {
  const res = await pool.query(`
    SELECT 
      e.id, 
      e.event_type, 
      e.hazard_type, 
      e.severity, 
      e.confidence,
      e.location_text, 
      e.district, 
      e.state, 
      e.latitude, 
      e.longitude,
      e.asset_type, 
      e.asset_name, 
      e.road_blocked, 
      e.bridge_damaged, 
      e.bridge_closed,
      e.reported_at, 
      e.valid_until, 
      e.event_status,
      e.cluster_id,
      c.source_count,
      c.corroboration_score,
      i.title AS news_title,
      i.url AS news_url,
      s.name AS source_name,
      s.reliability_tier
    FROM disaster.news_events e
    LEFT JOIN disaster.event_clusters c ON e.cluster_id = c.id
    LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
    LEFT JOIN news.rss_sources s ON i.source_id = s.id
    WHERE e.event_status = 'ACTIVE' AND (e.valid_until IS NULL OR e.valid_until > NOW())
    ORDER BY e.severity DESC, e.reported_at DESC;
  `);
  return res.rows;
};

// Fetches a single disaster event with all linked 500m grid cells
export const getDisasterEventById = async (eventId) => {
  const eventRes = await pool.query(
    `
    SELECT 
      e.*,
      i.title AS news_title,
      i.url AS news_url,
      s.name AS source_name,
      s.reliability_tier
    FROM disaster.news_events e
    LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
    LEFT JOIN news.rss_sources s ON i.source_id = s.id
    WHERE e.id = $1;
  `,
    [eventId]
  );

  if (eventRes.rows.length === 0) return null;

  const linksRes = await pool.query(
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
    linkedGrids: linksRes.rows,
  };
};

// Fetches all disaster events affecting a specific 500m grid cell
export const getEventsForGrid = async (gridId) => {
  const res = await pool.query(
    `
    SELECT 
      l.impact_score,
      l.linked_at,
      e.id AS event_id,
      e.event_type,
      e.hazard_type,
      e.severity,
      e.confidence,
      e.location_text,
      e.road_blocked,
      e.bridge_damaged,
      e.bridge_closed,
      e.event_status,
      i.title AS news_title,
      i.url AS news_url,
      s.name AS source_name,
      s.reliability_tier
    FROM disaster.event_grid_links l
    JOIN disaster.news_events e ON l.event_id = e.id
    LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
    LEFT JOIN news.rss_sources s ON i.source_id = s.id
    WHERE l.grid_id = $1
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
