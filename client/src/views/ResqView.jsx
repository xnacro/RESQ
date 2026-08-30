// RESQ Mode Main View for Disaster Safety, Travel Tracking, and Live Emergency Protection
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
} from 'lucide-react'
import { useResqMode } from '../hooks/useResqMode.js'
import { useAuth } from '../app/authContext.jsx'
import styles from './ResqView.module.css'

export function ResqView() {
  const { user } = useAuth()
  const { session, isActive, isLoading, error, startSession, stopSession } = useResqMode()
  const [selectedTimer, setSelectedTimer] = useState(30)
  const [copied, setCopied] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [actionError, setActionError] = useState('')

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

  const handleCopyLink = () => {
    if (!session || !session.session_id) return
    const shareUrl = `${window.location.origin}/resq/track/${session.session_id}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {})
  }

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        {(error || actionError) && (
          <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            {error || actionError}
          </div>
        )}

        {/* INACTIVE STATE: Welcome & Start Control */}
        {!isActive && (
          <>
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
          </>
        )}

        {/* ACTIVE STATE: Active Tracking & Control */}
        {isActive && session && (
          <div className={styles.activeCard}>
            <div className={styles.activeHeader}>
              <div className={styles.activeHeaderLeft}>
                <div className={styles.activeStatusPill}>
                  <span className={styles.activeDot} />
                  <span>RESQ ACTIVE</span>
                </div>
                <h2 className={styles.sessionTitle}>Safety Session In Progress</h2>
              </div>

              <div className={styles.activeHeaderActions}>
                {!confirmEnd ? (
                  <button
                    type="button"
                    className={styles.endBtn}
                    onClick={() => setConfirmEnd(true)}
                  >
                    <PowerOff size={15} />
                    <span>End RESQ Mode</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => setConfirmEnd(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                      onClick={handleEnd}
                      disabled={isLoading}
                    >
                      Confirm Stop
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Session Metadata Overview */}
            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <span className={styles.statBoxLabel}>Personnel</span>
                <span className={styles.statBoxVal}>{session.user_name || user?.name || 'Field Operator'}</span>
              </div>

              <div className={styles.statBox}>
                <span className={styles.statBoxLabel}>Safety Timer</span>
                <span className={styles.statBoxVal}>{session.safety_timer_minutes} Minutes</span>
              </div>

              <div className={styles.statBox}>
                <span className={styles.statBoxLabel}>Current Operational Area</span>
                <span className={styles.statBoxVal}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom', color: '#2563eb' }} />
                  {session.current_district || 'Guwahati'}, {session.current_state || 'Assam'}
                </span>
              </div>
            </div>

            {/* Live Sharing Card */}
            <div className={styles.shareCard}>
              <div className={styles.shareInfo}>
                <span className={styles.shareHeading}>Share Live Safety Link</span>
                <span className={styles.shareSubtext}>
                  Trusted contacts can view your real-time risk level and safety timer at: {window.location.origin}/resq/track/{session.session_id.slice(0, 8)}...
                </span>
              </div>

              <button
                type="button"
                className={styles.copyShareBtn}
                onClick={handleCopyLink}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied Link!' : 'Copy Share Link'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResqView
