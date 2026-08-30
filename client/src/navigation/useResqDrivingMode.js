// React hook driving engine coordinating GPS, kinematics, maneuvers, off-route detection, and rerouting

import { useEffect, useRef, useCallback } from "react";
import { useRouteStore } from "../services/routeStore.js";
import { ResqVehicleMarker } from "./resqVehicleMarker.js";
import { ResqCameraManager } from "./resqCameraManager.js";
import {
  calculateBearing,
  findNearestRouteProgress,
  calculateRemainingDistanceKm,
  calculateDistanceToShapeIndexKm,
  haversineDistanceMeters,
} from "./navigationMath.js";
import { calculateRoute } from "../services/routingApi.js";

const OFF_ROUTE_DISTANCE_THRESHOLD_METERS = 35;
const OFF_ROUTE_SUSTAINED_TIME_MS = 4000;
const ARRIVAL_DISTANCE_THRESHOLD_METERS = 35;
const REROUTE_COOLDOWN_MS = 10000;

export function useResqDrivingMode(map) {
  const {
    routeData,
    destination,
    navigationMode,
    navigationStatus,
    cameraFollowing,
    currentManeuverIndex,
    currentShapeIndex,
    updateGpsPosition,
    updateNavProgress,
    setCameraFollowing,
    setOffRouteStatus,
    applyReroute,
    triggerArrival,
  } = useRouteStore();

  const watchIdRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const cameraManagerRef = useRef(null);

  const prevPositionsRef = useRef([]);
  const lastHeadingRef = useRef(0);
  const offRouteTimerRef = useRef(null);
  const lastRerouteTimeRef = useRef(0);
  const isRerouteInFlightRef = useRef(false);
  const rerouteAbortControllerRef = useRef(null);

  // 1. Initialize Camera Manager and Vehicle Marker
  useEffect(() => {
    if (!map) return;

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = new ResqVehicleMarker();
    }

    if (!cameraManagerRef.current) {
      cameraManagerRef.current = new ResqCameraManager(map, () => {
        setCameraFollowing(false);
      });
      cameraManagerRef.current.attachListeners();
    }

    return () => {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      if (cameraManagerRef.current) {
        cameraManagerRef.current.destroy();
        cameraManagerRef.current = null;
      }
    };
  }, [map, setCameraFollowing]);

  // 2. Automatic Valhalla Reroute Execution
  const triggerAutoReroute = useCallback(
    async (currentLat, currentLon) => {
      if (!destination || isRerouteInFlightRef.current) return;

      const now = Date.now();
      if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) return;

      lastRerouteTimeRef.current = now;
      isRerouteInFlightRef.current = true;
      setOffRouteStatus(true);

      if (rerouteAbortControllerRef.current) {
        rerouteAbortControllerRef.current.abort();
      }
      rerouteAbortControllerRef.current = new AbortController();

      try {
        const destCoord = [
          Number(destination.lon ?? destination.longitude ?? destination[0]),
          Number(destination.lat ?? destination.latitude ?? destination[1]),
        ];

        const res = await calculateRoute({
          origin: [currentLon, currentLat],
          destination: destCoord,
          mode: "fastest",
          vehicle: "car",
        });

        if (res.success && res.route) {
          applyReroute(res.route);
          if (cameraManagerRef.current && cameraFollowing) {
            cameraManagerRef.current.followVehicle([currentLon, currentLat], lastHeadingRef.current, 0, true);
          }
        }
      } catch (err) {
        console.warn("Reroute request failed:", err.message);
      } finally {
        isRerouteInFlightRef.current = false;
        setOffRouteStatus(false);
      }
    },
    [destination, cameraFollowing, setOffRouteStatus, applyReroute]
  );

  // 3. Process GPS position fix and update navigation metrics
  const handleGpsPosition = useCallback(
    (pos) => {
      const { latitude: lat, longitude: lon, accuracy = 20, speed = null, heading: rawHeading = null } = pos.coords;
      const geometry = routeData?.geometry || [];
      const instructions = routeData?.instructions || [];

      if (geometry.length === 0) return;

      // Calculate speed in km/h with smoothing buffer
      const speedKmh = speed != null && speed >= 0 ? Math.round(speed * 3.6) : 0;

      // Compute heading with fallback to forward vector along trajectory
      let effectiveHeading = lastHeadingRef.current;
      if (rawHeading != null && !isNaN(rawHeading) && rawHeading >= 0 && rawHeading <= 360) {
        effectiveHeading = rawHeading;
      } else {
        const history = prevPositionsRef.current;
        if (history.length > 0) {
          const lastPos = history[history.length - 1];
          const dist = haversineDistanceMeters(lat, lon, lastPos.lat, lastPos.lon);
          if (dist > 1.5) {
            effectiveHeading = calculateBearing(lastPos.lat, lastPos.lon, lat, lon);
          }
        }
      }
      lastHeadingRef.current = effectiveHeading;

      prevPositionsRef.current.push({ lat, lon, time: Date.now() });
      if (prevPositionsRef.current.length > 5) {
        prevPositionsRef.current.shift();
      }

      // Update vehicle marker and camera
      if (map && vehicleMarkerRef.current) {
        vehicleMarkerRef.current.update(map, [lon, lat], effectiveHeading);
      }

      if (map && cameraManagerRef.current && cameraFollowing) {
        cameraManagerRef.current.followVehicle([lon, lat], effectiveHeading, speedKmh, false);
      }

      // Match current GPS point to route geometry via sliding window
      const progress = findNearestRouteProgress(lat, lon, geometry, currentShapeIndex, 15, 60);
      const matchIndex = progress.nearestIndex;
      const crossTrack = progress.crossTrackMeters;

      // 4. Arrival Detection
      const destCoord = geometry[geometry.length - 1];
      const distToDestMeters = haversineDistanceMeters(lat, lon, destCoord[1], destCoord[0]);

      if (distToDestMeters <= ARRIVAL_DISTANCE_THRESHOLD_METERS && matchIndex >= geometry.length - 8) {
        triggerArrival();
        if (watchIdRef.current) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        return;
      }

      // 5. Off-Route Detection (Sustained cross-track deviation > 35m for 4s)
      if (crossTrack > OFF_ROUTE_DISTANCE_THRESHOLD_METERS && accuracy <= 40) {
        if (!offRouteTimerRef.current) {
          offRouteTimerRef.current = setTimeout(() => {
            triggerAutoReroute(lat, lon);
            offRouteTimerRef.current = null;
          }, OFF_ROUTE_SUSTAINED_TIME_MS);
        }
      } else {
        if (offRouteTimerRef.current) {
          clearTimeout(offRouteTimerRef.current);
          offRouteTimerRef.current = null;
        }
      }

      // 6. Maneuver Advancement
      let activeManeuverIdx = currentManeuverIndex;
      const currentManeuver = instructions[activeManeuverIdx];

      if (currentManeuver) {
        const turnShapeIdx = currentManeuver.endShapeIndex ?? 0;
        // Advance maneuver when vehicle passes the turn vertex
        if (matchIndex >= turnShapeIdx && activeManeuverIdx < instructions.length - 1) {
          activeManeuverIdx++;
        }
      }

      const nextManeuverIdx = Math.min(instructions.length - 1, activeManeuverIdx + 1);
      const targetManeuver = instructions[activeManeuverIdx];
      const targetShapeIdx = targetManeuver?.endShapeIndex ?? matchIndex;

      const distToNextManeuverKm = calculateDistanceToShapeIndexKm(lat, lon, geometry, matchIndex, targetShapeIdx);
      const remainingDistanceKm = calculateRemainingDistanceKm(geometry, matchIndex);

      // Estimate remaining time based on remaining distance
      const avgSpeed = Math.max(speedKmh, 35);
      const remainingDurationSeconds = Math.round((remainingDistanceKm / avgSpeed) * 3600);

      // Sync state to routeStore
      updateGpsPosition({
        lat,
        lon,
        latitude: lat,
        longitude: lon,
        accuracy,
        speed,
        speedKmh,
        heading: effectiveHeading,
        timestamp: pos.timestamp || Date.now(),
      });

      updateNavProgress({
        currentShapeIndex: matchIndex,
        currentManeuverIndex: activeManeuverIdx,
        nextManeuverIndex: nextManeuverIdx,
        distanceToNextManeuverKm: distToNextManeuverKm,
        remainingDistanceKm,
        remainingDurationSeconds,
      });
    },
    [
      map,
      routeData,
      cameraFollowing,
      currentShapeIndex,
      currentManeuverIndex,
      triggerArrival,
      triggerAutoReroute,
      updateGpsPosition,
      updateNavProgress,
    ]
  );

  // 7. Start / Stop GPS Geolocation Watcher based on navigation mode
  useEffect(() => {
    if (navigationMode !== "driving" || navigationStatus === "arrived") {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (offRouteTimerRef.current) {
        clearTimeout(offRouteTimerRef.current);
        offRouteTimerRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      console.warn("Geolocation API not supported");
      return;
    }

    // Fast initial position acquisition
    navigator.geolocation.getCurrentPosition(
      (pos) => handleGpsPosition(pos),
      (err) => console.warn("Initial GPS error:", err.message),
      { enableHighAccuracy: true, timeout: 5000 }
    );

    // Continuous high-accuracy watcher
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handleGpsPosition(pos),
      (err) => console.warn("Continuous GPS watch warning:", err.message),
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (offRouteTimerRef.current) {
        clearTimeout(offRouteTimerRef.current);
        offRouteTimerRef.current = null;
      }
    };
  }, [navigationMode, navigationStatus, handleGpsPosition]);

  return {
    recenter: useCallback(() => {
      setCameraFollowing(true);
      const pos = prevPositionsRef.current[prevPositionsRef.current.length - 1];
      if (pos && map && cameraManagerRef.current) {
        cameraManagerRef.current.followVehicle([pos.lon, pos.lat], lastHeadingRef.current, 0, false);
      }
    }, [map, setCameraFollowing]),
  };
}

export default useResqDrivingMode;
