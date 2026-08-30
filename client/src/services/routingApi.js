// Client API service for RESQ physical routing, risk evaluation, and live navigation monitoring

const API_BASE = "/api";

// Computes physical road route or risk-aware route between origin and destination
export async function getRoute({
  origin,
  destination,
  mode = "fastest",
  vehicle = "car",
  alternatives = 2,
}) {
  if (!origin || !destination) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Origin and destination coordinates are required",
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE}/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        origin,
        destination,
        mode,
        vehicle,
        alternatives,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: json.error || {
          code: `HTTP_${res.status}`,
          message: `Routing request failed with status ${res.status}`,
        },
      };
    }

    return json;
  } catch (err) {
    console.error("RESQ getRoute error:", err.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err.message,
      },
    };
  }
}

// Queries routing engine health and tileset status
export async function checkRoutingHealth() {
  try {
    const res = await fetch(`${API_BASE}/route/health`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("RESQ checkRoutingHealth error:", err.message);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err.message,
      },
    };
  }
}

// Registers active route for real-time 500m grid risk monitoring
export async function registerRouteMonitor({ sessionId, routeId, routeGeometry, origin, destination, vehicle }) {
  try {
    const res = await fetch(`${API_BASE}/route/monitor/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, routeId, routeGeometry, origin, destination, vehicle }),
    });
    return await res.json();
  } catch (err) {
    console.warn("Register monitor warning:", err.message);
    return { success: false, error: err.message };
  }
}

// Reports vehicle GPS progress along route and trims passed grids
export async function updateRouteProgress({ sessionId, currentPosition, progressFraction }) {
  try {
    const res = await fetch(`${API_BASE}/route/monitor/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, currentPosition, progressFraction }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Queries live monitoring status and upcoming hazards
export async function getRouteMonitorStatus(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/route/monitor/${sessionId}`);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Executes dynamic risk rerouting from vehicle's current location
export async function triggerDynamicReroute({ sessionId, currentPosition }) {
  try {
    const res = await fetch(`${API_BASE}/route/reroute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, currentPosition }),
    });
    return await res.json();
  } catch (err) {
    console.error("Dynamic reroute request error:", err.message);
    return { success: false, error: err.message };
  }
}

// Cleans up active route monitoring session
export async function cleanupRouteMonitor(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/route/monitor/${sessionId}`, { method: "DELETE" });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Simulates risk update on grid cell for browser test validation
export async function simulateRiskChange({ gridId, riskScore = 90, riskStatus = "CRITICAL", roadClosureRisk = 95 }) {
  try {
    const res = await fetch(`${API_BASE}/route/monitor/simulate-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gridId, riskScore, riskStatus, roadClosureRisk }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export const calculateRoute = getRoute;

export default {
  getRoute,
  calculateRoute,
  checkRoutingHealth,
  registerRouteMonitor,
  updateRouteProgress,
  getRouteMonitorStatus,
  triggerDynamicReroute,
  cleanupRouteMonitor,
  simulateRiskChange,
};
