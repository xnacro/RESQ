// RESQ Mode Main Operational View for Live Disaster Safety, GPS Tracking, Risk, and Safety Timer
import { useState } from 'react'
import {
  Shield,
  Clock,
  Navigation,
  Radio,
  PowerOff,
  Copy,
  Check,
  MapPin,
  AlertTriangle,
  Flame,
  X,
  CheckCircle2,
  Hourglass,
} from 'lucide-react'
import { MapSurface } from '../map/MapSurface.jsx'
import { MAP_MODES } from '../map/mapStyles.js'
import { useResqMode } from '../hooks/useResqMode.js'
import { useAuth } from '../app/authContext.jsx'
import styles from './ResqView.module.css'

export function ResqView() {
  const { user } = useAuth()
  const {
    session,
    isActive,
    isLoading,
    error,
    liveLocation,
    gridData,
    riskData,
    activeEvents,
    riskAlert,
    setRiskAlert,
    formattedTimeRemaining,
    isTimerWarning,
    isTimerExpired,
    isCheckInPending,
    checkIn,
    extendTimer,
    startSession,
    stopSession,
  } = useResqMode()

  const [selectedTimer, setSelectedTimer] = useState(30)
  const [copied, setCopied] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [actionError, setActionError] = useState('')
  const [checkInSuccess, setCheckInSuccess] = useState(false)

  const handleStart = async () => {
    setActionError('')
    try {
      await startSession({
        safetyTimerMinutes: selectedTimer,
      })
    } catch (err) {
      setActionError(err.message || 'Failed to start RESQ Mode session')
    }
  }

  const handleEnd = async () => {
    setActionError('')
    try {
      await stopSession()
      setConfirmEnd(false)
    } catch (err) {
      setActionError(err.message || 'Failed to stop session')
    }
  }

  const handleCheckIn = async () => {
    setActionError('')
    try {
      await checkIn()
      setCheckInSuccess(true)
      setTimeout(() => setCheckInSuccess(false), 3000)
    } catch (err) {
      setActionError(err.message || 'Check-in failed')
    }
  }

  const handleExtend = async (mins) => {
    setActionError('')
    try {
      await extendTimer(mins)
    } catch (err) {
      setActionError(err.message || 'Failed to extend safety timer')
    }
  }

  const handleCopyLink = () => {
    if (!session || !session.session_id) return
    const shareUrl = `${window.location.origin}/resq/track/${session.session_id}`
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
      .catch(() => {})
  }

  // Calculate circular SVG gauge progress
  const score = riskData?.riskScore ?? (session?.risk_score || 24.8)
  const status = riskData?.riskStatus ?? (session?.risk_status || 'LOW')
  const staticVal = riskData?.staticRisk ?? (session?.static_risk || 24.8)
  const dynamicVal = riskData?.dynamicRisk ?? (session?.dynamic_risk || 0)
  const confidence = Math.round((riskData?.riskConfidence ?? 0.95) * 100)

  const radius = 34
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(score, 100) / 100) * circumference

  let gaugeColor = '#10b981'
  let badgeBg = '#f0fdf4'
  let badgeBorder = '#bbf7d0'
  let badgeColor = '#15803d'

  if (status === 'CRITICAL' || score >= 70) {
    gaugeColor = '#dc2626'
    badgeBg = '#fef2f2'
    badgeBorder = '#fecaca'
    badgeColor = '#b91c1c'
  } else if (status === 'HIGH' || score >= 45) {
    gaugeColor = '#ea580c'
    badgeBg = '#fff7ed'
    badgeBorder = '#fed7aa'
    badgeColor = '#c2410c'
  } else if (status === 'MODERATE' || score >= 25) {
    gaugeColor = '#d97706'
    badgeBg = '#fffbeb'
    badgeBorder = '#fde68a'
    badgeColor = '#b45309'
  }

  const localityText = gridData?.district
    ? `${gridData.district}, ${gridData.state || 'Assam'}`
    : session?.current_district
    ? `${session.current_district}, ${session.current_state || 'Assam'}`
    : 'Guwahati, Assam'

  return (
    <div className={isActive ? styles.container : styles.inactiveContainer}>
      {/* INACTIVE STATE: Welcome & Start Control */}
      {!isActive && (
        <div className={styles.contentWrapper}>
          {(error || actionError) && (
            <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {error || actionError}
            </div>
          )}

          <div className={styles.heroCard}>
            <div className={styles.shieldIconRing}>
              <Shield size={36} strokeWidth={2.2} />
            </div>
            <h1 className={styles.heroTitle}>RESQ MODE</h1>
            <p className={styles.heroSubtitle}>
              Live disaster safety while you travel. Continuous 500m grid risk evaluation, active flood hazard monitoring, and trusted personnel tracking.
            </p>

            {/* Safety Timer Selection */}
            <div className={styles.timerSection}>
              <span className={styles.timerLabel}>Safety Check-in Timer</span>
              <div className={styles.timerPillGroup}>
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={`${styles.timerBtn} ${selectedTimer === mins ? styles.timerBtnActive : ''}`}
                    onClick={() => setSelectedTimer(mins)}
                  >
                    {mins >= 60 ? `${mins / 60} hr` : `${mins} min`}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Launch Action */}
            <button
              type="button"
              className={styles.startBtn}
              onClick={handleStart}
              disabled={isLoading}
            >
              <Shield size={20} />
              <span>{isLoading ? 'Starting RESQ Mode...' : 'START RESQ MODE'}</span>
            </button>
          </div>

          {/* How RESQ Mode Works Features Grid */}
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <Radio size={20} />
              </div>
              <h3 className={styles.featureTitle}>500m Real-time Grid Risk</h3>
              <p className={styles.featureText}>
                Evaluates terrain, flood models, and live regional bulletins to maintain an authoritative risk index.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <Clock size={20} />
              </div>
              <h3 className={styles.featureTitle}>Automated Safety Timers</h3>
              <p className={styles.featureText}>
                Periodic check-in countdowns notify emergency contacts if safety confirmation is missed.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconCircle}>
                <Navigation size={20} />
              </div>
              <h3 className={styles.featureTitle}>Corridor Rerouting</h3>
              <p className={styles.featureText}>
                Constantly monitors your driving corridor and automatically proposes safer paths if hazards emerge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE OPERATIONAL SPLIT LAYOUT (Live Map + Real-time Risk Intelligence) */}
      {isActive && session && (
        <div className={styles.activeOperationalLayout}>
          {/* Main Map Pane */}
          <div className={styles.activeMapPane}>
            <div className={styles.mapFloatingBar}>
              <div className={styles.floatingLeft}>
                <div className={styles.activeStatusPill}>
                  <span className={styles.activeDot} />
                  <span>RESQ ACTIVE</span>
                </div>
                <div className={styles.areaBadge}>
                  <MapPin size={14} style={{ color: '#2563eb' }} />
                  <span>{localityText}</span>
                </div>
              </div>

              <div className={styles.floatingRight}>
                {!confirmEnd ? (
                  <button
                    type="button"
                    className={styles.endBtn}
                    onClick={() => setConfirmEnd(true)}
                  >
                    <PowerOff size={13} />
                    <span>End RESQ Mode</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      style={{ padding: '4px 10px', background: '#e2e8f0', border: 'none', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => setConfirmEnd(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={{ padding: '4px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                      onClick={handleEnd}
                      disabled={isLoading}
                    >
                      Confirm Stop
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Embedded Live MapSurface Canvas */}
            <MapSurface
              mode={MAP_MODES.NORMAL}
              selectedLocation={
                liveLocation
                  ? {
                      lat: liveLocation.lat,
                      lon: liveLocation.lon,
                      accuracy: liveLocation.accuracy,
                      name: localityText,
                    }
                  : { lat: 26.1445, lon: 91.7362, name: 'Guwahati' }
              }
              selectedGridGeometry={gridData?.geometry || null}
              selectedGridStatus={status}
            />
          </div>

          {/* Right Safety Intelligence Panel */}
          <div className={styles.activeSidePanel}>
            {/* Action or General Error Alert */}
            {actionError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }} />
                {actionError}
              </div>
            )}

            {/* Risk Escalation Alert Banner */}
            {riskAlert && (
              <div className={styles.riskAlertBanner}>
                <Flame size={20} className={styles.alertIcon} />
                <div className={styles.alertContent}>
                  <div className={styles.alertHeading}>{riskAlert.title || '⚠ Elevated Hazard Corridor'}</div>
                  <div className={styles.alertDesc}>{riskAlert.reason}</div>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', padding: '2px' }}
                  onClick={() => setRiskAlert(null)}
                  aria-label="Dismiss alert"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Safety Countdown Timer & Check-in Card */}
            <div className={`${styles.timerCard} ${isTimerExpired ? styles.timerCardExpired : isTimerWarning ? styles.timerCardWarning : ''}`}>
              <div className={styles.timerHeaderRow}>
                <div className={styles.timerTitle}>
                  <Hourglass size={14} />
                  <span>SAFETY CHECK-IN TIMER</span>
                </div>
                <div className={`${styles.timerCountdownDisplay} ${isTimerExpired ? styles.timerCountdownExpired : isTimerWarning ? styles.timerCountdownWarning : ''}`}>
                  {formattedTimeRemaining}
                </div>
              </div>

              {/* Primary Check-in Button */}
              <button
                type="button"
                className={styles.checkInBtn}
                onClick={handleCheckIn}
                disabled={isCheckInPending}
              >
                {checkInSuccess ? <CheckCircle2 size={18} /> : <Shield size={18} />}
                <span>{checkInSuccess ? "CHECKED IN • YOU'RE SAFE" : isCheckInPending ? "Checking in..." : "I'M SAFE • CHECK IN"}</span>
              </button>

              {/* Extend Timer Group */}
              <div className={styles.extendBtnGroup}>
                <button
                  type="button"
                  className={styles.extendBtn}
                  onClick={() => handleExtend(15)}
                >
                  +15 min
                </button>
                <button
                  type="button"
                  className={styles.extendBtn}
                  onClick={() => handleExtend(30)}
                >
                  +30 min
                </button>
                <button
                  type="button"
                  className={styles.extendBtn}
                  onClick={() => handleExtend(60)}
                >
                  +1 hr
                </button>
              </div>
            </div>

            {/* Primary Live Dynamic Risk Gauge */}
            <div className={styles.riskGaugeCard}>
              <div className={styles.gaugeCircleWrapper}>
                <svg className={styles.gaugeSvg} viewBox="0 0 82 82">
                  <circle
                    cx="41"
                    cy="41"
                    r={radius}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="6.5"
                  />
                  <circle
                    cx="41"
                    cy="41"
                    r={radius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="6.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span className={styles.gaugeScoreNumber}>{score.toFixed(1)}</span>
                  <span className={styles.gaugeScoreMax}>/ 100</span>
                </div>
              </div>

              <div className={styles.riskGaugeInfo}>
                <div className={styles.riskTitleRow}>
                  <span className={styles.riskLabelTitle}>DYNAMIC RISK INDEX</span>
                  <span
                    className={styles.riskStatusBadge}
                    style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeColor }}
                  >
                    {status}
                  </span>
                </div>

                <div className={styles.riskSubMetrics}>
                  <div className={styles.metricPill}>
                    <span className={styles.metricKey}>STATIC</span>
                    <span className={styles.metricVal}>{staticVal.toFixed(1)}</span>
                  </div>
                  <div className={styles.metricPill}>
                    <span className={styles.metricKey}>DYNAMIC</span>
                    <span className={styles.metricVal}>{dynamicVal.toFixed(1)}</span>
                  </div>
                  <div className={styles.metricPill}>
                    <span className={styles.metricKey}>CONFIDENCE</span>
                    <span className={styles.metricVal}>{confidence}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 500m Grid Cell Info */}
            <div className={styles.gridInfoCard}>
              <div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Current 500m Grid Cell
                </div>
                <div className={styles.gridIdMono}>{gridData?.gridId || session?.current_grid_id || 'AS_00210744'}</div>
              </div>
              <div className={styles.gridLocalityText}>{localityText}</div>
            </div>

            {/* Active Disaster Hazards List */}
            <div className={styles.hazardsSection}>
              <span className={styles.sectionHeader}>Active Local Hazards ({activeEvents.length})</span>
              {activeEvents.length === 0 ? (
                <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  ✓ No severe structural or flood blockages detected in immediate 500m cell.
                </div>
              ) : (
                activeEvents.slice(0, 3).map((ev, i) => (
                  <div key={ev.id || i} className={styles.hazardItem}>
                    <div className={styles.hazardTitleRow}>
                      <span className={styles.hazardTitle}>{ev.news_title || ev.location_text || 'Hazard Alert'}</span>
                      <span className={styles.hazardSeverity}>{ev.severity || 0}/100</span>
                    </div>
                    <span className={styles.hazardMeta}>
                      {ev.event_type || 'ALERT'} · Source: {ev.source_name || 'Regional Feed'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Live Sharing Card */}
            <div className={styles.shareCard}>
              <div>
                <div className={styles.shareHeading}>Share Live Safety Link</div>
                <div className={styles.shareSubtext}>
                  Trusted monitors can track your real-time risk at /resq/track/{session.session_id.slice(0, 8)}...
                </div>
              </div>

              <button
                type="button"
                className={styles.copyShareBtn}
                onClick={handleCopyLink}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResqView
