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
  auto: "auto",
  ambulance: "auto",
  relief_truck: "auto",
  "4x4": "auto",
  water_tanker: "auto",
};

// Normalizes coordinate inputs from either [lng, lat] arrays or { lat, lon } objects
export function normalizeCoord(input) {
  if (!input) return null;
  if (Array.isArray(input) && input.length >= 2) {
    const lon = Number(input[0]);
    const lat = Number(input[1]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  if (typeof input === "object") {
    const lat = Number(input.lat ?? input.latitude);
    const lon = Number(input.lon ?? input.lng ?? input.longitude);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  return null;
}

// Maps Valhalla maneuver type code to visual directional icon identifier
export function getManeuverIcon(type) {
  switch (type) {
    case 1:
    case 2:
    case 3:
      return "start";
    case 4:
    case 5:
    case 6:
      return "destination";
    case 8:
    case 22:
      return "straight";
    case 9:
    case 10:
    case 11:
    case 18:
    case 20:
    case 23:
      return "right";
    case 14:
    case 15:
    case 16:
    case 19:
    case 21:
    case 24:
      return "left";
    case 12:
    case 13:
      return "uturn";
    case 25:
    case 37:
      return "merge_right";
    case 38:
      return "merge_left";
    case 26:
    case 27:
      return "roundabout";
    default:
      return "straight";
  }
}

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
    icon: getManeuverIcon(m.type),
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
  units = "kilometers",
  alternatives = 2,
  timeoutMs = 5000,
}) {
  // Normalize and validate origin and destination coordinates
  const normOrigin = normalizeCoord(origin);
  const normDest = normalizeCoord(destination);

  if (!normOrigin) {
    const err = new Error("Invalid or missing origin coordinates");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (!normDest) {
    const err = new Error("Invalid or missing destination coordinates");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (normOrigin.lat < -90 || normOrigin.lat > 90 || normOrigin.lon < -180 || normOrigin.lon > 180) {
    const err = new Error("Origin coordinates out of valid geographic range");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (normDest.lat < -90 || normDest.lat > 90 || normDest.lon < -180 || normDest.lon > 180) {
    const err = new Error("Destination coordinates out of valid geographic range");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  // Prevent identical origin and destination
  const latDiff = Math.abs(normOrigin.lat - normDest.lat);
  const lonDiff = Math.abs(normOrigin.lon - normDest.lon);
  if (latDiff < 0.00005 && lonDiff < 0.00005) {
    const err = new Error("Origin and destination cannot be identical location");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  // Regional bounding coverage check
  const originInside = isWithinRegionalCoverage(normOrigin.lat, normOrigin.lon);
  const destInside = isWithinRegionalCoverage(normDest.lat, normDest.lon);

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

  // Route mode validation
  const normalizedMode = String(mode).toLowerCase();
  if (normalizedMode === "safe" || normalizedMode === "balanced") {
    const err = new Error(
      `Route mode '${mode}' will be enabled in the Risk-Aware Routing Layer. Only 'fastest' physical routing is active currently.`
    );
    err.code = "MODE_NOT_IMPLEMENTED";
    err.status = 501;
    throw err;
  }

  if (normalizedMode !== "fastest" && normalizedMode !== "car" && normalizedMode !== "auto") {
    const err = new Error(`Unsupported route mode '${mode}'. Supported modes: fastest, car.`);
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
      { lat: normOrigin.lat, lon: normOrigin.lon, type: "break" },
      { lat: normDest.lat, lon: normDest.lon, type: "break" },
    ],
    costing: costingProfile,
    alternates: clampedAlternatives,
    directions_options: {
      units: units === "miles" ? "miles" : "kilometers",
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
    mode: normalizedMode === "car" ? "car" : "fastest",
    vehicle: {
      type: normalizedVehicle,
      costingProfile,
    },
    latencyMs,
    route: primaryRoute,
    alternatives: normalizedAlternatives,
  };
}
