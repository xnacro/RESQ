// Valhalla routing engine integration service for RESQ physical routing

import { getValhallaUrl } from "./valhallaHealthService.js";

// Regional bounding box covering Assam and Meghalaya (Northeast India)
export const REGIONAL_BOUNDS = {
  minLat: 24.0,
  maxLat: 28.5,
  minLon: 89.0,
  maxLon: 97.5,
};

// Maneuver type index to descriptive string name mapping
export const MANEUVER_TYPE_NAMES = {
  0: "None",
  1: "Start",
  2: "StartRight",
  3: "StartLeft",
  4: "Destination",
  5: "DestinationRight",
  6: "DestinationLeft",
  7: "Becomes",
  8: "Continue",
  9: "SlightRight",
  10: "Right",
  11: "SharpRight",
  12: "UturnRight",
  13: "UturnLeft",
  14: "SharpLeft",
  15: "Left",
  16: "SlightLeft",
  17: "RampStraight",
  18: "RampRight",
  19: "RampLeft",
  20: "ExitRight",
  21: "ExitLeft",
  22: "StayStraight",
  23: "StayRight",
  24: "StayLeft",
  25: "Merge",
  26: "RoundaboutEnter",
  27: "RoundaboutExit",
  28: "FerryEnter",
  29: "FerryExit",
  30: "Transit",
  31: "TransitTransfer",
  32: "TransitRemainOn",
  33: "TransitConnectionStart",
  34: "TransitConnectionTransfer",
  35: "TransitConnectionDestination",
  36: "PostTransitConnectionDestination",
  37: "MergeRight",
  38: "MergeLeft",
};

// Supported RESQ vehicle types mapped to Valhalla automotive costing
export const VEHICLE_COSTING_MAP = {
  car: "auto",
  ambulance: "auto",
  relief_truck: "auto",
  "4x4": "auto",
  water_tanker: "auto",
};

// Checks if a coordinate falls inside the regional Northeast India routing bounds
export function isWithinRegionalCoverage(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  return (
    lat >= REGIONAL_BOUNDS.minLat &&
    lat <= REGIONAL_BOUNDS.maxLat &&
    lon >= REGIONAL_BOUNDS.minLon &&
    lon <= REGIONAL_BOUNDS.maxLon
  );
}

// Decodes a Valhalla Polyline6 string into GeoJSON [longitude, latitude] coordinates
export function decodePolyline6(str) {
  if (!str || typeof str !== "string") return [];
  let index = 0;
  const len = str.length;
  let lat = 0;
  let lon = 0;
  const coordinates = [];

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;

    // GeoJSON coordinate order: [longitude, latitude]
    coordinates.push([lon / 1e6, lat / 1e6]);
  }

  return coordinates;
}

// Normalizes maneuvers from a Valhalla trip leg
function normalizeManeuvers(maneuvers = []) {
  return maneuvers.map((m) => ({
    type: m.type,
    typeName: MANEUVER_TYPE_NAMES[m.type] || "Maneuver",
    instruction: m.instruction || "",
    verbalInstruction:
      m.verbal_transition_alert_instruction ||
      m.verbal_pre_transition_instruction ||
      m.verbal_succinct_transition_instruction ||
      m.instruction ||
      "",
    streetNames: m.street_names || [],
    distanceKm: typeof m.length === "number" ? Math.round(m.length * 1000) / 1000 : 0,
    durationSeconds: typeof m.time === "number" ? Math.round(m.time) : 0,
    beginShapeIndex: m.begin_shape_index ?? 0,
    endShapeIndex: m.end_shape_index ?? 0,
  }));
}

// Normalizes a raw Valhalla trip object into a consistent RESQ route structure
function normalizeTrip(trip) {
  if (!trip || !trip.legs || !trip.legs.length) {
    throw new Error("Invalid trip object structure from Valhalla");
  }

  const primaryLeg = trip.legs[0];
  const geometry = decodePolyline6(primaryLeg.shape || "");
  const instructions = normalizeManeuvers(primaryLeg.maneuvers || []);

  const summary = {
    hasTolls: Boolean(trip.summary?.has_toll),
    hasHighway: Boolean(trip.summary?.has_highway),
    hasFerry: Boolean(trip.summary?.has_ferry),
    hasTimeRestrictions: Boolean(trip.summary?.has_time_restrictions),
  };

  const boundingBox = {
    minLat: trip.summary?.min_lat ?? null,
    minLon: trip.summary?.min_lon ?? null,
    maxLat: trip.summary?.max_lat ?? null,
    maxLon: trip.summary?.max_lon ?? null,
  };

  const distanceKm =
    typeof trip.summary?.length === "number"
      ? Math.round(trip.summary.length * 100) / 100
      : 0;

  const durationSeconds =
    typeof trip.summary?.time === "number"
      ? Math.round(trip.summary.time)
      : 0;

  const durationMinutes = Math.round(durationSeconds / 60);

  return {
    distanceKm,
    durationSeconds,
    durationMinutes,
    geometry,
    summary,
    boundingBox,
    instructions,
  };
}

// Request and calculate route from upstream Valhalla server
export async function calculateRoute({
  origin,
  destination,
  mode = "fastest",
  vehicle = "car",
  alternatives = 2,
  timeoutMs = 5000,
}) {
  // Validate coordinates
  if (!origin || typeof origin.lat !== "number" || typeof origin.lon !== "number") {
    const err = new Error("Invalid or missing origin coordinates");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (!destination || typeof destination.lat !== "number" || typeof destination.lon !== "number") {
    const err = new Error("Invalid or missing destination coordinates");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (origin.lat < -90 || origin.lat > 90 || origin.lon < -180 || origin.lon > 180) {
    const err = new Error("Origin coordinates out of valid geographic range");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (destination.lat < -90 || destination.lat > 90 || destination.lon < -180 || destination.lon > 180) {
    const err = new Error("Destination coordinates out of valid geographic range");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  // Regional bounding coverage check
  const originInside = isWithinRegionalCoverage(origin.lat, origin.lon);
  const destInside = isWithinRegionalCoverage(destination.lat, destination.lon);

  if (!originInside || !destInside) {
    const err = new Error(
      "Requested route lies outside the active Assam-Meghalaya regional routing coverage area."
    );
    err.code = "ROUTING_OUTSIDE_COVERAGE";
    err.status = 422;
    err.details = {
      coverage: "Assam & Meghalaya (Northeast India)",
      bounds: REGIONAL_BOUNDS,
      originInside,
      destInside,
    };
    throw err;
  }

  // Mode validation
  if (mode === "safe" || mode === "balanced") {
    const err = new Error(
      `Route mode '${mode}' will be enabled in Stage 3 (Risk-Aware Routing Layer). Only 'fastest' physical routing is active currently.`
    );
    err.code = "MODE_NOT_IMPLEMENTED";
    err.status = 501;
    throw err;
  }

  if (mode !== "fastest") {
    const err = new Error(`Unsupported route mode '${mode}'. Supported modes: fastest.`);
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  // Vehicle mapping
  const normalizedVehicle = String(vehicle).toLowerCase();
  const costingProfile = VEHICLE_COSTING_MAP[normalizedVehicle] || "auto";

  // Build Valhalla request payload
  const clampedAlternatives = Math.max(0, Math.min(4, parseInt(alternatives, 10) || 0));
  const valhallaPayload = {
    locations: [
      { lat: origin.lat, lon: origin.lon, type: "break" },
      { lat: destination.lat, lon: destination.lon, type: "break" },
    ],
    costing: costingProfile,
    alternates: clampedAlternatives,
    directions_options: {
      units: "kilometers",
      language: "en-US",
    },
  };

  const baseUrl = getValhallaUrl();
  const targetUrl = `${baseUrl.replace(/\/+$/, "")}/route`;
  const startTime = Date.now();

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    response = await fetch(targetUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(valhallaPayload),
    });

    clearTimeout(timeoutId);
  } catch (netErr) {
    if (netErr.name === "AbortError") {
      const err = new Error(`Valhalla routing request timed out after ${timeoutMs}ms`);
      err.code = "ROUTING_TIMEOUT";
      err.status = 504;
      throw err;
    }

    const err = new Error(`Valhalla routing engine unavailable at ${targetUrl}: ${netErr.message}`);
    err.code = "ROUTING_ENGINE_UNAVAILABLE";
    err.status = 503;
    throw err;
  }

  const rawText = await response.text();
  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    const err = new Error("Invalid response format from routing engine");
    err.code = "ROUTING_ENGINE_ERROR";
    err.status = 502;
    throw err;
  }

  if (!response.ok || !json.trip) {
    const statusMsg = json.status_message || json.error || "No route found";
    const err = new Error(statusMsg);
    err.code = json.error_code === 171 || response.status === 400 ? "ROUTE_NOT_FOUND" : "ROUTING_ENGINE_ERROR";
    err.status = response.status === 400 ? 404 : response.status;
    err.upstreamCode = json.error_code;
    throw err;
  }

  const latencyMs = Date.now() - startTime;
  const primaryRoute = normalizeTrip(json.trip);

  // Normalize alternatives if present
  const normalizedAlternatives = Array.isArray(json.alternates)
    ? json.alternates.map((alt, idx) => ({
        alternativeIndex: idx + 1,
        ...normalizeTrip(alt.trip),
      }))
    : [];

  const routeId = `resq_route_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    success: true,
    routingEngine: "resq",
    routeId,
    mode: "fastest",
    vehicle: {
      type: normalizedVehicle,
      costingProfile,
    },
    latencyMs,
    route: primaryRoute,
    alternatives: normalizedAlternatives,
  };
}
