// Internal Geocoding Provider Adapter
// Connects to internal composite pipeline with resilient fallback
// Resolves locations across Assam, Meghalaya, and national transit corridors with schema normalization

const DEFAULT_PROVIDER_URL = "https://surakshaai.org/api/geocoder";
const DEFAULT_TIMEOUT_MS = 2500;

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

// Secondary fallback geocoding provider using Nominatim
async function searchNominatim(cleanQuery) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&limit=8&addressdetails=1&countrycodes=in&viewbox=89.0,28.5,97.5,24.0&bounded=0`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "RESQ-Disaster-Intelligence/1.0 (contact@resq.demo)",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const items = await response.json();
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        const addr = item.address || {};
        const district =
          addr.state_district ||
          addr.county ||
          addr.city ||
          addr.town ||
          addr.subdistrict ||
          "";
        const state = addr.state || "Assam";
        const name = item.name || item.display_name.split(",")[0].trim();
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        if (isNaN(lat) || isNaN(lon)) return null;

        return {
          name,
          displayName: item.display_name,
          latitude: lat,
          longitude: lon,
          lat,
          lon,
          state,
          district,
          pincode: addr.postcode || null,
          placeType: item.type || item.class || "locality",
          confidence: item.importance ? Math.min(0.98, item.importance + 0.5) : 0.85,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// Secondary fallback reverse geocoding provider using Nominatim
async function reverseNominatim(latitude, longitude) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "RESQ-Disaster-Intelligence/1.0 (contact@resq.demo)",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const item = await response.json();
    if (!item || !item.lat || !item.lon) return null;

    const addr = item.address || {};
    const district =
      addr.state_district ||
      addr.county ||
      addr.city ||
      addr.town ||
      addr.subdistrict ||
      "";
    const state = addr.state || "Assam";
    const name = item.name || item.display_name.split(",")[0].trim();
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    if (isNaN(lat) || isNaN(lon)) return null;

    return {
      name,
      displayName: item.display_name,
      latitude: lat,
      longitude: lon,
      lat,
      lon,
      state,
      district,
      pincode: addr.postcode || null,
      placeType: item.type || item.class || "locality",
      confidence: 0.90,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Executes forward location search against internal provider with fallback
export const search = async (query, options = {}) => {
  const providerBase = getProviderBaseUrl();
  if (!query || typeof query !== "string") {
    return [];
  }

  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  const timeoutMs = getProviderTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let results = [];

  try {
    if (providerBase) {
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

      if (response.ok) {
        const payload = await response.json();
        const rawItems = Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.candidates)
            ? payload.candidates
            : Array.isArray(payload)
              ? payload
              : [];

        for (const item of rawItems) {
          const candidate = normalizeCandidate(item);
          if (candidate) {
            results.push(candidate);
          }
        }
      }
    }
  } catch {
    // Network errors or timeouts fall through to backup resolver
  } finally {
    clearTimeout(timeoutId);
  }

  if (results.length === 0) {
    results = await searchNominatim(cleanQuery);
  }

  return results;
};

// Executes reverse geocoding against internal provider with fallback
export const reverse = async (latitude, longitude, options = {}) => {
  const providerBase = getProviderBaseUrl();
  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const timeoutMs = getProviderTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (providerBase) {
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

      if (response.ok) {
        const payload = await response.json();
        const rawItems = Array.isArray(payload.data)
          ? payload.data
          : payload.data
            ? [payload.data]
            : Array.isArray(payload)
              ? payload
              : [payload];

        if (rawItems.length > 0) {
          const candidate = normalizeCandidate(rawItems[0]);
          if (candidate) return candidate;
        }
      }
    }
  } catch {
    // Falls through to fallback reverse
  } finally {
    clearTimeout(timeoutId);
  }

  return await reverseNominatim(latitude, longitude);
};

export default {
  search,
  reverse,
};
