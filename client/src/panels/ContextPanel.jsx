// Right Intelligence Panel for RESQ Disaster Risk Explainability
import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  ShieldAlert,
  Radio,
  ExternalLink,
  Info,
  Clock,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Flame,
} from 'lucide-react'
import {
  Button,
  MeterBar,
  TabPanel,
  Tabs,
  KeyValueRow,
  Spinner,
} from '../ui/index.js'
import { getGridRiskBreakdown } from '../services/api.js'
import styles from './ContextPanel.module.css'

const TAB_ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'hazards', label: 'AI Analysis' },
  { value: 'evidence', label: 'Intelligence' },
]

export function ContextPanel({
  selectedGridId = null,
  selectedLocation = null,
  onLocateMe,
  onSelectQuickPlace,
  onOpenResqMode,
}) {
  const [tab, setTab] = useState('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [riskData, setRiskData] = useState(null)

  // Fetch full explainability breakdown when selectedGridId changes
  useEffect(() => {
    if (!selectedGridId) {
      return
    }

    let isCurrent = true
    setLoading(true)
    getGridRiskBreakdown(selectedGridId)
      .then((data) => {
        if (!isCurrent) return
        setRiskData(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        console.error('Risk fetch error:', err.message)
        setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [selectedGridId])

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.reopen}
        onClick={() => setCollapsed(false)}
        aria-label="Show disaster intelligence panel"
      >
        <ChevronLeft size={16} strokeWidth={2} />
        <span className={styles.reopenLabel}>Intelligence</span>
      </button>
    )
  }

  const riskScore = riskData ? parseFloat(riskData.riskSummary.riskScore || 0) : 0
  const riskStatus = riskData ? riskData.riskSummary.riskStatus : 'LOW'
  const dynamicRisk = riskData ? parseFloat(riskData.riskSummary.dynamicRisk || 0) : 0
  const staticRisk = riskData ? parseFloat(riskData.riskSummary.staticRisk || 0) : 0
  const confidence = riskData ? Math.round((riskData.riskSummary.riskConfidence || 0.95) * 100) : 95
  const activeEvents = riskData ? riskData.activeEvents || [] : []

  // Tone for badges & score
  let statusTone = 'low'
  let gaugeColor = '#16a34a'
  if (riskStatus === 'CRITICAL') {
    statusTone = 'critical'
    gaugeColor = '#dc2626'
  } else if (riskStatus === 'HIGH') {
    statusTone = 'high'
    gaugeColor = '#ea580c'
  } else if (riskStatus === 'MODERATE') {
    statusTone = 'moderate'
    gaugeColor = '#d97706'
  }

  const placeTitle = selectedLocation?.name || (riskData ? `Grid ${riskData.gridId}` : 'Safety Intelligence')
  const placeSubtitle = selectedLocation?.district
    ? `${selectedLocation.district}, ${selectedLocation.state || 'Assam'}`
    : (riskData?.district ? `${riskData.district}, ${riskData.state}` : 'Search a place to begin')

  // Circular gauge circumference (r = 38)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(riskScore, 100) / 100) * circumference

  return (
    <aside className={styles.dock} aria-label="Disaster Intelligence Panel">
      <div className={styles.panelCard}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconCircle}>
              <MapPin size={18} className={styles.pinIcon} />
            </div>
            <div>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>{placeTitle}</h2>
                <div className={styles.liveIndicator}>
                  <span className={styles.liveDot} />
                  <span>LIVE</span>
                </div>
              </div>
              <p className={styles.subtitle}>{placeSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsed(true)}
            aria-label="Collapse panel"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Action Button: Get Directions */}
        <div className={styles.actionRow}>
          <Button
            variant="primary"
            icon={Navigation}
            block
            onClick={onOpenResqMode}
            className={styles.directionsBtn}
          >
            Get Directions
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsRow}>
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
        </div>

        {/* Panel Body */}
        <div className={styles.body}>
          {loading && (
            <div className={styles.emptyState}>
              <Spinner size={24} />
              <p className={styles.emptyText}>Loading disaster intelligence...</p>
            </div>
          )}

          {!loading && !riskData && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconCircle}>
                <Radio size={28} className={styles.emptyIcon} />
              </div>
              <h3 className={styles.emptyHeading}>Select a Location</h3>
              <p className={styles.emptyDescription}>
                Click any 500m risk cell on the map or search a location to inspect real-time risk scores, active flood/landslide hazards, and safe routing corridors.
              </p>
              <div className={styles.quickShortcuts}>
                <p className={styles.quickLabel}>Quick Demonstration Areas:</p>
                <div className={styles.quickGrid}>
                  <button type="button" className={styles.quickBtn} onClick={() => onSelectQuickPlace && onSelectQuickPlace('Guwahati')}>
                    Guwahati
                  </button>
                  <button type="button" className={styles.quickBtn} onClick={() => onSelectQuickPlace && onSelectQuickPlace('Boko')}>
                    Boko Bridge (NH-27)
                  </button>
                  <button type="button" className={styles.quickBtn} onClick={() => onSelectQuickPlace && onSelectQuickPlace('Shillong')}>
                    Shillong (Ri-Bhoi)
                  </button>
                  <button type="button" className={styles.quickBtn} onClick={onLocateMe}>
                    📍 My Location
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && riskData && (
            <>
              {/* TAB 1: OVERVIEW */}
              <TabPanel value="overview" active={tab === 'overview'}>
                <div className={styles.tabContent}>
                  {/* Suraksha-Style Circular Gauge Card */}
                  <div className={styles.gaugeCard}>
                    <div className={styles.gaugeCircleWrapper}>
                      <svg width="90" height="90" viewBox="0 0 90 90" className={styles.gaugeSvg}>
                        <circle
                          cx="45"
                          cy="45"
                          r={radius}
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="7"
                        />
                        <circle
                          cx="45"
                          cy="45"
                          r={radius}
                          fill="none"
                          stroke={gaugeColor}
                          strokeWidth="7"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90 45 45)"
                          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                      </svg>
                      <div className={styles.gaugeCenterText}>
                        <span className={styles.gaugeScore}>{riskScore}</span>
                        <span className={styles.gaugeMax}>/ 100</span>
                      </div>
                    </div>

                    <div className={styles.gaugeRight}>
                      <span className={styles.gaugeLabel}>DYNAMIC RISK INDEX</span>
                      <div className={styles.gaugeStatusRow}>
                        <span className={`${styles.gaugeStatusText} ${styles[`status_${statusTone}`]}`}>
                          {riskStatus}
                        </span>
                      </div>
                      <div className={styles.meterContainer}>
                        <MeterBar value={riskScore} max={100} tone={statusTone} />
                      </div>
                    </div>
                  </div>

                  {/* District / Area Info Section */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitleRow}>
                      <Building2 size={15} className={styles.sectionIcon} />
                      <h4 className={styles.sectionHeading}>DISTRICT INFO</h4>
                    </div>
                    <div className={styles.metaList}>
                      <KeyValueRow
                        label="RISK CATEGORY"
                        value={`${riskStatus === 'LOW' ? 'Low Risk' : riskStatus === 'CRITICAL' ? 'Critical Hazard' : 'Elevated Risk'}`}
                      />
                      <KeyValueRow
                        label="DYNAMIC RISK"
                        value={`${dynamicRisk > 0 ? dynamicRisk : '0%'}`}
                        mono
                      />
                      <KeyValueRow
                        label="STATIC BASELINE"
                        value={staticRisk}
                        mono
                      />
                      <KeyValueRow
                        label="CONFIDENCE AMPLIFIER"
                        value={`x${(confidence / 100 * 1.5).toFixed(1)} (${confidence}%)`}
                        mono
                      />
                    </div>
                  </div>

                  {/* Nearby Safety & Relief Resources */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitleRow}>
                      <ShieldCheck size={15} className={styles.sectionIcon} />
                      <h4 className={styles.sectionHeading}>NEARBY SAFETY RESOURCES</h4>
                    </div>
                    <p className={styles.sectionSubtitle}>Safety facilities around your current location</p>
                    <div className={styles.resourceList}>
                      <div className={styles.resourceCard}>
                        <div className={styles.resourceIconCircle}>
                          <ShieldAlert size={15} color="var(--accent)" />
                        </div>
                        <div className={styles.resourceInfo}>
                          <span className={styles.resourceName}>Area Police Station</span>
                          <span className={styles.resourceMeta}>Police Station · 925 m</span>
                        </div>
                        <button type="button" className={styles.directionsLink} onClick={onOpenResqMode}>
                          <span>Directions</span>
                          <span>→</span>
                        </button>
                      </div>

                      <div className={styles.resourceCard}>
                        <div className={styles.resourceIconCircle}>
                          <Flame size={15} color="var(--emergency)" />
                        </div>
                        <div className={styles.resourceInfo}>
                          <span className={styles.resourceName}>Emergency Fire & Rescue</span>
                          <span className={styles.resourceMeta}>Fire Station · 1.8 km</span>
                        </div>
                        <button type="button" className={styles.directionsLink} onClick={onOpenResqMode}>
                          <span>Directions</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>

              {/* TAB 2: AI ANALYSIS */}
              <TabPanel value="hazards" active={tab === 'hazards'}>
                <div className={styles.tabContent}>
                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Why Is This Area At Risk?</h4>
                    <p className={styles.sectionDesc}>
                      Dynamic risk aggregates real-time media, field road closures, and sensor evidence blended with 500m static terrain baselines.
                    </p>

                    <div className={styles.factorStack}>
                      {activeEvents.map((ev, idx) => (
                        <div key={idx} className={styles.factorCard}>
                          <div className={styles.factorHeader}>
                            <span className={styles.factorType}>
                              {ev.bridge_closed ? 'BRIDGE CLOSURE' : (ev.event_type || 'HAZARD REPORT')}
                            </span>
                            <span className={styles.factorImpact}>+{ev.impact_score}</span>
                          </div>
                          <p className={styles.factorTitle}>{ev.news_title || ev.location_text}</p>
                          <div className={styles.factorMeta}>
                            <span>Severity: {ev.severity}/100</span>
                            <span>•</span>
                            <span>Confidence: {Math.round((ev.confidence || 0.9) * 100)}%</span>
                          </div>
                        </div>
                      ))}

                      {activeEvents.length === 0 && (
                        <div className={styles.noHazardBox}>
                          <CheckCircle2 size={15} color="var(--risk-low)" />
                          <span>No active dynamic hazards detected in this 500m cell.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabPanel>

              {/* TAB 3: INTELLIGENCE */}
              <TabPanel value="evidence" active={tab === 'evidence'}>
                <div className={styles.tabContent}>
                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Verified Media & Bulletins</h4>
                    <div className={styles.evidenceList}>
                      {activeEvents.map((ev, idx) => (
                        <div key={idx} className={styles.evidenceCard}>
                          <div className={styles.evidenceSourceRow}>
                            <span className={styles.evidenceSource}>{ev.source_name || 'Regional News Desk'}</span>
                            <span className={styles.evidenceTier}>Tier {ev.reliability_tier || 2} Verified</span>
                          </div>
                          <p className={styles.evidenceTitle}>{ev.news_title}</p>
                          <div className={styles.evidenceFooter}>
                            <span className={styles.evidenceTime}>
                              <Clock size={11} />
                              {ev.reported_at ? new Date(ev.reported_at).toLocaleDateString() : 'Recent'}
                            </span>
                            {ev.news_url && (
                              <a
                                href={ev.news_url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.evidenceLink}
                              >
                                <span>Read Bulletin</span>
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}

                      {activeEvents.length === 0 && (
                        <div className={styles.noHazardBox}>
                          <Info size={15} />
                          <span>No media bulletins linked to this specific cell.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabPanel>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default ContextPanel
