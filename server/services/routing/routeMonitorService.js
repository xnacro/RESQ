// Active route monitoring and dynamic risk reroute decision engine for RESQ live navigation

import { evaluateRouteRisk, determineRouteSafetyStatus } from "./routeRiskService.js";
import { calculateSafeRoutePlan } from "./riskAwareRoutingService.js";

// Centralized route monitoring thresholds, cooldowns, and hysteresis parameters
export const ROUTE_MONITOR_CONFIG = Object.freeze({
  MIN_RISK_DELTA_FOR_REROUTE: 12.0,
  CRITICAL_RISK_THRESHOLD: 70.0,
  HIGH_RISK_THRESHOLD: 45.0,
  REROUTE_COOLDOWN_MS: 15000,
  MIN_REMAINING_DISTANCE_METERS: 200,
});

// In-memory active navigation sessions registry
const activeSessions = new Map();

// Registers a new active navigation session for live grid risk monitoring
export async function registerActiveRouteSession({
  sessionId,
  routeId,
  routeGeometry,
  origin,
  destination,
  vehicle = "car",
}) {
  if (!sessionId || !routeGeometry || routeGeometry.length < 2) {
    throw new Error("Invalid session registration parameters");
  }

  // Intersect route geometry with 500m PostGIS grid
  const initialRiskEval = await evaluateRouteRisk(routeGeometry);

  const session = {
    sessionId,
    routeId: routeId || `resq_route_${Date.now()}`,
    routeVersion: 1,
    origin,
    destination,
    vehicle,
    routeGeometry,
    orderedGrids: initialRiskEval.orderedGrids,
    routeGridIds: initialRiskEval.routeGridIds,
    remainingGridIds: new Set(initialRiskEval.routeGridIds),
    currentPosition: origin,
    currentProgressFraction: 0.0,
    lastRiskSnapshot: initialRiskEval.riskSnapshot,
    hazards: initialRiskEval.hazards,
    registeredAt: Date.now(),
    lastEvaluationTimestamp: Date.now(),
    lastRerouteTimestamp: 0,
    rerouteInProgress: false,
    status: "NAVIGATING",
  };

  activeSessions.set(sessionId, session);
  return {
    sessionId: session.sessionId,
    routeVersion: session.routeVersion,
    totalGrids: session.orderedGrids.length,
    routeGridIds: session.routeGridIds,
    riskSnapshot: session.lastRiskSnapshot,
    hazards: session.hazards,
  };
}

// Updates vehicle GPS position along active route and trims completed grids behind the vehicle
export function updateSessionProgress(sessionId, { currentPosition, progressFraction = 0.0 }) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  session.currentPosition = currentPosition || session.currentPosition;
  session.currentProgressFraction = Math.max(session.currentProgressFraction, progressFraction);

  // Filter remaining grids strictly ahead of vehicle's current route fraction
  const remainingGrids = session.orderedGrids.filter((g) => g.routeFraction >= session.currentProgressFraction - 0.02);
  session.remainingGridIds = new Set(remainingGrids.map((g) => g.gridId));

  return {
    sessionId,
    currentProgressFraction: session.currentProgressFraction,
    remainingGridsCount: session.remainingGridIds.size,
  };
}

// Retrieves current live monitoring snapshot for an active navigation session
export function getSessionMonitoringStatus(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  // Filter upcoming hazards ahead of vehicle
  const upcomingHazards = (session.hazards || []).filter(
    (h) => h.routeFraction >= session.currentProgressFraction - 0.01
  );

  return {
    sessionId: session.sessionId,
    routeId: session.routeId,
    routeVersion: session.routeVersion,
    status: session.status,
    progressFraction: session.currentProgressFraction,
    riskSnapshot: session.lastRiskSnapshot,
    upcomingHazards,
    remainingGridsCount: session.remainingGridIds.size,
    lastRerouteTimestamp: session.lastRerouteTimestamp,
    rerouteInProgress: session.rerouteInProgress,
  };
}

// Evaluates whether a risk change on a grid cell affects the active route ahead of the vehicle
export async function evaluateGridRiskUpdate(gridId, newRiskData = {}) {
  const affectedSessions = [];

  for (const [sessionId, session] of activeSessions.entries()) {
    // Check if updated grid is part of remaining route ahead of vehicle
    if (!session.remainingGridIds.has(gridId)) {
      continue;
    }

    const gridInfo = session.orderedGrids.find((g) => g.gridId === gridId);
    if (!gridInfo || gridInfo.routeFraction < session.currentProgressFraction) {
      continue;
    }

    // Update grid state in session
    if (newRiskData.riskScore !== undefined) gridInfo.riskScore = newRiskData.riskScore;
    if (newRiskData.riskStatus !== undefined) gridInfo.riskStatus = newRiskData.riskStatus;
    if (newRiskData.roadClosureRisk !== undefined) gridInfo.roadClosureRisk = newRiskData.roadClosureRisk;

    // Recalculate remaining route risk snapshot
    const remainingGrids = session.orderedGrids.filter((g) => session.remainingGridIds.has(g.gridId));
    let totalRisk = 0;
    let maxRisk = 0;
    let highRiskCount = 0;
    let criticalCount = 0;
    let blockedCount = 0;

    for (const g of remainingGrids) {
      totalRisk += g.riskScore;
      if (g.riskScore > maxRisk) maxRisk = g.riskScore;
      if (g.roadClosureRisk >= ROUTE_MONITOR_CONFIG.CRITICAL_RISK_THRESHOLD || g.riskStatus === "CRITICAL") {
        criticalCount++;
      } else if (g.riskScore >= ROUTE_MONITOR_CONFIG.HIGH_RISK_THRESHOLD || g.riskStatus === "HIGH") {
        highRiskCount++;
      }
      if (g.roadClosureRisk >= 80) blockedCount++;
    }

    const meanRisk = remainingGrids.length > 0 ? Math.round((totalRisk / remainingGrids.length) * 10) / 10 : 0;
    const newRouteStatus = determineRouteSafetyStatus({
      meanRisk,
      maxRisk,
      highRiskGridCount: highRiskCount,
      criticalGridCount: criticalCount,
      blockedSegmentCount: blockedCount,
    });

    const previousMeanRisk = session.lastRiskSnapshot?.meanRisk || 0;
    const riskDelta = meanRisk - previousMeanRisk;
    const isNowBlocked = blockedCount > 0 || newRouteStatus === "BLOCKED";
    const isNowCritical = criticalCount > 0 || maxRisk >= ROUTE_MONITOR_CONFIG.CRITICAL_RISK_THRESHOLD;
    const isMateriallyRiskier = riskDelta >= ROUTE_MONITOR_CONFIG.MIN_RISK_DELTA_FOR_REROUTE || isNowCritical;

    session.lastRiskSnapshot = {
      ...session.lastRiskSnapshot,
      meanRisk,
      maxRisk,
      highRiskGridCount: highRiskCount,
      criticalGridCount: criticalCount,
      blockedSegmentCount: blockedCount,
      isBlocked: isNowBlocked,
      routeStatus: newRouteStatus,
    };
    session.lastEvaluationTimestamp = Date.now();

    // Check reroute eligibility with cooldown and hysteresis
    const now = Date.now();
    const cooldownElapsed = now - session.lastRerouteTimestamp > ROUTE_MONITOR_CONFIG.REROUTE_COOLDOWN_MS;
    const requiresReroute = (isNowBlocked || isMateriallyRiskier) && !session.rerouteInProgress && (cooldownElapsed || isNowBlocked);

    affectedSessions.push({
      sessionId,
      routeVersion: session.routeVersion,
      gridId,
      oldMeanRisk: previousMeanRisk,
      newMeanRisk: meanRisk,
      newRouteStatus,
      isBlocked: isNowBlocked,
      requiresReroute,
    });
  }

  return affectedSessions;
}

// Executes dynamic risk rerouting from vehicle's current GPS position to destination
export async function executeDynamicReroute(sessionId, overridePosition = null) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found for reroute");
  }

  if (session.rerouteInProgress) {
    return { status: "ALREADY_IN_PROGRESS" };
  }

  session.rerouteInProgress = true;
  session.status = "REROUTING";

  try {
    const currentOrigin = overridePosition || session.currentPosition;
    const newSafePlan = await calculateSafeRoutePlan({
      origin: currentOrigin,
      destination: session.destination,
      mode: "safe",
      vehicle: session.vehicle,
      alternatives: 3,
    });

    if (!newSafePlan.success || !newSafePlan.selectedRoute) {
      session.rerouteInProgress = false;
      session.status = "REROUTE_FAILED";
      return {
        success: false,
        status: "REROUTE_FAILED",
        reason: "No viable physical bypass found from current position.",
      };
    }

    const newRoute = newSafePlan.selectedRoute;
    session.routeVersion += 1;
    session.routeId = newSafePlan.routeId || `resq_route_v${session.routeVersion}_${Date.now()}`;
    session.routeGeometry = newRoute.geometry;
    session.orderedGrids = newRoute.orderedGrids || [];
    session.routeGridIds = newRoute.routeGridIds || [];
    session.remainingGridIds = new Set(session.routeGridIds);
    session.currentProgressFraction = 0.0;
    session.lastRiskSnapshot = newRoute.riskSnapshot;
    session.hazards = newRoute.hazards || [];
    session.lastRerouteTimestamp = Date.now();
    session.rerouteInProgress = false;
    session.status = "NAVIGATING";

    return {
      success: true,
      status: "ROUTE_UPDATED",
      routeVersion: session.routeVersion,
      routeId: session.routeId,
      newRoute,
      explanation: newSafePlan.explanation,
      alternatives: newSafePlan.alternatives,
    };
  } catch (err) {
    session.rerouteInProgress = false;
    session.status = "REROUTE_FAILED";
    console.error(`Dynamic reroute error for session ${sessionId}:`, err.message);
    throw err;
  }
}

// Cleans up active navigation session when user exits driving mode
export function cleanupActiveSession(sessionId) {
  return activeSessions.delete(sessionId);
}

export default {
  ROUTE_MONITOR_CONFIG,
  registerActiveRouteSession,
  updateSessionProgress,
  getSessionMonitoringStatus,
  evaluateGridRiskUpdate,
  executeDynamicReroute,
  cleanupActiveSession,
};
