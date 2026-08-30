// Route state management store for RESQ physical navigation and preview flows

import { getRoute } from "./routingApi.js";

// Global in-memory route state and listeners
let state = {
  origin: null,
  destination: null,
  routeData: null,
  activeRouteMode: "fastest",
  vehicle: "car",
  isRouting: false,
  routingError: null,
  navigationMode: "idle", // 'idle' | 'preview' | 'driving'
  navigationStatus: "idle", // 'idle' | 'navigating' | 'arrived'
  isSourceModalOpen: false,
};

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

  // Cancel any ongoing in-flight route request
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

    // Guard against stale asynchronous responses
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

// Clears active route and resets navigation state to idle
export function clearRoute() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  latestRequestId++;

  state = {
    ...state,
    routeData: null,
    origin: null,
    routingError: null,
    isRouting: false,
    navigationMode: "idle",
    navigationStatus: "idle",
    isSourceModalOpen: false,
  };
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
    clearRoute,
    setNavigationMode,
  };
}

export default {
  subscribeRouteStore,
  getRouteState,
  setDestination,
  setOrigin,
  openSourceModal,
  closeSourceModal,
  calculateRoutePlan,
  clearRoute,
  setNavigationMode,
  useRouteStore,
};
