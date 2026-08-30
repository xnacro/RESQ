// Risk-aware routing service evaluating and ranking Valhalla candidates against 500m PostGIS grid risk

import { calculateRoute } from "./valhallaService.js";
import { evaluateRouteRisk } from "./routeRiskService.js";

// Calibrated weights for multi-objective safe route scoring
export const SAFE_RANKING_CONFIG = Object.freeze({
  WEIGHT_RISK: 0.55,
  WEIGHT_TIME: 0.25,
  WEIGHT_CRITICAL_PENALTY: 0.20,
  MAX_ACCEPTABLE_DETOUR_RATIO: 2.5,
});

// Computes composite safe objective score for a route candidate (lower score is safer/better)
export function computeCandidateScore(candidate, baselineMinDurationSec = 1) {
  const risk = candidate.riskSnapshot?.meanRisk ?? candidate.riskScore ?? 0;
  const normalizedRisk = Math.min(100, Math.max(0, risk)) / 100.0;

  const duration = candidate.durationSeconds || 1;
  const durationRatio = duration / Math.max(1, baselineMinDurationSec);

  const criticalCount = candidate.riskSnapshot?.criticalGridCount || 0;
  const criticalPenalty = Math.min(5, criticalCount) / 5.0;

  const score =
    SAFE_RANKING_CONFIG.WEIGHT_RISK * normalizedRisk +
    SAFE_RANKING_CONFIG.WEIGHT_TIME * Math.min(SAFE_RANKING_CONFIG.MAX_ACCEPTABLE_DETOUR_RATIO, durationRatio) +
    SAFE_RANKING_CONFIG.WEIGHT_CRITICAL_PENALTY * criticalPenalty;

  return Math.round(score * 1000) / 1000;
}

// Formulates evidence-based human-readable explanation comparing selected safe route to fastest route
export function generateRouteExplanation(selectedRoute, fastestRoute, totalCandidates = 1) {
  const isSelectedBlocked = Boolean(selectedRoute?.riskSnapshot?.isBlocked);
  const isFastestBlocked = Boolean(fastestRoute?.riskSnapshot?.isBlocked);

  // When only one physical road corridor exists
  if (!fastestRoute || selectedRoute === fastestRoute || totalCandidates <= 1) {
    if (isSelectedBlocked) {
      return {
        reason: "Only one physical road corridor available. Route crosses active infrastructure blockage.",
        avoidedHazards: [],
        riskReduction: 0,
        extraTimeMinutes: 0,
        isBlocked: true,
        hasAlternative: false,
      };
    }
    if ((selectedRoute?.riskSnapshot?.meanRisk || 0) < 25) {
      return {
        reason: "Direct corridor follows baseline low-risk route with no active disaster hazards.",
        avoidedHazards: [],
        riskReduction: 0,
        extraTimeMinutes: 0,
        isBlocked: false,
        hasAlternative: false,
      };
    }
    return {
      reason: "Direct road corridor evaluated against active 500m risk grid baseline.",
      avoidedHazards: [],
      riskReduction: 0,
      extraTimeMinutes: 0,
      isBlocked: false,
      hasAlternative: false,
    };
  }

  const fastRisk = fastestRoute.riskSnapshot?.meanRisk ?? fastestRoute.riskScore ?? 0;
  const safeRisk = selectedRoute.riskSnapshot?.meanRisk ?? selectedRoute.riskScore ?? 0;
  const riskReduction = Math.round((fastRisk - safeRisk) * 10) / 10;

  const fastSec = fastestRoute.durationSeconds || 0;
  const safeSec = selectedRoute.durationSeconds || 0;
  const extraTimeMinutes = Math.max(0, Math.round((safeSec - fastSec) / 60));

  // Identify hazards present on fastest route that are avoided on safe route
  const fastHazards = fastestRoute.hazards || [];
  const safeHazardIds = new Set((selectedRoute.hazards || []).map((h) => h.id));
  const avoidedHazards = fastHazards.filter((h) => !safeHazardIds.has(h.id));

  let reason = "Alternative route selected for reduced disaster vulnerability.";
  if (isFastestBlocked && !isSelectedBlocked) {
    reason = "Fastest route crosses confirmed road/bridge blockage. Diverted to open bypass corridor.";
  } else if (isFastestBlocked && isSelectedBlocked) {
    reason = "All available road corridors cross active blockages. Selected route has lowest critical exposure.";
  } else if (avoidedHazards.length > 0) {
    const topHazard = avoidedHazards[0];
    reason = `Diverted around active ${topHazard.hazardType.toLowerCase().replace(/_/g, " ")} near ${topHazard.locationText || "route corridor"}.`;
  } else if (riskReduction > 5) {
    reason = `Safer corridor reduces route flood and landslide risk by ${riskReduction} points.`;
  } else {
    reason = "Alternative route evaluated with comparable safety profile.";
  }

  return {
    reason,
    avoidedHazards: avoidedHazards.map((h) => ({
      id: h.id,
      title: h.title,
      hazardType: h.hazardType,
      locationText: h.locationText,
      distanceToRouteMeters: h.distanceToRouteMeters,
    })),
    riskReduction: Math.max(0, riskReduction),
    extraTimeMinutes,
    isBlocked: isSelectedBlocked,
    hasAlternative: true,
  };
}

// Calculates Valhalla candidates, evaluates 500m grid risk, and selects safest practical trajectory
export async function calculateSafeRoutePlan({
  origin,
  destination,
  mode = "safe",
  vehicle = "car",
  units = "kilometers",
  alternatives = 3,
}) {
  // 1. Query Valhalla for primary route and alternatives
  const valhallaResult = await calculateRoute({
    origin,
    destination,
    mode: "fastest",
    vehicle,
    units,
    alternatives,
  });

  if (!valhallaResult.success || !valhallaResult.route) {
    return valhallaResult;
  }

  const primaryCandidate = valhallaResult.route;
  const rawAlternatives = valhallaResult.alternatives || [];
  const allCandidates = [primaryCandidate, ...rawAlternatives];

  // 2. Evaluate 500m PostGIS grid risk for all candidate routes in parallel
  const evaluatedCandidates = await Promise.all(
    allCandidates.map(async (candidate, index) => {
      try {
        const riskEval = await evaluateRouteRisk(candidate.geometry);
        return {
          ...candidate,
          candidateIndex: index,
          isPrimary: index === 0,
          riskScore: riskEval.riskSnapshot.meanRisk,
          riskStatus: riskEval.riskSnapshot.routeStatus,
          isBlocked: riskEval.riskSnapshot.isBlocked,
          riskSnapshot: riskEval.riskSnapshot,
          hazards: riskEval.hazards,
          routeGridIds: riskEval.routeGridIds,
          totalGrids: riskEval.totalGrids,
        };
      } catch (err) {
        console.warn(`Candidate ${index} risk evaluation warning:`, err.message);
        return {
          ...candidate,
          candidateIndex: index,
          isPrimary: index === 0,
          riskScore: 0,
          riskStatus: "UNKNOWN",
          isBlocked: false,
          riskSnapshot: null,
          hazards: [],
          routeGridIds: [],
          totalGrids: 0,
        };
      }
    })
  );

  const fastestCandidate = evaluatedCandidates[0];
  const minDuration = Math.min(...evaluatedCandidates.map((c) => c.durationSeconds || Infinity));

  // 3. Score and rank candidates
  const scoredCandidates = evaluatedCandidates.map((candidate) => ({
    ...candidate,
    compositeSafeScore: computeCandidateScore(candidate, minDuration),
  }));

  // Separate non-blocked candidates from blocked candidates
  const unblockedCandidates = scoredCandidates.filter((c) => !c.riskSnapshot?.isBlocked);
  const eligiblePool = unblockedCandidates.length > 0 ? unblockedCandidates : scoredCandidates;

  // Sort eligible candidates by composite safety score ascending
  eligiblePool.sort((a, b) => a.compositeSafeScore - b.compositeSafeScore);
  const selectedRoute = eligiblePool[0];

  // Generate explanation comparing selected route to fastest route
  const explanation = generateRouteExplanation(selectedRoute, fastestCandidate, scoredCandidates.length);

  // Return remaining candidates as evaluated alternatives
  const remainingAlternatives = scoredCandidates.filter((c) => c !== selectedRoute);

  return {
    success: true,
    routingEngine: "resq-risk-aware",
    routeId: valhallaResult.routeId || `resq_route_${Date.now()}`,
    mode: "safe",
    latencyMs: valhallaResult.latencyMs,
    selectedRoute,
    fastestRoute: fastestCandidate,
    route: selectedRoute,
    alternatives: remainingAlternatives,
    explanation,
  };
}

export default {
  SAFE_RANKING_CONFIG,
  computeCandidateScore,
  generateRouteExplanation,
  calculateSafeRoutePlan,
};
