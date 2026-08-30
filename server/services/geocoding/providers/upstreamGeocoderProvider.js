// Internal Geocoding Provider Adapter
// Connects to internal composite pipeline (/api/geocoder/search & /api/geocoder/reverse)
// Resolves locations across Assam, Meghalaya, and national transit corridors with schema normalization

const DEFAULT_PROVIDER_URL = "https://surakshaai.org/api/geocoder";
const DEFAULT_TIMEOUT_MS = 4000;

// Retrieves configured provider base URL
function getProviderBaseUrl() {
  return process.env.GEOCODER_PROVIDER_URL || DEFAULT_PROVIDER_URL;
}

// Retrieves configured timeout in milliseconds
function getProviderTimeoutMs() {
  return parseInt(process.env.GEOCODER_PROVIDER_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
}

// Helper to extract state and district from unstructured address strings
function extractStateAndDistrict(raw) {
  let district = raw.district || raw.county || raw.subdistrict || null;
  let state = raw.state || raw.province || null;

  if ((!state || !district) && raw.address && typeof raw.address === "string") {
    const parts = raw.address.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      if (!state) {
        const lastParts = parts.slice(-3);
        for (const p of lastParts) {
          const cleanPart = p.replace(/\d+/g, "").trim();
          if (cleanPart && cleanPart !== "India") {
            state = cleanPart;
          }
        }
      }
      if (!district && parts.length >= 3) {
        district = parts[parts.length - 2].replace(/\d+/g, "").trim();
      }
    }
  }

  return { district: district || "", state: state || "India" };
}

// Normalizes an upstream place record into the standard RESQ candidate contract
function normalizeCandidate(raw) {
  if (!raw) return null;

  const lat = parseFloat(raw.latitude != null ? raw.latitude : raw.lat);
  const lon = parseFloat(raw.longitude != null ? raw.longitude : raw.lng);

  if (isNaN(lat) || isNaN(lon)) return null;

  const name = (raw.name || raw.displayName || raw.address || "Unknown Location").trim();
  const { district, state } = extractStateAndDistrict(raw);

  // Map 0-100 score / validation score to 0.0 - 1.0 confidence range
  let rawScore = raw.score;
  if (rawScore == null && raw.validation && raw.validation.score != null) {
    rawScore = raw.validation.score;
  }
  const confidence = rawScore != null ? Math.min(1.0, Math.max(0.1, rawScore / 100.0)) : 0.85;

  const display = raw.displayName || raw.address || `${name}${district ? ", " + district : ""}${state ? ", " + state : ""}`;

  return {
    name,
    displayName: display,
    latitude: lat,
    longitude: lon,
    lat,
    lon,
    state,
    district,
    pincode: raw.pincode || null,
    placeType: raw.placeType || raw.primaryType || raw.category || "locality",
    confidence: Math.round(confidence * 100) / 100,
  };
}

// Executes forward location search against internal provider
export const search = async (query, options = {}) => {
  const providerBase = getProviderBaseUrl();
  if (!providerBase || !query || typeof query !== "string") {
    return [];
  }

  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  const timeoutMs = getProviderTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseUrl = providerBase.replace(/\/+$/, "");
    const searchUrl = new URL(`${baseUrl}/search`);
    searchUrl.searchParams.set("q", cleanQuery);

    const response = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "RESQ-Disaster-Platform/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const rawItems = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.candidates)
        ? payload.candidates
        : Array.isArray(payload)
          ? payload
          : [];

    const normalized = [];
    for (const item of rawItems) {
      const candidate = normalizeCandidate(item);
      if (candidate) {
        normalized.push(candidate);
      }
    }

    return normalized;
  } catch (error) {
    // Network errors or timeouts are caught safely
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

// Executes reverse geocoding against internal provider
export const reverse = async (latitude, longitude, options = {}) => {
  const providerBase = getProviderBaseUrl();
  if (!providerBase || isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const timeoutMs = getProviderTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseUrl = providerBase.replace(/\/+$/, "");
    const reverseUrl = new URL(`${baseUrl}/reverse`);
    reverseUrl.searchParams.set("lat", String(latitude));
    reverseUrl.searchParams.set("lng", String(longitude));

    const response = await fetch(reverseUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "RESQ-Disaster-Platform/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const rawItems = Array.isArray(payload.data)
      ? payload.data
      : payload.data
        ? [payload.data]
        : Array.isArray(payload)
          ? payload
          : [payload];

    if (rawItems.length > 0) {
      return normalizeCandidate(rawItems[0]);
    }

    return null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default {
  search,
  reverse,
};
