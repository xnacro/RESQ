// React hook driving engine coordinating GPS, kinematics, maneuvers, live risk monitoring, and automatic rerouting

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
import {
  calculateRoute,
  registerRouteMonitor,
  updateRouteProgress,
  getRouteMonitorStatus,
  triggerDynamicReroute,
  cleanupRouteMonitor,
} from "../services/routingApi.js";

const OFF_ROUTE_DISTANCE_THRESHOLD_METERS = 35;
const OFF_ROUTE_SUSTAINED_TIME_MS = 4000;
const ARRIVAL_DISTANCE_THRESHOLD_METERS = 35;
const REROUTE_COOLDOWN_MS = 10000;
const MONITOR_POLL_INTERVAL_MS = 3500;

export function useResqDrivingMode(map) {
  const {
    sessionId,
    origin,
    destination,
    routeData,
    navigationMode,
    navigationStatus,
    cameraFollowing,
    currentManeuverIndex,
    currentShapeIndex,
    updateGpsPosition,
    updateNavProgress,
    setCameraFollowing,
    setOffRouteStatus,
    setRerouteNotice,
    setRouteRiskMetrics,
    applyReroute,
    triggerArrival,
  } = useRouteStore();

  const watchIdRef = useRef(null);
  const monitorTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const cameraManagerRef = useRef(null);

  const prevPositionsRef = useRef([]);
  const lastHeadingRef = useRef(0);
  const lastKnownCoordRef = useRef(null);
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

  // 2. Off-Route Valhalla Recalculation
  const triggerOffRouteReroute = useCallback(
    async (currentLat, currentLon) => {
      if (!destination || isRerouteInFlightRef.current) return;

      const now = Date.now();
      if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) return;

      lastRerouteTimeRef.current = now;
      isRerouteInFlightRef.current = true;
      setOffRouteStatus(true);
      setRerouteNotice({
        active: true,
        type: "OFF_ROUTE",
        message: "OFF ROUTE DETECTED",
        detail: "Recalculating route from current position...",
      });

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

          setRerouteNotice({
            active: true,
            type: "SAFER_FOUND",
            message: "ROUTE UPDATED",
            detail: "Navigation resumed on new trajectory.",
          });

          if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = setTimeout(() => {
            setRerouteNotice(null);
            noticeTimerRef.current = null;
          }, 4500);
        }
      } catch (err) {
        console.warn("Off-route recalculation failed:", err.message);
      } finally {
        isRerouteInFlightRef.current = false;
        setOffRouteStatus(false);
      }
    },
    [destination, cameraFollowing, setOffRouteStatus, setRerouteNotice, applyReroute]
  );

  // 3. Dynamic Risk-Aware Reroute Execution
  const triggerRiskReroute = useCallback(
    async (reason = "Route risk changed ahead") => {
      if (!sessionId || isRerouteInFlightRef.current) return;

      const now = Date.now();
      if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) return;

      lastRerouteTimeRef.current = now;
      isRerouteInFlightRef.current = true;

      setRerouteNotice({
        active: true,
        type: "RISK_CHANGED",
        message: "ROUTE RISK CHANGED",
        detail: reason || "Hazard detected on remaining route. Finding a safer bypass...",
      });

      try {
        const currentCoord = lastKnownCoordRef.current || [
          Number(origin.lon ?? origin.longitude ?? origin[0]),
          Number(origin.lat ?? origin.latitude ?? origin[1]),
        ];

        const rerouteRes = await triggerDynamicReroute({
          sessionId,
          currentPosition: currentCoord,
        });

        if (rerouteRes.success && rerouteRes.newRoute) {
          applyReroute(rerouteRes.newRoute, rerouteRes.explanation);
          if (cameraManagerRef.current && cameraFollowing) {
            cameraManagerRef.current.followVehicle(currentCoord, lastHeadingRef.current, 0, true);
          }

          setRerouteNotice({
            active: true,
            type: "SAFER_FOUND",
            message: "SAFER ROUTE FOUND",
            detail: rerouteRes.explanation?.reason || "Safer bypass selected avoiding active hazard.",
          });

          if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = setTimeout(() => {
            setRerouteNotice(null);
            noticeTimerRef.current = null;
          }, 5000);
        } else {
          setRerouteNotice({
            active: true,
            type: "RISK_CHANGED",
            message: "NO SAFE BYPASS FOUND",
            detail: "All alternatives have elevated risk. Proceed with extreme caution.",
          });
        }
      } catch (err) {
        console.error("Dynamic risk reroute error:", err.message);
      } finally {
        isRerouteInFlightRef.current = false;
      }
    },
    [sessionId, origin, cameraFollowing, setRerouteNotice, applyReroute]
  );

  // 4. Register Session for Live 500m Grid Risk Monitoring
  useEffect(() => {
    if (navigationMode !== "driving" || !sessionId || !routeData?.geometry) {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
        monitorTimerRef.current = null;
      }
      return;
    }

    const origCoord = origin
      ? [Number(origin.lon ?? origin.longitude ?? origin[0]), Number(origin.lat ?? origin.latitude ?? origin[1])]
      : routeData.geometry[0];
    const destCoord = destination
      ? [Number(destination.lon ?? destination.longitude ?? destination[0]), Number(destination.lat ?? destination.latitude ?? destination[1])]
      : routeData.geometry[routeData.geometry.length - 1];

    // Register active route with backend monitor
    registerRouteMonitor({
      sessionId,
      routeId: routeData.routeId || `route_${Date.now()}`,
      routeGeometry: routeData.geometry,
      origin: origCoord,
      destination: destCoord,
      vehicle: "car",
    }).then((regRes) => {
      if (regRes.success && regRes.data?.riskSnapshot) {
        setRouteRiskMetrics({
          status: regRes.data.riskSnapshot.routeStatus,
          meanRisk: regRes.data.riskSnapshot.meanRisk,
          hazards: regRes.data.hazards,
        });
      }
    });

    // Start background poll to inspect route risk and upcoming hazards
    monitorTimerRef.current = setInterval(async () => {
      try {
        const monStatus = await getRouteMonitorStatus(sessionId);
        if (monStatus.success && monStatus.data) {
          const data = monStatus.data;
          setRouteRiskMetrics({
            status: data.riskSnapshot?.routeStatus,
            meanRisk: data.riskSnapshot?.meanRisk,
            hazards: data.upcomingHazards,
          });

          // If remaining route becomes blocked or critical, trigger automatic reroute
          if (data.riskSnapshot?.isBlocked || data.riskSnapshot?.routeStatus === "BLOCKED") {
            triggerRiskReroute("Critical road or bridge blockage detected ahead.");
          }
        }
      } catch (e) {
        console.warn("Route monitor poll warning:", e.message);
      }
    }, MONITOR_POLL_INTERVAL_MS);

    return () => {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
        monitorTimerRef.current = null;
      }
      cleanupRouteMonitor(sessionId);
    };
  }, [navigationMode, sessionId, routeData?.geometry, routeData?.routeId, origin, destination, setRouteRiskMetrics, triggerRiskReroute]);

  // 5. Process GPS position fix and update navigation metrics
  const handleGpsPosition = useCallback(
    (pos) => {
      const { latitude: lat, longitude: lon, accuracy = 20, speed = null, heading: rawHeading = null } = pos.coords;
      const geometry = routeData?.geometry || [];
      const instructions = routeData?.instructions || [];

      if (geometry.length === 0) return;

      lastKnownCoordRef.current = [lon, lat];

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
      const progressFraction = matchIndex / Math.max(1, geometry.length - 1);

      // Report progress to backend monitor to trim completed grids
      if (sessionId) {
        updateRouteProgress({ sessionId, currentPosition: [lon, lat], progressFraction });
      }

      // 6. Arrival Detection
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

      // 7. Off-Route Detection (Sustained cross-track deviation > 35m for 4s)
      if (crossTrack > OFF_ROUTE_DISTANCE_THRESHOLD_METERS && accuracy <= 40) {
        if (!offRouteTimerRef.current) {
          offRouteTimerRef.current = setTimeout(() => {
            triggerOffRouteReroute(lat, lon);
            offRouteTimerRef.current = null;
          }, OFF_ROUTE_SUSTAINED_TIME_MS);
        }
      } else {
        if (offRouteTimerRef.current) {
          clearTimeout(offRouteTimerRef.current);
          offRouteTimerRef.current = null;
        }
      }

      // 8. Maneuver Advancement
      let activeManeuverIdx = currentManeuverIndex;
      const currentManeuver = instructions[activeManeuverIdx];

      if (currentManeuver) {
        const turnShapeIdx = currentManeuver.endShapeIndex ?? 0;
        if (matchIndex >= turnShapeIdx && activeManeuverIdx < instructions.length - 1) {
          activeManeuverIdx++;
        }
      }

      const nextManeuverIdx = Math.min(instructions.length - 1, activeManeuverIdx + 1);
      const targetManeuver = instructions[activeManeuverIdx];
      const targetShapeIdx = targetManeuver?.endShapeIndex ?? matchIndex;

      const distToNextManeuverKm = calculateDistanceToShapeIndexKm(lat, lon, geometry, matchIndex, targetShapeIdx);
      const remainingDistanceKm = calculateRemainingDistanceKm(geometry, matchIndex);

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
      sessionId,
      routeData,
      cameraFollowing,
      currentShapeIndex,
      currentManeuverIndex,
      triggerArrival,
      triggerOffRouteReroute,
      updateGpsPosition,
      updateNavProgress,
    ]
  );

  // 9. Start / Stop GPS Geolocation Watcher based on navigation mode
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
    triggerRiskReroute,
  };
}

export default useResqDrivingMode;
