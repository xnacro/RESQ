// Centralized route and turn-by-turn driving state management store for RESQ

import { getRoute } from "./routingApi.js";

const SESSION_STORAGE_KEY = "resq_active_navigation_session";
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Initial state snapshot
const INITIAL_STATE = {
  sessionId: null,
  origin: null,
  destination: null,
  routeData: null,
  alternatives: [],
  activeRouteMode: "fastest",
  routeExplanation: null,
  routeRiskStatus: "SAFE",
  routeMeanRisk: 0,
  upcomingHazards: [],
  rerouteNotice: null,
  isMonitoring: false,
  vehicle: "car",
  isRouting: false,
  routingError: null,
  navigationMode: "idle", // 'idle' | 'preview' | 'driving'
  navigationStatus: "idle", // 'idle' | 'navigating' | 'off_route' | 'recalculating' | 'arrived'
  currentPosition: null,
  currentManeuverIndex: 0,
  nextManeuverIndex: 1,
  currentShapeIndex: 0,
  distanceToNextManeuverKm: 0,
  remainingDistanceKm: 0,
  remainingDurationSeconds: 0,
  speedKmh: 0,
  heading: 0,
  cameraFollowing: true,
  isRerouting: false,
  isStepsDrawerOpen: false,
  isSourceModalOpen: false,
};

let state = { ...INITIAL_STATE };
const listeners = new Set();
let activeAbortController = null;
let latestRequestId = 0;

// Subscribes a callback to route state changes
export function subscribeRouteStore(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns current snapshot of route state
export function getRouteState() {
  return state;
}

// Emits state updates to all subscribed components
function emitChange() {
  const snapshot = { ...state };
  listeners.forEach((listener) => listener(snapshot));
}

// Saves active navigation session snapshot into browser local storage
export function persistNavigationSession() {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (state.navigationMode !== "driving" || !state.routeData) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  try {
    const payload = {
      timestamp: Date.now(),
      sessionId: state.sessionId,
      origin: state.origin,
      destination: state.destination,
      routeData: state.routeData,
      activeRouteMode: state.activeRouteMode,
      routeExplanation: state.routeExplanation,
      currentManeuverIndex: state.currentManeuverIndex,
      currentShapeIndex: state.currentShapeIndex,
      navigationMode: state.navigationMode,
      navigationStatus: state.navigationStatus,
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to persist navigation session:", err);
  }
}

// Restores previously active navigation session from local storage on reload
export function hydrateNavigationSession() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (!data || !data.routeData || !data.destination) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }

    const age = Date.now() - (data.timestamp || 0);
    if (age > SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }

    state = {
      ...state,
      sessionId: data.sessionId || `resq_nav_${Date.now()}`,
      origin: data.origin || null,
      destination: data.destination,
      routeData: data.routeData,
      activeRouteMode: data.activeRouteMode || "fastest",
      routeExplanation: data.routeExplanation || null,
      currentManeuverIndex: data.currentManeuverIndex || 0,
      currentShapeIndex: data.currentShapeIndex || 0,
      navigationMode: data.navigationMode || "preview",
      navigationStatus: data.navigationStatus || "idle",
      remainingDistanceKm: data.routeData.distanceKm || 0,
      remainingDurationSeconds: data.routeData.durationSeconds || 0,
      cameraFollowing: true,
      isMonitoring: data.navigationMode === "driving",
    };
    emitChange();
    return true;
  } catch (err) {
    console.warn("Failed to hydrate navigation session:", err);
    return false;
  }
}

// Clears active navigation session from local storage
export function clearPersistedSession() {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

// Sets the current destination location
export function setDestination(dest) {
  state = {
    ...state,
    destination: dest,
    routingError: null,
  };
  emitChange();
}

// Sets the current origin starting point
export function setOrigin(orig) {
  state = {
    ...state,
    origin: orig,
    routingError: null,
  };
  emitChange();
}

// Opens the starting location selection modal
export function openSourceModal() {
  state = {
    ...state,
    isSourceModalOpen: true,
  };
  emitChange();
}

// Closes the starting location selection modal
export function closeSourceModal() {
  state = {
    ...state,
    isSourceModalOpen: false,
  };
  emitChange();
}

// Calculates Valhalla or Safe route between origin and destination
export async function calculateRoutePlan({
  origin = state.origin,
  destination = state.destination,
  mode = state.activeRouteMode,
  vehicle = state.vehicle,
} = {}) {
  if (!origin || !destination) {
    state = {
      ...state,
      routingError: "Both starting location and destination are required.",
      isRouting: false,
    };
    emitChange();
    return null;
  }

  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  const requestId = ++latestRequestId;
  state = {
    ...state,
    origin,
    destination,
    activeRouteMode: mode,
    vehicle,
    isRouting: true,
    routingError: null,
    isSourceModalOpen: false,
  };
  emitChange();

  try {
    const originCoord = [
      Number(origin.lon ?? origin.longitude ?? origin[0]),
      Number(origin.lat ?? origin.latitude ?? origin[1]),
    ];
    const destCoord = [
      Number(destination.lon ?? destination.longitude ?? destination[0]),
      Number(destination.lat ?? destination.latitude ?? destination[1]),
    ];

    const targetMode = mode === "safe" ? "safe" : "fastest";
    const res = await getRoute({
      origin: originCoord,
      destination: destCoord,
      mode: targetMode,
      vehicle: "car",
      alternatives: 3,
    });

    if (requestId !== latestRequestId) return null;

    const chosenRoute = res.selectedRoute || res.route;
    if (!res.success || !chosenRoute) {
      state = {
        ...state,
        isRouting: false,
        routingError: res.error?.message || "No feasible road route found between selected points.",
      };
      emitChange();
      return null;
    }

    const riskSnapshot = chosenRoute.riskSnapshot;
    state = {
      ...state,
      routeData: chosenRoute,
      alternatives: res.alternatives || [],
      routeExplanation: res.explanation || chosenRoute.explanation || null,
      routeRiskStatus: riskSnapshot?.routeStatus || chosenRoute.riskStatus || "SAFE",
      routeMeanRisk: riskSnapshot?.meanRisk ?? chosenRoute.riskScore ?? 0,
      upcomingHazards: chosenRoute.hazards || [],
      isRouting: false,
      routingError: null,
      navigationMode: "preview",
      remainingDistanceKm: chosenRoute.distanceKm || 0,
      remainingDurationSeconds: chosenRoute.durationSeconds || 0,
      currentManeuverIndex: 0,
      nextManeuverIndex: 1,
    };
    emitChange();
    return chosenRoute;
  } catch (err) {
    if (requestId !== latestRequestId) return null;
    state = {
      ...state,
      isRouting: false,
      routingError: err.message || "Failed to calculate route.",
    };
    emitChange();
    return null;
  } finally {
    activeAbortController = null;
  }
}

// Starts full turn-by-turn driving navigation
export function startDriving() {
  if (!state.routeData) return;

  const instructions = state.routeData.instructions || [];
  const firstManeuver = instructions[0];
  const initialDist = firstManeuver?.distanceKm ?? 0;
  const newSessionId = `resq_nav_${Date.now()}`;

  state = {
    ...state,
    sessionId: newSessionId,
    navigationMode: "driving",
    navigationStatus: "navigating",
    isMonitoring: true,
    rerouteNotice: null,
    currentManeuverIndex: 0,
    nextManeuverIndex: instructions.length > 1 ? 1 : 0,
    currentShapeIndex: 0,
    distanceToNextManeuverKm: initialDist,
    remainingDistanceKm: state.routeData.distanceKm || 0,
    remainingDurationSeconds: state.routeData.durationSeconds || 0,
    cameraFollowing: true,
    isStepsDrawerOpen: false,
  };
  persistNavigationSession();
  emitChange();
}

// Stops driving mode and returns to route preview
export function stopDriving() {
  clearPersistedSession();
  state = {
    ...state,
    sessionId: null,
    navigationMode: "preview",
    navigationStatus: "idle",
    isMonitoring: false,
    rerouteNotice: null,
    cameraFollowing: true,
    isStepsDrawerOpen: false,
  };
  emitChange();
}

// Resets entire route store to idle state
export function clearRoute() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  latestRequestId++;
  clearPersistedSession();

  state = {
    ...INITIAL_STATE,
  };
  emitChange();
}

// Updates real-time GPS coordinates and kinematic properties
export function updateGpsPosition(pos) {
  if (!pos) return;
  state = {
    ...state,
    currentPosition: pos,
    speedKmh: pos.speedKmh ?? state.speedKmh,
    heading: pos.heading ?? state.heading,
  };
  emitChange();
}

// Updates real-time navigation progress along the active route
export function updateNavProgress({
  currentShapeIndex,
  currentManeuverIndex,
  nextManeuverIndex,
  distanceToNextManeuverKm,
  remainingDistanceKm,
  remainingDurationSeconds,
}) {
  state = {
    ...state,
    currentShapeIndex: currentShapeIndex ?? state.currentShapeIndex,
    currentManeuverIndex: currentManeuverIndex ?? state.currentManeuverIndex,
    nextManeuverIndex: nextManeuverIndex ?? state.nextManeuverIndex,
    distanceToNextManeuverKm: distanceToNextManeuverKm ?? state.distanceToNextManeuverKm,
    remainingDistanceKm: remainingDistanceKm ?? state.remainingDistanceKm,
    remainingDurationSeconds: remainingDurationSeconds ?? state.remainingDurationSeconds,
  };
  persistNavigationSession();
  emitChange();
}

// Sets camera follow mode state
export function setCameraFollowing(isFollowing) {
  if (state.cameraFollowing === isFollowing) return;
  state = {
    ...state,
    cameraFollowing: isFollowing,
  };
  emitChange();
}

// Recenter camera follow mode
export function recenterCamera() {
  state = {
    ...state,
    cameraFollowing: true,
  };
  emitChange();
}

// Toggles maneuver steps drawer open/closed
export function toggleStepsDrawer(forceOpen) {
  state = {
    ...state,
    isStepsDrawerOpen: forceOpen !== undefined ? forceOpen : !state.isStepsDrawerOpen,
  };
  emitChange();
}

// Sets off-route recalculated status
export function setOffRouteStatus(isOffRoute) {
  state = {
    ...state,
    navigationStatus: isOffRoute ? "off_route" : "navigating",
    isRerouting: isOffRoute,
  };
  emitChange();
}

// Sets dynamic risk reroute notice banner
export function setRerouteNotice(notice) {
  state = {
    ...state,
    rerouteNotice: notice,
  };
  emitChange();
}

// Updates route risk status metrics from live monitor
export function setRouteRiskMetrics({ status, meanRisk, hazards }) {
  state = {
    ...state,
    routeRiskStatus: status || state.routeRiskStatus,
    routeMeanRisk: meanRisk !== undefined ? meanRisk : state.routeMeanRisk,
    upcomingHazards: hazards || state.upcomingHazards,
  };
  emitChange();
}

// Applies newly calculated route following dynamic risk or off-route reroute
export function applyReroute(newRoute, explanation = null) {
  if (!newRoute) return;

  const instructions = newRoute.instructions || [];
  const firstManeuver = instructions[0];
  const initialDist = firstManeuver?.distanceKm ?? 0;
  const riskSnapshot = newRoute.riskSnapshot;

  state = {
    ...state,
    routeData: newRoute,
    routeExplanation: explanation || newRoute.explanation || state.routeExplanation,
    routeRiskStatus: riskSnapshot?.routeStatus || newRoute.riskStatus || state.routeRiskStatus,
    routeMeanRisk: riskSnapshot?.meanRisk ?? newRoute.riskScore ?? state.routeMeanRisk,
    upcomingHazards: newRoute.hazards || [],
    navigationStatus: "navigating",
    isRerouting: false,
    currentManeuverIndex: 0,
    nextManeuverIndex: instructions.length > 1 ? 1 : 0,
    currentShapeIndex: 0,
    distanceToNextManeuverKm: initialDist,
    remainingDistanceKm: newRoute.distanceKm || 0,
    remainingDurationSeconds: newRoute.durationSeconds || 0,
  };
  persistNavigationSession();
  emitChange();
}

// Triggers destination arrival completion
export function triggerArrival() {
  state = {
    ...state,
    navigationStatus: "arrived",
    remainingDistanceKm: 0,
    remainingDurationSeconds: 0,
  };
  clearPersistedSession();
  emitChange();
}

// React custom hook subscribing to route store state snapshot
import { useState, useEffect } from "react";

export function useRouteStore() {
  const [snapshot, setSnapshot] = useState(getRouteState);

  useEffect(() => {
    return subscribeRouteStore((next) => {
      setSnapshot(next);
    });
  }, []);

  return {
    ...snapshot,
    setDestination,
    setOrigin,
    openSourceModal,
    closeSourceModal,
    calculateRoutePlan,
    startDriving,
    stopDriving,
    clearRoute,
    updateGpsPosition,
    updateNavProgress,
    setCameraFollowing,
    recenterCamera,
    toggleStepsDrawer,
    setOffRouteStatus,
    setRerouteNotice,
    setRouteRiskMetrics,
    applyReroute,
    triggerArrival,
    hydrateNavigationSession,
    persistNavigationSession,
    clearPersistedSession,
  };
}

export default useRouteStore;
