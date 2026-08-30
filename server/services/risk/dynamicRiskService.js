// RESQ Reactive Dynamic Risk Engine & Multi-Factor Fusion Service
// Computes dynamic risk from active event channels, fuses static & dynamic baselines, and manages event expiration.
import pool from "../../config/db.js";

// Centralized Dynamic Risk Configuration & Threshold Constants
export const DYNAMIC_RISK_CONFIG = Object.freeze({
  // Fusion Weights
  STATIC_WEIGHT: 0.40,
  DYNAMIC_WEIGHT: 0.60,

  // Risk Status Thresholds
  THRESHOLDS: {
    CRITICAL_SCORE: 70.0,
    HIGH_SCORE: 45.0,
    MODERATE_SCORE: 25.0,
    ROAD_CLOSURE_CRITICAL_FLOOR: 80.0,
  },

  // Safety Escalation Rules
  CLOSURE_ESCALATION_DYNAMIC_RISK: 90.0,
  DEFAULT_STATIC_CONFIDENCE: 0.95,

  // Structural events that require explicit resolution rather than auto-expiration
  PROTECTED_STRUCTURAL_TYPES: ["BRIDGE_CLOSURE", "BRIDGE_WASHOUT", "BRIDGE_COLLAPSE", "ROAD_COLLAPSE"],
});

// Computes combined risk score from static and dynamic risk values
export function calculateRiskScore(staticRisk, dynamicRisk) {
  const s = parseFloat(staticRisk) || 0.0;
  const d = parseFloat(dynamicRisk) || 0.0;

  if (d <= 0.0) {
    return Math.round(s * 10) / 10;
  }

  const combined = DYNAMIC_RISK_CONFIG.STATIC_WEIGHT * s + DYNAMIC_RISK_CONFIG.DYNAMIC_WEIGHT * d;
  const clamped = Math.min(100.0, Math.max(0.0, combined));
  return Math.round(clamped * 10) / 10;
}

// Determines risk status classification with safety override escalations
export function determineRiskStatus(riskScore, roadClosureRisk) {
  const score = parseFloat(riskScore) || 0.0;
  const closure = parseFloat(roadClosureRisk) || 0.0;

  // Safety Escalation Override: physical road/bridge closure forces CRITICAL status
  if (closure >= DYNAMIC_RISK_CONFIG.THRESHOLDS.ROAD_CLOSURE_CRITICAL_FLOOR) {
    return "CRITICAL";
  }

  if (score >= DYNAMIC_RISK_CONFIG.THRESHOLDS.CRITICAL_SCORE) {
    return "CRITICAL";
  }
  if (score >= DYNAMIC_RISK_CONFIG.THRESHOLDS.HIGH_SCORE) {
    return "HIGH";
  }
  if (score >= DYNAMIC_RISK_CONFIG.THRESHOLDS.MODERATE_SCORE) {
    return "MODERATE";
  }
  return "LOW";
}

// Recomputes dynamic risk, combined score, confidence, and status for targeted grid cells from active events
export const recomputeGridsFromActiveEvents = async (gridIds, state = "Assam", externalClient = null) => {
  if (!gridIds || gridIds.length === 0) {
    return { updatedCount: 0, gridIds: [] };
  }

  const isAssam = (state || "Assam").toLowerCase() === "assam";
  const tableName = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
  const client = externalClient || (await pool.connect());
  const shouldRelease = !externalClient;

  try {
    if (shouldRelease) {
      await client.query("SET default_transaction_read_only = off;");
      await client.query("BEGIN;");
    }

    // CTE: 1. Aggregate active linked disaster events for targeted grid IDs
    // Derives live active factor values strictly from non-expired, active events
    const recomputeSql = `
      WITH targeted_cells AS (
        SELECT UNNEST($1::varchar[]) AS grid_id
      ),
      active_evidence AS (
        SELECT 
          tc.grid_id,
          -- Active news risk: maximum distance-decayed impact from active news reports
          COALESCE(MAX(CASE WHEN e.id IS NOT NULL THEN l.impact_score ELSE 0.0 END), 0.0) AS active_news_risk,
          -- Active NLP structured event risk
          COALESCE(MAX(CASE WHEN e.id IS NOT NULL AND e.hazard_type IS NOT NULL THEN l.impact_score ELSE 0.0 END), 0.0) AS active_nlp_risk,
          -- Active physical transport closure risk: 90.0 for blocked/closed, 75.0 for damaged
          COALESCE(MAX(
            CASE 
              WHEN e.id IS NOT NULL AND (e.road_blocked = TRUE OR e.bridge_closed = TRUE) THEN 90.0
              WHEN e.id IS NOT NULL AND e.bridge_damaged = TRUE THEN 75.0
              ELSE 0.0
            END
          ), 0.0) AS active_road_closure_risk,
          -- Strongest active event confidence
          COALESCE(MAX(CASE WHEN e.id IS NOT NULL THEN e.confidence ELSE 0.0 END), 0.0) AS active_max_confidence,
          COUNT(e.id) AS active_event_count
        FROM targeted_cells tc
        LEFT JOIN (
          disaster.event_grid_links l
          JOIN disaster.news_events e ON l.event_id = e.id 
            AND e.event_status = 'ACTIVE' 
            AND (e.valid_until IS NULL OR e.valid_until > NOW())
        ) ON tc.grid_id = l.grid_id
        GROUP BY tc.grid_id
      ),
      computed_grid_state AS (
        SELECT 
          g.id,
          g.grid_id,
          g.static_risk,
          -- Factor channel updates
          COALESCE(ae.active_news_risk, 0.0) AS calc_news_risk,
          COALESCE(ae.active_nlp_risk, 0.0) AS calc_nlp_event_risk,
          COALESCE(ae.active_road_closure_risk, 0.0) AS calc_road_closure_risk,
          -- Preserve existing sensor channels if present
          COALESCE(g.rainfall_risk, 0.0) AS preserved_rainfall,
          COALESCE(g.flood_event_risk, 0.0) AS preserved_flood,
          COALESCE(g.earthquake_event_risk, 0.0) AS preserved_quake,
          COALESCE(g.landslide_event_risk, 0.0) AS preserved_slide,
          COALESCE(g.citizen_report_risk, 0.0) AS preserved_citizen,
          
          -- Aggregated Dynamic Risk Formula:
          -- dynamic_risk = MIN(100.0, MAX(road_closure, news, nlp, rainfall, flood, earthquake, landslide, citizen))
          -- Plus closure safety escalation: if road_closure >= 80 -> dynamic_risk is elevated to at least 90.0
          ROUND(
            LEAST(100.0,
              CASE 
                WHEN COALESCE(ae.active_road_closure_risk, 0.0) >= 80.0 THEN
                  GREATEST(
                    90.0,
                    COALESCE(ae.active_news_risk, 0.0),
                    COALESCE(ae.active_nlp_risk, 0.0),
                    COALESCE(g.rainfall_risk, 0.0),
                    COALESCE(g.flood_event_risk, 0.0),
                    COALESCE(g.earthquake_event_risk, 0.0),
                    COALESCE(g.landslide_event_risk, 0.0),
                    COALESCE(g.citizen_report_risk, 0.0)
                  )
                ELSE
                  GREATEST(
                    COALESCE(ae.active_road_closure_risk, 0.0),
                    COALESCE(ae.active_news_risk, 0.0),
                    COALESCE(ae.active_nlp_risk, 0.0),
                    COALESCE(g.rainfall_risk, 0.0),
                    COALESCE(g.flood_event_risk, 0.0),
                    COALESCE(g.earthquake_event_risk, 0.0),
                    COALESCE(g.landslide_event_risk, 0.0),
                    COALESCE(g.citizen_report_risk, 0.0)
                  )
              END
            )::numeric, 1
          ) AS calc_dynamic_risk,
          COALESCE(ae.active_max_confidence, 0.0) AS calc_active_confidence,
          COALESCE(ae.active_event_count, 0) AS calc_active_event_count
        FROM targeted_cells tc
        JOIN ${tableName} g ON tc.grid_id = g.grid_id
        LEFT JOIN active_evidence ae ON g.grid_id = ae.grid_id
      )
      UPDATE ${tableName} g
      SET
        news_risk = c.calc_news_risk,
        nlp_event_risk = c.calc_nlp_event_risk,
        road_closure_risk = c.calc_road_closure_risk,
        dynamic_risk = c.calc_dynamic_risk,
        
        -- Combined Risk Score Fusion: 0.40 * static + 0.60 * dynamic
        risk_score = ROUND((
          CASE 
            WHEN c.calc_dynamic_risk > 0.0 THEN
              LEAST(100.0, GREATEST(0.0, 0.40 * c.static_risk + 0.60 * c.calc_dynamic_risk))
            ELSE
              c.static_risk
          END
        )::numeric, 1),
        
        -- Risk Confidence: blends static baseline (0.95) with active dynamic evidence confidence
        risk_confidence = ROUND((
          CASE 
            WHEN c.calc_dynamic_risk > 0.0 AND c.calc_active_confidence > 0.0 THEN
              0.40 * 0.95 + 0.60 * c.calc_active_confidence
            ELSE
              0.95
          END
        )::numeric, 2),
        
        -- Risk Status Classification with Safety Override Floor
        risk_status = CASE
          WHEN c.calc_road_closure_risk >= 80.0 THEN 'CRITICAL'
          WHEN (
            CASE 
              WHEN c.calc_dynamic_risk > 0.0 THEN 0.40 * c.static_risk + 0.60 * c.calc_dynamic_risk
              ELSE c.static_risk
            END
          ) >= 70.0 THEN 'CRITICAL'
          WHEN (
            CASE 
              WHEN c.calc_dynamic_risk > 0.0 THEN 0.40 * c.static_risk + 0.60 * c.calc_dynamic_risk
              ELSE c.static_risk
            END
          ) >= 45.0 THEN 'HIGH'
          WHEN (
            CASE 
              WHEN c.calc_dynamic_risk > 0.0 THEN 0.40 * c.static_risk + 0.60 * c.calc_dynamic_risk
              ELSE c.static_risk
            END
          ) >= 25.0 THEN 'MODERATE'
          ELSE 'LOW'
        END,
        
        last_dynamic_update = NOW(),
        updated_at = NOW()
      FROM computed_grid_state c
      WHERE g.id = c.id
      RETURNING g.grid_id, g.static_risk, g.dynamic_risk, g.risk_score, g.risk_status, g.risk_confidence;
    `;

    const updateRes = await client.query(recomputeSql, [gridIds]);

    if (shouldRelease) {
      await client.query("COMMIT;");
    }

    return {
      updatedCount: updateRes.rows.length,
      gridIds: updateRes.rows.map((r) => r.grid_id),
      sampleRows: updateRes.rows.slice(0, 5),
    };
  } catch (err) {
    if (shouldRelease) {
      await client.query("ROLLBACK;");
    }
    console.error("❌ Error recomputing dynamic risk for grids:", err.message);
    throw err;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
};

// Periodic Expiration Worker: Marks stale events as EXPIRED and recalibrates affected grid cells
export const expireStaleEvents = async () => {
  const result = {
    expiredEventsCount: 0,
    affectedGridsCount: 0,
    assamGridsUpdated: 0,
    meghalayaGridsUpdated: 0,
  };

  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");
    await client.query("BEGIN;");

    // 1. Find and expire non-protected active events where valid_until has elapsed
    // Protected structural events (e.g. BRIDGE_WASHOUT) require explicit resolution or 120h max window
    const expireEventsSql = `
      UPDATE disaster.news_events
      SET 
        event_status = 'EXPIRED',
        updated_at = NOW()
      WHERE event_status = 'ACTIVE'
        AND valid_until IS NOT NULL
        AND valid_until <= NOW()
        AND (
          event_type NOT IN ('BRIDGE_CLOSURE', 'BRIDGE_WASHOUT', 'BRIDGE_COLLAPSE', 'ROAD_COLLAPSE')
          OR valid_until <= NOW() - INTERVAL '72 hours'
        )
      RETURNING id, state;
    `;

    const expiredRes = await client.query(expireEventsSql);
    result.expiredEventsCount = expiredRes.rows.length;

    if (result.expiredEventsCount > 0) {
      const expiredIds = expiredRes.rows.map((r) => r.id);

      // 2. Find all grid cells that were linked to newly expired events
      const linkedGridsRes = await client.query(
        `
        SELECT DISTINCT grid_id, state 
        FROM disaster.event_grid_links 
        WHERE event_id = ANY($1::bigint[]);
      `,
        [expiredIds]
      );

      const assamGridIds = linkedGridsRes.rows
        .filter((r) => (r.state || "Assam").toLowerCase() === "assam")
        .map((r) => r.grid_id);

      const meghalayaGridIds = linkedGridsRes.rows
        .filter((r) => (r.state || "").toLowerCase() === "meghalaya")
        .map((r) => r.grid_id);

      // 3. Recalculate affected cells from remaining ACTIVE events (or zero out if none active)
      if (assamGridIds.length > 0) {
        const asRes = await recomputeGridsFromActiveEvents(assamGridIds, "Assam", client);
        result.assamGridsUpdated = asRes.updatedCount;
      }

      if (meghalayaGridIds.length > 0) {
        const mlRes = await recomputeGridsFromActiveEvents(meghalayaGridIds, "Meghalaya", client);
        result.meghalayaGridsUpdated = mlRes.updatedCount;
      }

      result.affectedGridsCount = assamGridIds.length + meghalayaGridIds.length;
    }

    await client.query("COMMIT;");
    if (result.expiredEventsCount > 0) {
      console.log(`🧹 Expired ${result.expiredEventsCount} stale disaster events. Recalculated ${result.affectedGridsCount} 500m grid cells.`);
    }
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Failed to run event expiration cycle:", err.message);
    throw err;
  } finally {
    client.release();
  }

  return result;
};

// Explainability helper: Retrieves complete static & dynamic risk breakdown with active evidence for a single grid cell
export const getDynamicRiskBreakdown = async (gridId) => {
  if (!gridId) return null;

  const isAssam = gridId.toUpperCase().startsWith("AS");
  const tableName = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";

  const client = await pool.connect();
  try {
    // 1. Fetch grid cell state
    const gridRes = await client.query(
      `
      SELECT 
        grid_id, state, district, block, center_lat, center_lon,
        elevation_mean, slope_mean, distance_to_river, waterbody_percentage,
        flood_susceptibility, landslide_susceptibility, seismic_risk,
        population_density, infrastructure_exposure,
        static_risk, dynamic_risk, risk_score, risk_confidence, risk_status,
        news_risk, nlp_event_risk, road_closure_risk, rainfall_risk, flood_event_risk,
        earthquake_event_risk, landslide_event_risk, citizen_report_risk,
        last_dynamic_update, created_at, updated_at
      FROM ${tableName}
      WHERE grid_id = $1;
    `,
      [gridId]
    );

    if (gridRes.rows.length === 0) {
      return null;
    }

    const cell = gridRes.rows[0];

    // 2. Fetch linked active disaster events with evidence details
    const eventsRes = await client.query(
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
        e.reported_at,
        e.valid_until,
        i.title AS news_title,
        i.url AS news_url,
        s.name AS source_name,
        s.reliability_tier
      FROM disaster.event_grid_links l
      JOIN disaster.news_events e ON l.event_id = e.id
      LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
      LEFT JOIN news.rss_sources s ON i.source_id = s.id
      WHERE l.grid_id = $1 AND e.event_status = 'ACTIVE' AND (e.valid_until IS NULL OR e.valid_until > NOW())
      ORDER BY l.impact_score DESC;
    `,
      [gridId]
    );

    // 3. Fetch regional active disaster bulletins for the district & state
    const regionalRes = await client.query(
      `
      SELECT 
        e.id AS event_id,
        e.event_type,
        e.hazard_type,
        e.severity,
        e.confidence,
        e.location_text,
        e.district,
        e.state,
        e.road_blocked,
        e.bridge_damaged,
        e.bridge_closed,
        e.reported_at,
        i.title AS news_title,
        i.url AS news_url,
        s.name AS source_name,
        s.reliability_tier
      FROM disaster.news_events e
      LEFT JOIN news.rss_items i ON e.rss_item_id = i.id
      LEFT JOIN news.rss_sources s ON i.source_id = s.id
      WHERE e.event_status = 'ACTIVE' 
        AND (e.valid_until IS NULL OR e.valid_until > NOW())
        AND (e.state = $1 OR e.district = $2 OR $2 IS NULL)
      ORDER BY e.severity DESC, e.reported_at DESC
      LIMIT 25;
    `,
      [cell.state || "Assam", cell.district || null]
    );

    return {
      gridId: cell.grid_id,
      state: cell.state,
      district: cell.district,
      center: {
        lat: cell.center_lat,
        lon: cell.center_lon,
      },
      riskSummary: {
        staticRisk: cell.static_risk,
        dynamicRisk: cell.dynamic_risk,
        riskScore: cell.risk_score,
        riskStatus: cell.risk_status,
        riskConfidence: cell.risk_confidence,
        lastDynamicUpdate: cell.last_dynamic_update,
      },
      dynamicFactorChannels: {
        newsRisk: cell.news_risk,
        nlpEventRisk: cell.nlp_event_risk,
        roadClosureRisk: cell.road_closure_risk,
        rainfallRisk: cell.rainfall_risk,
        floodEventRisk: cell.flood_event_risk,
        earthquakeEventRisk: cell.earthquake_event_risk,
        landslideEventRisk: cell.landslide_event_risk,
        citizenReportRisk: cell.citizen_report_risk,
      },
      staticFactors: {
        elevationMean: cell.elevation_mean,
        slopeMean: cell.slope_mean,
        distanceToRiver: cell.distance_to_river,
        waterbodyPercentage: cell.waterbody_percentage,
        floodSusceptibility: cell.flood_susceptibility,
        landslideSusceptibility: cell.landslide_susceptibility,
        seismicRisk: cell.seismic_risk,
        populationDensity: cell.population_density,
        infrastructureExposure: cell.infrastructure_exposure,
      },
      activeEvents: eventsRes.rows,
      regionalEvents: regionalRes.rows,
    };
  } finally {
    client.release();
  }
};

export default {
  DYNAMIC_RISK_CONFIG,
  calculateRiskScore,
  determineRiskStatus,
  recomputeGridsFromActiveEvents,
  expireStaleEvents,
  getDynamicRiskBreakdown,
};
