// Centralized route and turn-by-turn driving state management store for RESQ

import { getRoute } from "./routingApi.js";

const SESSION_STORAGE_KEY = "resq_active_navigation_session";
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Initial state snapshot
const INITIAL_STATE = {
  origin: null,
  destination: null,
  routeData: null,
  alternatives: [],
  activeRouteMode: "fastest",
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
      origin: state.origin,
      destination: state.destination,
      routeData: state.routeData,
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
      origin: data.origin || null,
      destination: data.destination,
      routeData: data.routeData,
      currentManeuverIndex: data.currentManeuverIndex || 0,
      currentShapeIndex: data.currentShapeIndex || 0,
      navigationMode: data.navigationMode || "preview",
      navigationStatus: data.navigationStatus || "idle",
      remainingDistanceKm: data.routeData.distanceKm || 0,
      remainingDurationSeconds: data.routeData.durationSeconds || 0,
      cameraFollowing: true,
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

// Sets the current origin location
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

// Calculates normal Valhalla route between origin and destination
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

    const res = await getRoute({
      origin: originCoord,
      destination: destCoord,
      mode: "fastest",
      vehicle: "car",
      alternatives: 2,
    });

    if (requestId !== latestRequestId) return null;

    if (!res.success || !res.route) {
      state = {
        ...state,
        isRouting: false,
        routingError: res.error?.message || "No feasible road route found between selected points.",
      };
      emitChange();
      return null;
    }

    state = {
      ...state,
      routeData: res.route,
      alternatives: res.alternatives || [],
      isRouting: false,
      routingError: null,
      navigationMode: "preview",
      remainingDistanceKm: res.route.distanceKm || 0,
      remainingDurationSeconds: res.route.durationSeconds || 0,
      currentManeuverIndex: 0,
      nextManeuverIndex: 1,
    };
    emitChange();
    return res.route;
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

  state = {
    ...state,
    navigationMode: "driving",
    navigationStatus: "navigating",
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
    navigationMode: "preview",
    navigationStatus: "idle",
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

// Toggles turn-by-turn steps drawer
export function toggleStepsDrawer() {
  state = {
    ...state,
    isStepsDrawerOpen: !state.isStepsDrawerOpen,
  };
  emitChange();
}

// Marks off-route status and begins recalculating state
export function setOffRouteStatus(isOffRoute) {
  state = {
    ...state,
    navigationStatus: isOffRoute ? "off_route" : "navigating",
    isRerouting: isOffRoute,
  };
  emitChange();
}

// Replaces active route with newly calculated reroute trajectory
export function applyReroute(newRoute) {
  if (!newRoute) return;
  state = {
    ...state,
    routeData: newRoute,
    navigationStatus: "navigating",
    isRerouting: false,
    currentManeuverIndex: 0,
    nextManeuverIndex: (newRoute.instructions?.length || 0) > 1 ? 1 : 0,
    currentShapeIndex: 0,
    remainingDistanceKm: newRoute.distanceKm || 0,
    remainingDurationSeconds: newRoute.durationSeconds || 0,
  };
  persistNavigationSession();
  emitChange();
}

// Marks destination arrival
export function triggerArrival() {
  state = {
    ...state,
    navigationStatus: "arrived",
    remainingDistanceKm: 0,
    remainingDurationSeconds: 0,
    distanceToNextManeuverKm: 0,
  };
  clearPersistedSession();
  emitChange();
}

// Sets active navigation mode
export function setNavigationMode(mode) {
  state = {
    ...state,
    navigationMode: mode,
  };
  emitChange();
}

// React hook helper for consuming route store
import { useState, useEffect } from "react";

export function useRouteStore() {
  const [storeState, setStoreState] = useState(getRouteState);

  useEffect(() => {
    return subscribeRouteStore(setStoreState);
  }, []);

  return {
    ...storeState,
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
    applyReroute,
    triggerArrival,
    setNavigationMode,
    hydrateNavigationSession,
  };
}

export default {
  subscribeRouteStore,
  getRouteState,
  persistNavigationSession,
  hydrateNavigationSession,
  clearPersistedSession,
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
  applyReroute,
  triggerArrival,
  setNavigationMode,
  useRouteStore,
};
