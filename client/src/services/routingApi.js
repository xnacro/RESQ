// Client API service for RESQ physical routing engine

const API_BASE = "/api";

// Computes physical road route between origin and destination
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

export default {
  getRoute,
  checkRoutingHealth,
};
