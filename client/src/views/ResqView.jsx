// RESQ Mode Main Operational View for Live Disaster Safety, GPS Tracking, Risk, Safety Timer, SOS, and Active Route Monitoring
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
  Siren,
  Route,
  ArrowRight,
} from 'lucide-react'
import { MapSurface } from '../map/MapSurface.jsx'
import { MAP_MODES } from '../map/mapStyles.js'
import { useResqMode } from '../hooks/useResqMode.js'
import styles from './ResqView.module.css'

const SOS_CATEGORIES = [
  { id: 'FLOOD_TRAPPED', label: '🌊 Flood Trapped' },
  { id: 'MEDICAL_EMERGENCY', label: '🚑 Medical Emergency' },
  { id: 'ROAD_COLLAPSE', label: '🚧 Road / Bridge Collapse' },
  { id: 'GENERAL_DISTRESS', label: '🚨 General Distress' },
]

export function ResqView() {
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
    activeRoute,
    rerouteProposal,
    formattedTimeRemaining,
    isTimerWarning,
    isTimerExpired,
    isCheckInPending,
    isSosActive,
    checkIn,
    extendTimer,
    triggerSos,
    cancelSos,
    detachRoute,
    acceptReroute,
    startSession,
    stopSession,
  } = useResqMode()

  const [selectedTimer, setSelectedTimer] = useState(30)
  const [copied, setCopied] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [isSosModalOpen, setIsSosModalOpen] = useState(false)
  const [selectedSosCategory, setSelectedSosCategory] = useState('FLOOD_TRAPPED')
  const [sosNotes, setSosNotes] = useState('')
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

  const handleDispatchSos = async () => {
    setActionError('')
    try {
      await triggerSos({
        emergencyType: selectedSosCategory,
        notes: sosNotes,
      })
      setIsSosModalOpen(false)
    } catch (err) {
      setActionError(err.message || 'Failed to dispatch SOS')
    }
  }

  const handleCancelSos = async () => {
    setActionError('')
    try {
      await cancelSos('Resolved safely by operator')
    } catch (err) {
      setActionError(err.message || 'Failed to cancel SOS')
    }
  }

  const handleAcceptReroute = async () => {
    setActionError('')
    try {
      await acceptReroute()
    } catch (err) {
      setActionError(err.message || 'Failed to switch to alternative safe route')
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
  const status = isSosActive ? 'CRITICAL' : riskData?.riskStatus ?? (session?.risk_status || 'LOW')
  const staticVal = riskData?.staticRisk ?? (session?.static_risk || 24.8)
  const dynamicVal = isSosActive ? 100 : riskData?.dynamicRisk ?? (session?.dynamic_risk || 0)
  const confidence = Math.round((riskData?.riskConfidence ?? 0.95) * 100)

  const radius = 34
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(score, 100) / 100) * circumference

  let gaugeColor = '#10b981'
  let badgeBg = '#f0fdf4'
  let badgeBorder = '#bbf7d0'
  let badgeColor = '#15803d'

  if (isSosActive || status === 'CRITICAL' || score >= 70) {
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
            <div className={`${styles.mapFloatingBar} ${isSosActive ? styles.mapFloatingBarEmergency : ''}`}>
              <div className={styles.floatingLeft}>
                <div className={isSosActive ? styles.sosStatusPill : styles.activeStatusPill}>
                  <span className={isSosActive ? styles.sosDot : styles.activeDot} />
                  <span>{isSosActive ? '🚨 SOS ACTIVE' : 'RESQ ACTIVE'}</span>
                </div>
                <div className={styles.areaBadge}>
                  <MapPin size={14} style={{ color: isSosActive ? '#dc2626' : '#2563eb' }} />
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

            {/* Active SOS Banner / Trigger */}
            {isSosActive ? (
              <div className={styles.emergencySosCard}>
                <div className={styles.emergencySosHeader}>
                  <div className={styles.emergencySosTitle}>
                    <Siren size={18} />
                    <span>EMERGENCY SOS ACTIVE</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                    BROADCASTING
                  </span>
                </div>
                <div className={styles.emergencySosSubtext}>
                  Live GPS telemetry, 500m grid hazard index, and personnel identity have been escalated to regional command response.
                </div>
                <button
                  type="button"
                  className={styles.cancelSosBtn}
                  onClick={handleCancelSos}
                  disabled={isLoading}
                >
                  Cancel SOS • I am Safe
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.sosDispatchBtn}
                onClick={() => setIsSosModalOpen(true)}
              >
                <Siren size={18} />
                <span>DISPATCH EMERGENCY SOS</span>
              </button>
            )}

            {/* Proposed Reroute Alert Card */}
            {rerouteProposal && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#b45309' }}>
                    <AlertTriangle size={16} />
                    <span>SAFER REROUTE PROPOSED</span>
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '6px' }}>
                    RECOMMENDED
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.45 }}>
                  {rerouteProposal.reason || 'Hazard corridor detected ahead. A physical bypass with significantly lower risk has been computed.'}
                </div>
                <button
                  type="button"
                  style={{
                    height: '38px',
                    borderRadius: '10px',
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={handleAcceptReroute}
                  disabled={isLoading}
                >
                  <span>Switch to Safe Route</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Active Route Corridor Status Card */}
            {activeRoute && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Route size={18} style={{ color: '#2563eb' }} />
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                      Active Travel Route
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                      Corridor Monitoring Active
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={detachRoute}
                >
                  Detach
                </button>
              </div>
            )}

            {/* Risk Escalation Alert Banner */}
            {riskAlert && !isSosActive && (
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

      {/* EMERGENCY SOS DISPATCH CONFIRMATION MODAL */}
      {isSosModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.sosModalCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Siren size={24} style={{ color: '#dc2626' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                  Dispatch Emergency SOS
                </h3>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setIsSosModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.45 }}>
              This broadcasts an immediate critical alert to your emergency monitors with your live coordinates, 500m grid cell, and disaster risk breakdown.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Select Emergency Type
              </span>
              <div className={styles.sosCategoryGrid}>
                {SOS_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.sosCategoryBtn} ${selectedSosCategory === cat.id ? styles.sosCategoryBtnActive : ''}`}
                    onClick={() => setSelectedSosCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Additional Notes (Optional)
              </span>
              <input
                type="text"
                value={sosNotes}
                onChange={(e) => setSosNotes(e.target.value)}
                placeholder="e.g. Trapped on second floor, water rising..."
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onClick={() => setIsSosModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  flex: 2,
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                }}
                onClick={handleDispatchSos}
                disabled={isLoading}
              >
                Confirm Dispatch SOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResqView
