// Unified RESQ Geocoding Service
// Orchestrates local gazetteers, PostGIS grid resolvers, and upstream provider adapter with caching and fallback
import pool from "../../config/db.js";
import {
  DISTRICT_CENTROIDS,
  LOCALITY_GAZETTEER,
  REGIONAL_CORRIDORS,
  REGIONAL_RIVERS,
} from "../../../nlp/location/nerLocationExtractor.js";
import upstreamGeocoderProvider from "./providers/upstreamGeocoderProvider.js";

// Corridor coordinate registry for Northeast transit infrastructure
const CORRIDOR_COORDINATES = Object.freeze({
  "NH-27": { lat: 26.1500, lon: 91.7000, state: "Assam" },
  "NH-6": { lat: 25.9000, lon: 91.8800, state: "Meghalaya" },
  "NH-37": { lat: 26.5000, lon: 93.0000, state: "Assam" },
  "NH-17": { lat: 26.1000, lon: 90.5000, state: "Assam" },
  "NH-217": { lat: 25.5000, lon: 90.2000, state: "Meghalaya" },
  "Saraighat Bridge": { lat: 26.1762, lon: 91.6917, state: "Assam" },
  "Kolia Bhomora Bridge": { lat: 26.6080, lon: 92.8620, state: "Assam" },
  "Bogibeel Bridge": { lat: 27.4000, lon: 94.9000, state: "Assam" },
  "Naranarayan Setu": { lat: 26.2167, lon: 90.5833, state: "Assam" },
  "Dhola-Sadiya Bridge": { lat: 27.7900, lon: 95.6600, state: "Assam" },
});

// In-memory LRU cache with 10-minute TTL
const searchCache = new Map();
const reverseCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

// Helper: Haversine distance in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalizes cache query string key
function getCacheKey(query) {
  return (query || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Sets a cache item with expiration and bounded map size
function setCache(map, key, value) {
  if (map.size >= MAX_CACHE_SIZE) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }
  map.set(key, { data: value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Retrieves item from cache if not expired
function getCache(map, key) {
  const item = map.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    map.delete(key);
    return null;
  }
  return item.data;
}

// Checks if a candidate is located within regional Northeast India bounds
function isRegionalLocation(item) {
  const state = String(item.state || "").toLowerCase();
  const district = String(item.district || "").toLowerCase();
  const regionalStates = ["assam", "meghalaya", "arunachal", "nagaland", "manipur", "mizoram", "tripura"];

  if (regionalStates.some((s) => state.includes(s))) return true;
  if (district.includes("kamrup") || district.includes("khasi") || district.includes("garo") || district.includes("jaintia")) return true;

  const lat = Number(item.latitude ?? item.lat);
  const lon = Number(item.longitude ?? item.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    return lat >= 24.0 && lat <= 28.5 && lon >= 89.0 && lon <= 97.5;
  }
  return false;
}

// Executes forward geocoding search across local gazetteers, PostGIS grids, and the upstream provider
export const forwardGeocode = async (rawQuery, options = {}) => {
  if (!rawQuery || typeof rawQuery !== "string") {
    return {
      success: false,
      error: "Query parameter must not be empty.",
      candidates: [],
    };
  }

  const queryKey = getCacheKey(rawQuery);
  if (!queryKey) {
    return { success: false, error: "Query parameter must not be empty.", candidates: [] };
  }

  // Check in-memory cache
  const cached = getCache(searchCache, queryKey);
  if (cached) {
    return {
      success: true,
      query: rawQuery,
      count: cached.length,
      candidates: cached,
    };
  }

  const query = queryKey;
  const candidates = [];

  // Priority 1: Direct 500m Grid ID Lookup (e.g., AS_00210744 or ML_00076029)
  if (/^(AS|ML)_\d{8}$/i.test(query)) {
    const isAssam = query.toUpperCase().startsWith("AS");
    const tableName = isAssam ? "grid_500m.assam" : "grid_500m.meghalaya";
    try {
      const gridRes = await pool.query(
        `SELECT grid_id, state, district, center_lat, center_lon, risk_score, risk_status 
         FROM ${tableName} 
         WHERE grid_id = $1;`,
        [query.toUpperCase()]
      );

      if (gridRes.rows.length > 0) {
        const cell = gridRes.rows[0];
        candidates.push({
          name: `Grid ${cell.grid_id}`,
          displayName: `Grid ${cell.grid_id}, ${cell.district || (isAssam ? "Assam" : "Meghalaya")}`,
          category: "GRID_CELL",
          district: cell.district || (isAssam ? "Assam" : "Meghalaya"),
          state: cell.state,
          lat: parseFloat(cell.center_lat),
          lon: parseFloat(cell.center_lon),
          latitude: parseFloat(cell.center_lat),
          longitude: parseFloat(cell.center_lon),
          gridId: cell.grid_id,
          riskScore: parseFloat(cell.risk_score || 0),
          riskStatus: cell.risk_status || "LOW",
          score: 1.0,
        });
      }
    } catch (e) {
      // Gracefully continue to gazetteer search
    }
  }

  // Priority 2: Regional Towns and Localities Gazetteer
  for (const item of LOCALITY_GAZETTEER) {
    const lowerName = item.name.toLowerCase();
    if (lowerName === query) {
      candidates.push({
        name: item.name,
        displayName: `${item.name}, ${item.district}, ${item.state}`,
        category: "TOWN_LOCALITY",
        district: item.district,
        state: item.state,
        lat: item.lat,
        lon: item.lon,
        latitude: item.lat,
        longitude: item.lon,
        score: 0.98,
      });
    } else if (lowerName.startsWith(query) || query.startsWith(lowerName)) {
      candidates.push({
        name: item.name,
        displayName: `${item.name}, ${item.district}, ${item.state}`,
        category: "TOWN_LOCALITY",
        district: item.district,
        state: item.state,
        lat: item.lat,
        lon: item.lon,
        latitude: item.lat,
        longitude: item.lon,
        score: 0.92,
      });
    } else if (lowerName.includes(query) || query.includes(lowerName)) {
      candidates.push({
        name: item.name,
        displayName: `${item.name}, ${item.district}, ${item.state}`,
        category: "TOWN_LOCALITY",
        district: item.district,
        state: item.state,
        lat: item.lat,
        lon: item.lon,
        latitude: item.lat,
        longitude: item.lon,
        score: 0.86,
      });
    }
  }

  // Priority 3: District Centroids
  for (const [name, data] of Object.entries(DISTRICT_CENTROIDS)) {
    const lowerName = name.toLowerCase();
    if (lowerName === query || `${lowerName} district` === query) {
      candidates.push({
        name: `${name} District`,
        displayName: `${name} District, ${data.state}`,
        category: "DISTRICT",
        district: name,
        state: data.state,
        lat: data.lat,
        lon: data.lon,
        latitude: data.lat,
        longitude: data.lon,
        score: 0.95,
      });
    } else if (lowerName.includes(query) || query.includes(lowerName)) {
      candidates.push({
        name: `${name} District`,
        displayName: `${name} District, ${data.state}`,
        category: "DISTRICT",
        district: name,
        state: data.state,
        lat: data.lat,
        lon: data.lon,
        latitude: data.lat,
        longitude: data.lon,
        score: 0.85,
      });
    }
  }

  // Priority 4: Regional Highways and Bridges
  for (const corridor of REGIONAL_CORRIDORS) {
    const lowerName = corridor.name.toLowerCase();
    const matchAlias = (corridor.aliases || []).some((a) => a.toLowerCase().includes(query));
    if (lowerName.includes(query) || matchAlias) {
      const coord = CORRIDOR_COORDINATES[corridor.name] || { lat: 26.1445, lon: 91.7362, state: "Assam" };
      candidates.push({
        name: corridor.name,
        displayName: `${corridor.name}, ${coord.state}`,
        category: corridor.name.includes("Bridge") ? "BRIDGE_STRUCTURE" : "HIGHWAY_CORRIDOR",
        district: "Transit Corridor",
        state: coord.state,
        lat: coord.lat,
        lon: coord.lon,
        latitude: coord.lat,
        longitude: coord.lon,
        score: 0.90,
      });
    }
  }

  // Priority 5: Regional Rivers
  for (const riverName of REGIONAL_RIVERS) {
    const lowerName = riverName.toLowerCase();
    if (lowerName.includes(query) || query.includes(lowerName)) {
      candidates.push({
        name: `${riverName} River Basin`,
        displayName: `${riverName} River Basin, Assam / Meghalaya`,
        category: "RIVER_BASIN",
        district: "River System",
        state: "Assam / Meghalaya",
        lat: 26.1445,
        lon: 91.7362,
        latitude: 26.1445,
        longitude: 91.7362,
        score: 0.80,
      });
    }
  }

  // Priority 6: Upstream Provider Search (Suraksha composite geocoder)
  try {
    const providerResults = await upstreamGeocoderProvider.search(rawQuery, { limit: 10 });
    for (const pr of providerResults) {
      const regional = isRegionalLocation(pr);
      const baseConfidence = pr.confidence || 0.70;
      const score = regional ? Math.min(0.99, baseConfidence + 0.25) : Math.max(0.1, baseConfidence - 0.3);

      candidates.push({
        name: pr.name,
        displayName: pr.displayName || pr.name,
        category: (pr.placeType || "LOCATION").toUpperCase(),
        district: pr.district || (regional ? "Assam/Meghalaya" : "Regional"),
        state: pr.state || (regional ? "Assam" : "India"),
        lat: pr.latitude,
        lon: pr.longitude,
        latitude: pr.latitude,
        longitude: pr.longitude,
        score,
      });
    }
  } catch (e) {
    // Provider failure isolated; local candidates retained
  }

  // Sort candidates by relevance score
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate candidates by spatial proximity and normalized name
  const seen = new Set();
  const deduped = [];

  for (const c of candidates) {
    const key = `${c.name.toLowerCase()}_${c.lat.toFixed(2)}_${c.lon.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(c);
    }
    if (deduped.length >= 8) break;
  }

  // Cache successful result
  setCache(searchCache, queryKey, deduped);

  return {
    success: true,
    query: rawQuery,
    count: deduped.length,
    candidates: deduped,
  };
};

// Executes reverse geocoding to resolve human-readable place description and exact PostGIS 500m grid cell ID
export const reverseGeocode = async (lat, lon, options = {}) => {
  if (isNaN(lat) || isNaN(lon)) {
    return {
      success: false,
      error: "Valid numeric 'lat' and 'lon' query parameters are required.",
    };
  }

  const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const cached = getCache(reverseCache, cacheKey);
  if (cached) {
    return {
      success: true,
      data: cached,
    };
  }

  // 1. In-memory proximity check against known regional localities
  let closestLocality = null;
  let minLocalityDist = Infinity;

  for (const item of LOCALITY_GAZETTEER) {
    const dist = getDistanceKm(lat, lon, item.lat, item.lon);
    if (dist < minLocalityDist) {
      minLocalityDist = dist;
      closestLocality = item;
    }
  }

  // 2. Nearest district centroid check
  let closestDistrict = null;
  let minDistrictDist = Infinity;

  for (const [name, data] of Object.entries(DISTRICT_CENTROIDS)) {
    const dist = getDistanceKm(lat, lon, data.lat, data.lon);
    if (dist < minDistrictDist) {
      minDistrictDist = dist;
      closestDistrict = { name, ...data };
    }
  }

  // 3. PostGIS point-in-polygon query to obtain exact containing 500m cell ID
  let cellInfo = null;
  try {
    const gridRes = await pool.query(
      `SELECT grid_id, state, district, block
       FROM grid_500m.assam
       WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
       LIMIT 1;`,
      [lon, lat]
    );
    if (gridRes.rows.length > 0) {
      cellInfo = gridRes.rows[0];
    } else {
      const mlRes = await pool.query(
        `SELECT grid_id, state, district, block
         FROM grid_500m.meghalaya
         WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
         LIMIT 1;`,
        [lon, lat]
      );
      if (mlRes.rows.length > 0) {
        cellInfo = mlRes.rows[0];
      }
    }
  } catch (e) {
    // Graceful fallback to nearest gazetteer
  }

  // 4. Construct human-readable place description
  let localityName = closestLocality && minLocalityDist < 25 ? closestLocality.name : null;
  let districtName =
    cellInfo?.district ||
    closestLocality?.district ||
    closestDistrict?.name ||
    "Kamrup Metropolitan";
  let stateName = cellInfo?.state || closestLocality?.state || closestDistrict?.state || "Assam";

  // If outside local gazetteer range (> 25km), query upstream reverse provider
  if (!localityName || minLocalityDist >= 25) {
    try {
      const providerRev = await upstreamGeocoderProvider.reverse(lat, lon);
      if (providerRev) {
        localityName = providerRev.name;
        districtName = providerRev.district || districtName;
        stateName = providerRev.state || stateName;
      }
    } catch (e) {}
  }

  const displayName = localityName ? localityName : districtName;

  const resultData = {
    name: displayName,
    locality: localityName,
    district: districtName,
    state: stateName,
    gridId: cellInfo?.grid_id || null,
    distanceToLocalityKm: Math.round(minLocalityDist * 10) / 10,
    lat,
    lon,
    latitude: lat,
    longitude: lon,
  };

  // Cache reverse geocode result
  setCache(reverseCache, cacheKey, resultData);

  return {
    success: true,
    data: resultData,
  };
};

export default {
  forwardGeocode,
  reverseGeocode,
};
