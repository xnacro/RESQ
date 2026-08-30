// RESQ Mode Public/Trusted Live Safety Tracking Viewer
import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Shield,
  Clock,
  AlertTriangle,
  Siren,
  UserCheck,
  Radio,
  ExternalLink,
} from 'lucide-react'
import { MapSurface } from '../map/MapSurface.jsx'
import { MAP_MODES } from '../map/mapStyles.js'
import { getResqSessionTelemetry, registerResqTracker } from '../services/resqApi.js'
import styles from './ResqTrackView.module.css'

export function ResqTrackView() {
  const { sessionId } = useParams()
  const [telemetry, setTelemetry] = useState(null)
  const [geometry, setGeometry] = useState(null)
  const [activeEvents, setActiveEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdatedSec, setLastUpdatedSec] = useState(0)

  const pollIntervalRef = useRef(null)

  // 1. Initial Heartbeat & Continuous Telemetry Polling
  useEffect(() => {
    if (!sessionId) return

    // Register tracker heartbeat
    registerResqTracker(sessionId, 'Command Monitor')

    const fetchTelemetry = async () => {
      try {
        const data = await getResqSessionTelemetry(sessionId)
        if (data && data.success) {
          setTelemetry(data.session)
          setGeometry(data.geometry || null)
          setActiveEvents(data.activeEvents || [])
          setError(null)
          setLastUpdatedSec(0)
        } else {
          setError('Session not found or link has expired')
        }
      } catch (err) {
        console.warn('Telemetry fetch error:', err.message)
        setError('Unable to load live telemetry')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTelemetry()
    pollIntervalRef.current = setInterval(fetchTelemetry, 6000)

    // Second tick for "Updated X sec ago"
    const tickInterval = setInterval(() => {
      setLastUpdatedSec((prev) => prev + 1)
    }, 1000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      clearInterval(tickInterval)
    }
  }, [sessionId])

  if (isLoading) {
    return (
      <div className={styles.centerMessageCard}>
        <Radio size={36} style={{ color: '#2563eb', animation: 'spin 2s linear infinite' }} />
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
          Connecting to Live Safety Stream...
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          Establishing encrypted link to personnel telemetry and 500m risk grid.
        </p>
      </div>
    )
  }

  if (error || !telemetry) {
    return (
      <div className={styles.centerMessageCard}>
        <AlertTriangle size={36} style={{ color: '#dc2626' }} />
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
          {error || 'Session Concluded'}
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          This RESQ Mode safety session is either inactive, concluded, or the link is invalid.
        </p>
        <Link
          to="/"
          style={{
            marginTop: '10px',
            padding: '10px 18px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: '12px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          Open RESQ Main Map
        </Link>
      </div>
    )
  }

  const isEmergency = telemetry.isEmergency || telemetry.status === 'SOS'
  const isEnded = !telemetry.isActive || telemetry.status === 'ENDED'

  const score = telemetry.riskScore || 24.8
  const status = isEmergency ? 'CRITICAL' : telemetry.riskStatus || 'LOW'
  const staticVal = telemetry.staticRisk || 24.8
  const dynamicVal = isEmergency ? 100 : telemetry.dynamicRisk || 0
  const confidence = Math.round((telemetry.riskConfidence || 0.95) * 100)

  const radius = 34
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(score, 100) / 100) * circumference

  let gaugeColor = '#10b981'
  let badgeBg = '#f0fdf4'
  let badgeBorder = '#bbf7d0'
  let badgeColor = '#15803d'

  if (isEmergency || status === 'CRITICAL' || score >= 70) {
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

  const localityText = `${telemetry.district || 'Guwahati'}, ${telemetry.state || 'Assam'}`

  return (
    <div className={styles.trackContainer}>
      {/* Main Map Canvas */}
      <div className={styles.mapPane}>
        <div className={`${styles.floatingTopBar} ${isEmergency ? styles.floatingTopBarEmergency : ''}`}>
          <div className={styles.floatingLeft}>
            <div className={styles.personnelBadge}>
              <UserCheck size={16} style={{ color: '#2563eb' }} />
              <span>{telemetry.userName || 'Field Operator'}</span>
            </div>

            {isEmergency ? (
              <div className={styles.statusPillSos}>
                <span className={styles.sosDot} />
                <span>🚨 EMERGENCY SOS</span>
              </div>
            ) : isEnded ? (
              <div className={styles.statusPillEnded}>
                <span>SESSION ENDED</span>
              </div>
            ) : (
              <div className={styles.statusPillActive}>
                <span className={styles.activeDot} />
                <span>MONITORING ACTIVE</span>
              </div>
            )}
          </div>

          <div className={styles.floatingRight}>
            <span className={styles.lastUpdateText}>Updated {lastUpdatedSec}s ago</span>
          </div>
        </div>

        <MapSurface
          mode={MAP_MODES.NORMAL}
          selectedLocation={{
            lat: telemetry.lat,
            lon: telemetry.lon,
            accuracy: telemetry.accuracy,
            name: `${telemetry.userName} • ${localityText}`,
          }}
          selectedGridGeometry={geometry}
          selectedGridStatus={status}
        />
      </div>

      {/* Right Safety Telemetry Panel */}
      <div className={styles.telemetrySidePanel}>
        {/* Active Emergency Alert Banner */}
        {isEmergency && telemetry.emergency && (
          <div className={styles.emergencyAlertBanner}>
            <div className={styles.emergencyAlertHeader}>
              <div className={styles.emergencyAlertTitle}>
                <Siren size={18} />
                <span>ACTIVE SOS EMERGENCY</span>
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '6px' }}>
                CRITICAL
              </span>
            </div>
            <div className={styles.emergencyAlertDesc}>
              <strong>Type:</strong> {telemetry.emergency.emergencyType}
              {telemetry.emergency.notes && (
                <div style={{ marginTop: '4px' }}>
                  <strong>Notes:</strong> {telemetry.emergency.notes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Primary Dynamic Risk Index Gauge */}
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
        <div className={styles.infoCard}>
          <div>
            <div className={styles.infoLabel}>500m Risk Grid Cell</div>
            <div className={styles.infoValue}>{telemetry.gridId || 'AS_00210744'}</div>
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>{localityText}</div>
        </div>

        {/* Safety Timer Check-in Info */}
        <div className={styles.infoCard}>
          <div>
            <div className={styles.infoLabel}>Safety Timer Protocol</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={14} style={{ color: '#2563eb' }} />
              <span>{telemetry.safetyTimerMinutes} Min Check-in Interval</span>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
            {telemetry.isActive ? 'Active Protocol' : 'Concluded'}
          </span>
        </div>

        {/* Active Hazards Section */}
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

        {/* Link back to Main Map */}
        <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '38px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              color: '#334155',
              textDecoration: 'none',
              fontSize: '12.5px',
              fontWeight: 700,
            }}
          >
            <Shield size={14} />
            <span>Open RESQ Disaster Command Map</span>
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ResqTrackView
