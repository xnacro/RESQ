// Fullscreen turn-by-turn driving navigation overlay and HUD for RESQ with live risk monitoring

import { useMemo } from "react";
import {
  X,
  Navigation,
  Compass,
  ArrowUp,
  ArrowRight as TurnRight,
  ArrowLeft as TurnLeft,
  RotateCcw,
  Flag,
  CornerUpRight,
  CornerUpLeft,
  List,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useRouteStore } from "../services/routeStore.js";
import { formatMetricDistance } from "./navigationMath.js";
import styles from "./ResqNavigationOverlay.module.css";

// Renders vector icon corresponding to Valhalla maneuver identifier
function ManeuverIcon({ icon, size = 20, className = "" }) {
  switch (icon) {
    case "start":
      return <Navigation size={size} className={className} />;
    case "destination":
      return <Flag size={size} className={className} />;
    case "left":
      return <TurnLeft size={size} className={className} />;
    case "right":
      return <TurnRight size={size} className={className} />;
    case "uturn":
      return <RotateCcw size={size} className={className} />;
    case "merge_right":
      return <CornerUpRight size={size} className={className} />;
    case "merge_left":
      return <CornerUpLeft size={size} className={className} />;
    default:
      return <ArrowUp size={size} className={className} />;
  }
}

export function ResqNavigationOverlay({ onRecenter }) {
  const {
    routeData,
    destination,
    navigationStatus,
    routeRiskStatus,
    routeMeanRisk,
    upcomingHazards,
    rerouteNotice,
    currentManeuverIndex,
    nextManeuverIndex,
    distanceToNextManeuverKm,
    remainingDistanceKm,
    remainingDurationSeconds,
    speedKmh,
    cameraFollowing,
    isStepsDrawerOpen,
    isRerouting,
    stopDriving,
    recenterCamera,
    toggleStepsDrawer,
  } = useRouteStore();

  const instructions = routeData?.instructions || [];
  const currentManeuver = instructions[currentManeuverIndex] || instructions[0];
  const nextManeuver = instructions[nextManeuverIndex];

  // Compute estimated time of arrival (ETA)
  const etaFormatted = useMemo(() => {
    const totalSec = remainingDurationSeconds || 0;
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + totalSec * 1000);
    return arrivalTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [remainingDurationSeconds]);

  const remainingMin = Math.round((remainingDurationSeconds || 0) / 60);
  const destName = destination?.displayName || destination?.name || "Destination";

  const handleRecenter = () => {
    recenterCamera();
    if (onRecenter) onRecenter();
  };

  // Determine risk monitor status pill color and text
  const isHighRisk = routeRiskStatus === "HIGH" || routeRiskStatus === "HIGH_RISK" || routeRiskStatus === "CRITICAL" || routeRiskStatus === "BLOCKED";
  const isBlocked = routeRiskStatus === "BLOCKED";

  return (
    <div className={styles.overlayRoot}>
      {/* 1. TOP MANEUVER BANNER */}
      <div className={styles.topSection}>
        {/* Dynamic Risk Reroute Alert Banner */}
        {rerouteNotice?.active && (
          <div
            className={
              rerouteNotice.type === "SAFER_FOUND"
                ? styles.saferFoundBanner
                : styles.offRouteBanner
            }
          >
            {rerouteNotice.type === "SAFER_FOUND" ? (
              <CheckCircle2 size={18} className={styles.alertIcon} />
            ) : (
              <AlertTriangle size={18} className={styles.alertIcon} />
            )}
            <div className={styles.alertDetails}>
              <span className={styles.alertTitle}>{rerouteNotice.message}</span>
              <span className={styles.alertSubtitle}>{rerouteNotice.detail}</span>
            </div>
          </div>
        )}

        {/* Off-Route Recalculation Alert */}
        {(navigationStatus === "off_route" || isRerouting) && !rerouteNotice?.active && (
          <div className={styles.offRouteBanner}>
            <AlertTriangle size={18} className={styles.alertIcon} />
            <div className={styles.alertDetails}>
              <span className={styles.alertTitle}>OFF ROUTE DETECTED</span>
              <span className={styles.alertSubtitle}>Recalculating route from current position...</span>
            </div>
          </div>
        )}

        {/* Arrival Announcement Banner */}
        {navigationStatus === "arrived" && (
          <div className={styles.arrivalBanner}>
            <CheckCircle2 size={20} className={styles.arrivalIcon} />
            <div>
              <span className={styles.arrivalTitle}>You Have Arrived</span>
              <span className={styles.arrivalSubtitle}>{destName}</span>
            </div>
          </div>
        )}

        {/* Active Maneuver Card */}
        {navigationStatus !== "arrived" && (
          <div className={styles.maneuverCard}>
            <div className={styles.maneuverMainRow}>
              <div className={styles.iconCircle}>
                <ManeuverIcon icon={currentManeuver?.icon} size={32} className={styles.turnIcon} />
              </div>
              <div className={styles.instructionDetails}>
                <span className={styles.distanceMetric}>
                  {formatMetricDistance(distanceToNextManeuverKm)}
                </span>
                <h1 className={styles.primaryInstruction}>
                  {currentManeuver?.instruction || "Continue on route"}
                </h1>
                {currentManeuver?.streetNames && currentManeuver.streetNames.length > 0 && (
                  <p className={styles.streetName}>{currentManeuver.streetNames.join(", ")}</p>
                )}
              </div>
            </div>

            {/* Next Step Preview */}
            {nextManeuver && nextManeuverIndex > currentManeuverIndex && (
              <div className={styles.nextStepRow}>
                <span className={styles.nextTag}>THEN</span>
                <ManeuverIcon icon={nextManeuver.icon} size={14} className={styles.nextIcon} />
                <span className={styles.nextInstruction}>
                  {nextManeuver.instruction} ({formatMetricDistance(nextManeuver.distanceKm)})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Upcoming Hazard Corridor Warning Strip */}
        {upcomingHazards && upcomingHazards.length > 0 && navigationStatus !== "arrived" && (
          <div className={styles.hazardStrip}>
            <ShieldAlert size={14} className={styles.hazardIcon} />
            <span className={styles.hazardText}>
              {upcomingHazards[0].title || upcomingHazards[0].hazardType || "Hazard"} detected on route ahead
            </span>
          </div>
        )}
      </div>

      {/* 2. RECENTER FLOATING ACTION BUTTON */}
      {!cameraFollowing && navigationStatus === "navigating" && (
        <div className={styles.recenterContainer}>
          <button
            type="button"
            className={styles.recenterBtn}
            onClick={handleRecenter}
            aria-label="Recenter navigation"
          >
            <Compass size={18} />
            <span>Recenter</span>
          </button>
        </div>
      )}

      {/* 3. BOTTOM NAVIGATION HUD */}
      <div className={styles.bottomSection}>
        <div className={styles.hudCard}>
          {/* Live Risk Status Strip */}
          <div className={styles.riskStatusStrip}>
            <div className={styles.monitorBadge}>
              <span className={isHighRisk ? styles.pulseDotRed : styles.pulseDotGreen} />
              <span>ROUTE MONITORED</span>
            </div>
            <div className={isBlocked ? styles.riskPillBlocked : isHighRisk ? styles.riskPillHigh : styles.riskPillLow}>
              {isHighRisk ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
              <span>
                {isBlocked ? "BLOCKED" : `Risk ${Math.round(routeMeanRisk)} (${routeRiskStatus})`}
              </span>
            </div>
          </div>

          <div className={styles.metricsRow}>
            {/* ETA & Duration */}
            <div className={styles.metricGroup}>
              <div className={styles.etaValue}>
                {remainingMin} <span className={styles.metricUnit}>min</span>
              </div>
              <div className={styles.metricSub}>ETA {etaFormatted}</div>
            </div>

            {/* Remaining Distance */}
            <div className={styles.metricGroup}>
              <div className={styles.distValue}>
                {remainingDistanceKm?.toFixed(1) || 0} <span className={styles.metricUnit}>km</span>
              </div>
              <div className={styles.metricSub}>Remaining</div>
            </div>

            {/* Live Speed */}
            <div className={styles.metricGroup}>
              <div className={styles.speedValue}>
                {speedKmh || 0} <span className={styles.metricUnit}>km/h</span>
              </div>
              <div className={styles.metricSub}>Speed</div>
            </div>
          </div>

          {/* Action Control Strip */}
          <div className={styles.actionStrip}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={toggleStepsDrawer}
              aria-label="View turn steps"
            >
              <List size={16} />
              <span>Steps</span>
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.exitBtn}`}
              onClick={stopDriving}
              aria-label="Exit navigation"
            >
              <X size={16} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. TURN-BY-TURN STEPS DRAWER */}
      {isStepsDrawerOpen && (
        <div className={styles.drawerOverlay} onClick={toggleStepsDrawer}>
          <div className={styles.drawerCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitle}>Turn-by-Turn Route Steps</div>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={toggleStepsDrawer}
                aria-label="Close steps"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.stepsList}>
              {instructions.map((step, idx) => {
                const isActive = idx === currentManeuverIndex;
                const isPassed = idx < currentManeuverIndex;

                return (
                  <div
                    key={`step_${idx}`}
                    className={`${styles.stepItem} ${isActive ? styles.stepActive : ""} ${
                      isPassed ? styles.stepPassed : ""
                    }`}
                  >
                    <div className={styles.stepIconBox}>
                      <ManeuverIcon icon={step.icon} size={18} />
                    </div>
                    <div className={styles.stepInfo}>
                      <p className={styles.stepTitle}>{step.instruction}</p>
                      <div className={styles.stepSub}>
                        <span>{formatMetricDistance(step.distanceKm)}</span>
                        {step.streetNames && step.streetNames.length > 0 && (
                          <span>• {step.streetNames.join(", ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResqNavigationOverlay;
