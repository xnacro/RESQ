// Route risk evaluation service intersecting Valhalla trajectories with 500m PostGIS grids

import pool from "../../config/db.js";

// Centralized route risk thresholds and safety classification parameters
export const ROUTE_RISK_CONFIG = Object.freeze({
  THRESHOLDS: {
    CRITICAL_SCORE: 70.0,
    HIGH_SCORE: 45.0,
    MODERATE_SCORE: 25.0,
    ROAD_CLOSURE_FLOOR: 80.0,
  },
  CORRIDOR_BUFFER_METERS: 250,
  MAX_SAMPLE_POINTS: 500,
});

// Determines overall safety status for a evaluated route
export function determineRouteSafetyStatus({
  meanRisk = 0,
  maxRisk = 0,
  highRiskGridCount = 0,
  criticalGridCount = 0,
  blockedSegmentCount = 0,
}) {
  if (blockedSegmentCount > 0) {
    return "BLOCKED";
  }
  if (criticalGridCount > 0 || maxRisk >= ROUTE_RISK_CONFIG.THRESHOLDS.CRITICAL_SCORE) {
    return "CRITICAL";
  }
  if (highRiskGridCount > 0 || meanRisk >= ROUTE_RISK_CONFIG.THRESHOLDS.HIGH_SCORE) {
    return "HIGH_RISK";
  }
  if (meanRisk >= ROUTE_RISK_CONFIG.THRESHOLDS.MODERATE_SCORE) {
    return "CAUTION";
  }
  return "SAFE";
}

// Extracts ordered 500m grid cells crossed by a route geometry and evaluates comprehensive safety snapshot
export async function evaluateRouteRisk(geometry = []) {
  if (!geometry || !Array.isArray(geometry) || geometry.length < 2) {
    return {
      totalGrids: 0,
      routeGridIds: [],
      orderedGrids: [],
      riskSnapshot: {
        meanRisk: 0,
        maxRisk: 0,
        highRiskGridCount: 0,
        criticalGridCount: 0,
        activeHazardCount: 0,
        blockedSegmentCount: 0,
        affectedBridgeCount: 0,
        affectedRoadCount: 0,
        riskConfidence: 1.0,
        isBlocked: false,
        routeStatus: "SAFE",
      },
      hazards: [],
    };
  }

  // Downsample geometry if extremely dense to accelerate spatial index intersection while preserving fidelity
  let processedCoords = geometry;
  if (geometry.length > ROUTE_RISK_CONFIG.MAX_SAMPLE_POINTS) {
    const step = Math.ceil(geometry.length / ROUTE_RISK_CONFIG.MAX_SAMPLE_POINTS);
    processedCoords = geometry.filter((_, idx) => idx % step === 0);
    const lastCoord = geometry[geometry.length - 1];
    if (processedCoords[processedCoords.length - 1] !== lastCoord) {
      processedCoords.push(lastCoord);
    }
  }

  const geojsonLineString = JSON.stringify({
    type: "LineString",
    coordinates: processedCoords,
  });

  const gridQuery = `
    WITH route_geom AS (
      SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
    ),
    crossed_assam AS (
      SELECT 
        g.grid_id,
        g.state,
        g.district,
        g.block,
        g.center_lat,
        g.center_lon,
        COALESCE(g.static_risk, 0.0) AS static_risk,
        COALESCE(g.dynamic_risk, 0.0) AS dynamic_risk,
        COALESCE(g.risk_score, 0.0) AS risk_score,
        COALESCE(g.risk_status, 'LOW') AS risk_status,
        COALESCE(g.risk_confidence, 0.95) AS risk_confidence,
        COALESCE(g.road_closure_risk, 0.0) AS road_closure_risk,
        ST_LineLocatePoint(r.geom, ST_ClosestPoint(g.geom, r.geom)) AS route_fraction
      FROM grid_500m.assam g, route_geom r
      WHERE ST_Intersects(g.geom, r.geom)
    ),
    crossed_meghalaya AS (
      SELECT 
        g.grid_id,
        g.state,
        g.district,
        g.block,
        g.center_lat,
        g.center_lon,
        COALESCE(g.static_risk, 0.0) AS static_risk,
        COALESCE(g.dynamic_risk, 0.0) AS dynamic_risk,
        COALESCE(g.risk_score, 0.0) AS risk_score,
        COALESCE(g.risk_status, 'LOW') AS risk_status,
        COALESCE(g.risk_confidence, 0.95) AS risk_confidence,
        COALESCE(g.road_closure_risk, 0.0) AS road_closure_risk,
        ST_LineLocatePoint(r.geom, ST_ClosestPoint(g.geom, r.geom)) AS route_fraction
      FROM grid_500m.meghalaya g, route_geom r
      WHERE ST_Intersects(g.geom, r.geom)
    ),
    all_crossed AS (
      SELECT * FROM crossed_assam
      UNION ALL
      SELECT * FROM crossed_meghalaya
    )
    SELECT * FROM all_crossed
    ORDER BY route_fraction ASC;
  `;

  const hazardQuery = `
    WITH route_geom AS (
      SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
    )
    SELECT 
      e.id,
      COALESCE(r_item.title, e.location_text, e.event_type) AS news_title,
      e.event_type,
      e.hazard_type,
      e.severity,
      e.road_blocked,
      e.bridge_closed,
      e.bridge_damaged,
      e.location_text,
      e.latitude,
      e.longitude,
      COALESCE(e.confidence, 0.9) AS confidence,
      ST_LineLocatePoint(r.geom, e.geom) AS route_fraction,
      ROUND(ST_Distance(r.geom::geography, e.geom::geography)::numeric, 1) AS distance_to_route_meters
    FROM disaster.news_events e
    CROSS JOIN route_geom r
    LEFT JOIN news.rss_items r_item ON e.rss_item_id = r_item.id
    WHERE e.event_status = 'ACTIVE'
      AND (e.valid_until IS NULL OR e.valid_until > NOW())
      AND ST_DWithin(r.geom::geography, e.geom::geography, $2)
    ORDER BY route_fraction ASC;
  `;

  try {
    const [gridRes, hazardRes] = await Promise.all([
      pool.query(gridQuery, [geojsonLineString]),
      pool.query(hazardQuery, [geojsonLineString, ROUTE_RISK_CONFIG.CORRIDOR_BUFFER_METERS]),
    ]);

    const crossedRows = gridRes.rows || [];
    const hazardRows = hazardRes.rows || [];

    // Map ordered grid cells along trajectory
    const orderedGrids = crossedRows.map((row, idx) => ({
      gridId: row.grid_id,
      positionIndex: idx,
      routeFraction: Math.round(parseFloat(row.route_fraction) * 1000) / 1000,
      state: row.state,
      district: row.district,
      block: row.block,
      centerLat: parseFloat(row.center_lat),
      centerLon: parseFloat(row.center_lon),
      staticRisk: parseFloat(row.static_risk) || 0,
      dynamicRisk: parseFloat(row.dynamic_risk) || 0,
      riskScore: parseFloat(row.risk_score) || 0,
      riskStatus: row.risk_status || "LOW",
      riskConfidence: parseFloat(row.risk_confidence) || 0.95,
      roadClosureRisk: parseFloat(row.road_closure_risk) || 0,
      activeEventCount: 0,
    }));

    const routeGridIds = orderedGrids.map((g) => g.gridId);

    // Compute route metrics across all crossed grid cells
    let totalRisk = 0;
    let maxRisk = 0;
    let highRiskCount = 0;
    let criticalCount = 0;
    let blockedCount = 0;
    let totalConfidence = 0;

    for (const grid of orderedGrids) {
      const score = grid.riskScore;
      totalRisk += score;
      if (score > maxRisk) maxRisk = score;

      if (grid.roadClosureRisk >= ROUTE_RISK_CONFIG.THRESHOLDS.ROAD_CLOSURE_FLOOR) {
        blockedCount++;
      }
      if (score >= ROUTE_RISK_CONFIG.THRESHOLDS.CRITICAL_SCORE || grid.riskStatus === "CRITICAL") {
        criticalCount++;
      } else if (score >= ROUTE_RISK_CONFIG.THRESHOLDS.HIGH_SCORE || grid.riskStatus === "HIGH") {
        highRiskCount++;
      }

      totalConfidence += grid.riskConfidence;
    }

    const totalGrids = orderedGrids.length;
    const meanRisk = totalGrids > 0 ? Math.round((totalRisk / totalGrids) * 10) / 10 : 0;
    const avgConfidence = totalGrids > 0 ? Math.round((totalConfidence / totalGrids) * 100) / 100 : 1.0;

    // Identify active hazards in the route corridor
    let affectedBridges = 0;
    let affectedRoads = 0;

    const formattedHazards = hazardRows.map((h) => {
      const isRoadBlocked = Boolean(h.road_blocked);
      const isBridgeClosed = Boolean(h.bridge_closed);
      const isBridgeDamaged = Boolean(h.bridge_damaged);

      if (isBridgeClosed || isBridgeDamaged) affectedBridges++;
      if (isRoadBlocked) affectedRoads++;
      if (isRoadBlocked || isBridgeClosed) blockedCount++;

      return {
        id: h.id,
        title: h.news_title,
        hazardType: h.hazard_type,
        severity: h.severity,
        roadBlocked: isRoadBlocked,
        bridgeClosed: isBridgeClosed,
        bridgeDamaged: isBridgeDamaged,
        locationText: h.location_text,
        lat: parseFloat(h.latitude),
        lon: parseFloat(h.longitude),
        routeFraction: Math.round(parseFloat(h.route_fraction) * 1000) / 1000,
        distanceToRouteMeters: parseFloat(h.distance_to_route_meters),
      };
    });

    const isBlocked = blockedCount > 0;
    const routeStatus = determineRouteSafetyStatus({
      meanRisk,
      maxRisk,
      highRiskGridCount: highRiskCount,
      criticalGridCount: criticalCount,
      blockedSegmentCount: blockedCount,
    });

    return {
      totalGrids,
      routeGridIds,
      orderedGrids,
      riskSnapshot: {
        meanRisk,
        maxRisk,
        highRiskGridCount: highRiskCount,
        criticalGridCount: criticalCount,
        activeHazardCount: formattedHazards.length,
        blockedSegmentCount: blockedCount,
        affectedBridgeCount: affectedBridges,
        affectedRoadCount: affectedRoads,
        riskConfidence: avgConfidence,
        isBlocked,
        routeStatus,
      },
      hazards: formattedHazards,
    };
  } catch (err) {
    console.error("Error evaluating route risk:", err.message);
    throw err;
  }
}

export default {
  ROUTE_RISK_CONFIG,
  determineRouteSafetyStatus,
  evaluateRouteRisk,
};
