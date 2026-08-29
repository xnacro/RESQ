// Disaster Event Corroboration & Duplicate Clustering Service
// Merges multiple independent reports of the same disaster into verified event clusters
import pool from "../../config/db.js";

// Evaluates spatial and temporal proximity to detect multi-source event clusters
export const clusterAndCorroborateEvent = async (eventId, eventData, lat, lon) => {
  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");

    // 1. Search for existing active clusters within 15km and 72 hours
    const clusterSql = `
      SELECT 
        c.id, 
        c.canonical_event_id, 
        c.source_count, 
        c.corroboration_score,
        ROUND((ST_Distance(c.geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography))::numeric, 0) AS dist_m
      FROM disaster.event_clusters c
      WHERE 
        c.hazard_type = $3
        AND ST_DWithin(c.geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography, 15000)
        AND c.last_reported_at >= NOW() - INTERVAL '72 hours'
      ORDER BY dist_m ASC
      LIMIT 1;
    `;

    const clusterRes = await client.query(clusterSql, [lon, lat, eventData.hazardType]);

    if (clusterRes.rows.length > 0) {
      // Existing cluster found -> Corroborate and boost confidence
      const existingCluster = clusterRes.rows[0];
      const newSourceCount = parseInt(existingCluster.source_count, 10) + 1;
      const boostedScore = Math.min(0.98, parseFloat(existingCluster.corroboration_score) + 0.15);

      await client.query(
        `
        UPDATE disaster.event_clusters
        SET 
          source_count = $1,
          corroboration_score = $2,
          last_reported_at = NOW()
        WHERE id = $3;
      `,
        [newSourceCount, boostedScore, existingCluster.id]
      );

      // Link current event to cluster
      await client.query(
        `
        UPDATE disaster.news_events
        SET cluster_id = $1, confidence = LEAST(0.98, confidence + 0.15)
        WHERE id = $2;
      `,
        [existingCluster.id, eventId]
      );

      return {
        clusterId: existingCluster.id,
        isNewCluster: false,
        sourceCount: newSourceCount,
        corroborationScore: boostedScore,
      };
    } else {
      // Create new canonical cluster
      const insertClusterSql = `
        INSERT INTO disaster.event_clusters (
          canonical_event_id, event_type, hazard_type, source_count, corroboration_score, geom, first_reported_at, last_reported_at
        )
        VALUES ($1, $2, $3, 1, $4, ST_SetSRID(ST_Point($5, $6), 4326), NOW(), NOW())
        RETURNING id;
      `;

      const newClusterRes = await client.query(insertClusterSql, [
        eventId,
        eventData.eventType,
        eventData.hazardType,
        eventData.confidence,
        lon,
        lat,
      ]);

      const clusterId = newClusterRes.rows[0].id;

      await client.query(
        `
        UPDATE disaster.news_events
        SET cluster_id = $1
        WHERE id = $2;
      `,
        [clusterId, eventId]
      );

      return {
        clusterId,
        isNewCluster: true,
        sourceCount: 1,
        corroborationScore: eventData.confidence,
      };
    }
  } finally {
    client.release();
  }
};

export default {
  clusterAndCorroborateEvent,
};
