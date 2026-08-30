// Route Summary & Preview Panel Component for RESQ
import {
  ArrowRight,
  Navigation,
  Clock,
  MapPin,
  X,
  Zap,
  Shield,
  ArrowUp,
  ArrowRight as TurnRight,
  ArrowLeft as TurnLeft,
  RotateCcw,
  Flag,
  CornerUpRight,
  CornerUpLeft,
} from 'lucide-react'
import { useMemo } from 'react'
import styles from './RouteSummaryPanel.module.css'

// Helper to format maneuver distance in meters or kilometers
function formatDistance(distKm) {
  if (distKm == null) return '0 m'
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m`
  }
  return `${distKm.toFixed(1)} km`
}

// Maps maneuver icon identifier to Lucide icon component
function getManeuverIconComponent(iconName) {
  switch (iconName) {
    case 'start':
      return Navigation
    case 'destination':
      return Flag
    case 'left':
      return TurnLeft
    case 'right':
      return TurnRight
    case 'uturn':
      return RotateCcw
    case 'merge_right':
      return CornerUpRight
    case 'merge_left':
      return CornerUpLeft
    default:
      return ArrowUp
  }
}

export function RouteSummaryPanel({
  routeData,
  origin,
  destination,
  onStartNavigation,
  onClearRoute,
}) {
  const originName = origin?.displayName || origin?.name || 'Starting Point'
  const destName = destination?.displayName || destination?.name || 'Destination'
  const distanceKm = routeData?.distanceKm ?? 0
  const durationMin = routeData?.durationMinutes ?? Math.round((routeData?.durationSeconds || 0) / 60)
  const instructions = routeData?.instructions || []

  // Estimate arrival time
  const etaFormatted = useMemo(() => {
    const totalSec = routeData?.durationSeconds || 0
    const now = new Date()
    const arrivalTime = new Date(now.getTime() + totalSec * 1000)
    return arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [routeData?.durationSeconds])

  if (!routeData) return null

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleRow}>
          <div className={styles.badgePulse}>
            <span className={styles.pulseDot} />
            <span>ROUTE PREVIEW</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClearRoute}
            aria-label="Close route"
          >
            <X size={16} />
          </button>
        </div>

        {/* Route Path Strip */}
        <div className={styles.pathStrip}>
          <div className={styles.pathNode}>
            <div className={styles.originDot} />
            <span className={styles.nodeText} title={originName}>{originName}</span>
          </div>
          <ArrowRight size={14} className={styles.pathArrow} />
          <div className={styles.pathNode}>
            <div className={styles.destDot} />
            <span className={styles.nodeText} title={destName}>{destName}</span>
          </div>
        </div>
      </div>

      {/* Route Mode Switcher */}
      <div className={styles.modeSwitcher}>
        <div className={`${styles.modeCard} ${styles.modeCardActive}`}>
          <div className={styles.modeCardHeader}>
            <Zap size={14} className={styles.fastIcon} />
            <span className={styles.modeCardTitle}>Fast Route (Active)</span>
          </div>
          <div className={styles.modeCardStats}>
            <span className={styles.modeEta}>{durationMin} min</span>
            <span className={styles.modeDist}>• {distanceKm} km</span>
          </div>
        </div>

        <div className={`${styles.modeCard} ${styles.modeCardDisabled}`} title="Risk-Aware Safe Routing will be active in the next phase">
          <div className={styles.modeCardHeader}>
            <Shield size={14} className={styles.safeIcon} />
            <span className={styles.modeCardTitle}>Safe Route</span>
          </div>
          <span className={styles.comingSoonTag}>Risk Engine Coming Next</span>
        </div>
      </div>

      {/* Route Summary Overview */}
      <div className={styles.statsSummary}>
        <div className={styles.statBox}>
          <Clock size={16} className={styles.statIcon} />
          <div>
            <span className={styles.statValue}>{durationMin} mins</span>
            <span className={styles.statLabel}>ETA: {etaFormatted}</span>
          </div>
        </div>
        <div className={styles.statBox}>
          <MapPin size={16} className={styles.statIcon} />
          <div>
            <span className={styles.statValue}>{distanceKm} km</span>
            <span className={styles.statLabel}>Distance</span>
          </div>
        </div>
      </div>

      {/* Step-by-Step Maneuver Instructions */}
      <div className={styles.maneuverSection}>
        <h3 className={styles.sectionHeading}>Turn-by-Turn Directions</h3>
        <div className={styles.maneuverList}>
          {instructions.map((step, idx) => {
            const IconComp = getManeuverIconComponent(step.icon)
            return (
              <div key={`step_${idx}`} className={styles.maneuverItem}>
                <div className={styles.stepIconCircle}>
                  <IconComp size={16} />
                </div>
                <div className={styles.stepDetails}>
                  <p className={styles.stepInstruction}>{step.instruction}</p>
                  <div className={styles.stepMeta}>
                    <span className={styles.stepDistance}>{formatDistance(step.distanceKm)}</span>
                    {step.streetNames && step.streetNames.length > 0 && (
                      <span className={styles.stepStreet}>• {step.streetNames.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.startNavBtn}
          onClick={onStartNavigation}
        >
          <Navigation size={16} />
          <span>Start Navigation</span>
        </button>
      </div>
    </div>
  )
}

export default RouteSummaryPanel
