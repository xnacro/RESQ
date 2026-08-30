// Spatial mathematics and route geometry tracking utilities for RESQ navigation

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371.0088;

// Converts degrees to radians
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Converts radians to degrees
function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

// Calculates Haversine distance between two coordinates in kilometers
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// Calculates Haversine distance between two coordinates in meters
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

// Calculates initial bearing from point 1 to point 2 in degrees (0 - 360)
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (toDegrees(bearingRad) + 360) % 360;

  return bearingDeg;
}

// Projects a coordinate onto a line segment and calculates minimum distance in meters
export function pointToSegmentDistanceMeters(pLat, pLon, aLat, aLon, bLat, bLon) {
  const abDist = haversineDistanceMeters(aLat, aLon, bLat, bLon);
  if (abDist < 0.1) {
    return haversineDistanceMeters(pLat, pLon, aLat, aLon);
  }

  // Planar approximation for local high-speed cross-track projection
  const avgLatRad = toRadians((aLat + bLat + pLat) / 3);
  const cosLat = Math.cos(avgLatRad);

  const px = (pLon - aLon) * cosLat;
  const py = pLat - aLat;
  const bx = (bLon - aLon) * cosLat;
  const by = bLat - aLat;

  const dot = px * bx + py * by;
  const lenSq = bx * bx + by * by;
  const param = Math.max(0, Math.min(1, dot / lenSq));

  const projLon = aLon + param * (bLon - aLon);
  const projLat = aLat + param * (bLat - aLat);

  return haversineDistanceMeters(pLat, pLon, projLat, projLon);
}

// Finds the nearest coordinate on a route geometry using a forward sliding window
export function findNearestRouteProgress(
  lat,
  lon,
  geometry = [],
  currentIndex = 0,
  backwardWindow = 15,
  forwardWindow = 60
) {
  if (!geometry || geometry.length === 0) {
    return {
      nearestIndex: 0,
      nearestCoord: null,
      distanceMeters: Infinity,
      crossTrackMeters: Infinity,
    };
  }

  const totalPoints = geometry.length;
  const start = Math.max(0, currentIndex - backwardWindow);
  const end = Math.min(totalPoints - 1, currentIndex + forwardWindow);

  let bestIndex = currentIndex;
  let minPointDist = Infinity;

  // 1. Find closest vertex in window
  for (let i = start; i <= end; i++) {
    const [cLon, cLat] = geometry[i];
    const dist = haversineDistanceMeters(lat, lon, cLat, cLon);
    if (dist < minPointDist) {
      minPointDist = dist;
      bestIndex = i;
    }
  }

  // 2. Check cross-track distance to adjacent segments
  let minSegmentDist = minPointDist;
  const prevIdx = Math.max(0, bestIndex - 1);
  const nextIdx = Math.min(totalPoints - 1, bestIndex + 1);

  if (prevIdx !== bestIndex) {
    const [aLon, aLat] = geometry[prevIdx];
    const [bLon, bLat] = geometry[bestIndex];
    const segDist = pointToSegmentDistanceMeters(lat, lon, aLat, aLon, bLat, bLon);
    if (segDist < minSegmentDist) minSegmentDist = segDist;
  }

  if (nextIdx !== bestIndex) {
    const [aLon, aLat] = geometry[bestIndex];
    const [bLon, bLat] = geometry[nextIdx];
    const segDist = pointToSegmentDistanceMeters(lat, lon, aLat, aLon, bLat, bLon);
    if (segDist < minSegmentDist) minSegmentDist = segDist;
  }

  return {
    nearestIndex: bestIndex,
    nearestCoord: geometry[bestIndex],
    distanceMeters: minPointDist,
    crossTrackMeters: minSegmentDist,
  };
}

// Calculates exact remaining cumulative distance from a given route shape index to the end
export function calculateRemainingDistanceKm(geometry = [], fromIndex = 0) {
  if (!geometry || geometry.length <= 1 || fromIndex >= geometry.length - 1) {
    return 0;
  }

  let totalKm = 0;
  for (let i = fromIndex; i < geometry.length - 1; i++) {
    const [lon1, lat1] = geometry[i];
    const [lon2, lat2] = geometry[i + 1];
    totalKm += haversineDistanceKm(lat1, lon1, lat2, lon2);
  }

  return Math.round(totalKm * 100) / 100;
}

// Calculates distance from current position to a target shape index along route
export function calculateDistanceToShapeIndexKm(
  currentLat,
  currentLon,
  geometry = [],
  fromIndex = 0,
  targetIndex = 0
) {
  if (!geometry || geometry.length === 0 || targetIndex <= fromIndex) {
    const targetCoord = geometry[targetIndex] || geometry[0];
    if (targetCoord) {
      return haversineDistanceKm(currentLat, currentLon, targetCoord[1], targetCoord[0]);
    }
    return 0;
  }

  // Distance from GPS point to start vertex
  const [startLon, startLat] = geometry[fromIndex];
  let totalKm = haversineDistanceKm(currentLat, currentLon, startLat, startLon);

  // Cumulative distance along intermediate line segments
  const limit = Math.min(geometry.length - 1, targetIndex);
  for (let i = fromIndex; i < limit; i++) {
    const [lon1, lat1] = geometry[i];
    const [lon2, lat2] = geometry[i + 1];
    totalKm += haversineDistanceKm(lat1, lon1, lat2, lon2);
  }

  return Math.round(totalKm * 100) / 100;
}

// Calculates smooth interpolation between two angular bearings in degrees
export function interpolateBearing(fromBearing, toBearing, alpha = 0.2) {
  let diff = ((toBearing - fromBearing + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return (fromBearing + diff * alpha + 360) % 360;
}

// Formats maneuver distance into clean metric representation
export function formatMetricDistance(distKm) {
  if (distKm == null || isNaN(distKm) || distKm <= 0) return "0 m";
  if (distKm < 1) {
    const meters = Math.round(distKm * 1000);
    return meters < 50 ? "Now" : `${meters} m`;
  }
  return `${distKm.toFixed(1)} km`;
}
