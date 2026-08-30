// Right Intelligence Panel for RESQ Disaster Risk Explainability
import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  ShieldAlert,
  AlertTriangle,
  Radio,
  ExternalLink,
  Info,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import {
  Badge,
  Button,
  MeterBar,
  Panel,
  PanelBody,
  PanelHeader,
  ScoreReadout,
  TabPanel,
  Tabs,
  KeyValueRow,
  Spinner,
} from '../ui/index.js'
import { getGridRiskBreakdown } from '../services/api.js'
import styles from './ContextPanel.module.css'

const TAB_ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'hazards', label: 'Hazard Analysis' },
  { value: 'evidence', label: 'Evidence & Sources' },
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
  const [error, setError] = useState(null)

  // Fetch full explainability breakdown when selectedGridId changes
  useEffect(() => {
    if (!selectedGridId) {
      setRiskData(null)
      return
    }

    let isCurrent = true
    setLoading(true)
    setError(null)

    getGridRiskBreakdown(selectedGridId)
      .then((data) => {
        if (!isCurrent) return
        setRiskData(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setError(err.message)
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

  const riskScore = riskData ? parseFloat(riskData.riskSummary.riskScore || 0) : null
  const riskStatus = riskData ? riskData.riskSummary.riskStatus : 'UNKNOWN'
  const dynamicRisk = riskData ? parseFloat(riskData.riskSummary.dynamicRisk || 0) : 0
  const staticRisk = riskData ? parseFloat(riskData.riskSummary.staticRisk || 0) : 0
  const confidence = riskData ? Math.round((riskData.riskSummary.riskConfidence || 0.95) * 100) : 95
  const activeEvents = riskData ? riskData.activeEvents || [] : []

  // Tone for badges & score
  let statusTone = 'neutral'
  if (riskStatus === 'CRITICAL') statusTone = 'critical'
  else if (riskStatus === 'HIGH') statusTone = 'high'
  else if (riskStatus === 'MODERATE') statusTone = 'moderate'
  else if (riskStatus === 'LOW') statusTone = 'low'

  const placeTitle = selectedLocation?.name || (riskData ? `Grid ${riskData.gridId}` : 'Disaster Intelligence')
  const placeSubtitle = selectedLocation?.district
    ? `${selectedLocation.district}, ${selectedLocation.state || 'Assam'}`
    : (riskData?.district ? `${riskData.district}, ${riskData.state}` : 'Search or select a place to begin')

  return (
    <aside className={styles.dock} aria-label="Disaster Intelligence Panel">
      <Panel className={styles.panel}>
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

        {/* Action Button: RESQ Mode */}
        <div className={styles.actionRow}>
          <Button
            variant="primary"
            icon={Navigation}
            block
            onClick={onOpenResqMode}
            className={styles.resqModeBtn}
          >
            Get Safe Relief Directions (RESQ Mode)
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsRow}>
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
        </div>

        {/* Panel Body */}
        <PanelBody scroll className={styles.body}>
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
                  {/* Primary Risk Card */}
                  <div className={`${styles.riskCard} ${styles[`riskCard_${riskStatus.toLowerCase()}`]}`}>
                    <div className={styles.riskCardHeader}>
                      <span className={styles.riskCardEyebrow}>CURRENT RISK</span>
                      <Badge tone={statusTone} size="md">
                        {riskStatus}
                      </Badge>
                    </div>

                    <div className={styles.scoreRow}>
                      <div className={styles.scoreNumber}>{riskScore}</div>
                      <div className={styles.scoreMax}>/ 100</div>
                    </div>

                    <div className={styles.meterWrapper}>
                      <MeterBar value={riskScore} max={100} tone={statusTone} />
                    </div>

                    <div className={styles.splitGrid}>
                      <div className={styles.splitBox}>
                        <span className={styles.splitLabel}>Static Baseline</span>
                        <span className={styles.splitVal}>{staticRisk}</span>
                      </div>
                      <div className={styles.splitBox}>
                        <span className={styles.splitLabel}>Dynamic Risk</span>
                        <span className={styles.splitVal}>{dynamicRisk}</span>
                      </div>
                    </div>
                  </div>

                  {/* Grid Metadata */}
                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Area & Cell Identifiers</h4>
                    <div className={styles.metaList}>
                      <KeyValueRow label="500m Grid ID" value={riskData.gridId} mono />
                      <KeyValueRow label="State / Region" value={riskData.state} />
                      <KeyValueRow label="District" value={riskData.district || 'Assam Valley'} />
                      <KeyValueRow
                        label="Center Coordinates"
                        value={`${riskData.center.lat.toFixed(4)}°N, ${riskData.center.lon.toFixed(4)}°E`}
                        mono
                      />
                      <KeyValueRow label="Confidence" value={`${confidence}% (Multi-Source)`} />
                    </div>
                  </div>

                  {/* Active Hazards Summary */}
                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Active Hazard Channels</h4>
                    <div className={styles.channelGrid}>
                      {parseFloat(riskData.dynamicFactorChannels.roadClosureRisk || 0) > 0 && (
                        <div className={`${styles.hazardTag} ${styles.hazardTagCritical}`}>
                          <ShieldAlert size={13} />
                          <span>Road / Bridge Blocked (+{riskData.dynamicFactorChannels.roadClosureRisk})</span>
                        </div>
                      )}
                      {parseFloat(riskData.dynamicFactorChannels.newsRisk || 0) > 0 && (
                        <div className={`${styles.hazardTag} ${styles.hazardTagHigh}`}>
                          <AlertTriangle size={13} />
                          <span>Verified Media Alert (+{riskData.dynamicFactorChannels.newsRisk})</span>
                        </div>
                      )}
                      {parseFloat(riskData.dynamicFactorChannels.nlpEventRisk || 0) > 0 && (
                        <div className={`${styles.hazardTag} ${styles.hazardTagMod}`}>
                          <Radio size={13} />
                          <span>NLP Structured Incident (+{riskData.dynamicFactorChannels.nlpEventRisk})</span>
                        </div>
                      )}
                      {dynamicRisk === 0 && (
                        <div className={styles.noHazardBox}>
                          <CheckCircle2 size={15} color="var(--risk-low)" />
                          <span>No active dynamic hazards detected in this 500m cell.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabPanel>

              {/* TAB 2: HAZARD ANALYSIS (EXPLAINABILITY) */}
              <TabPanel value="hazards" active={tab === 'hazards'}>
                <div className={styles.tabContent}>
                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Why Is This Area At Risk?</h4>
                    <p className={styles.sectionDesc}>
                      Dynamic risk aggregates real-time media, field road closures, and sensor evidence blended with long-term 500m static terrain baselines.
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
                          <Info size={15} color="var(--accent)" />
                          <span>Static terrain factors provide baseline risk. No active dynamic alerts.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Static Geographic Factors</h4>
                    <div className={styles.metaList}>
                      <KeyValueRow label="Mean Elevation" value={`${riskData.staticFactors.elevationMean} m`} mono />
                      <KeyValueRow label="Mean Slope" value={`${riskData.staticFactors.slopeMean}°`} mono />
                      <KeyValueRow label="Distance to River" value={`${(riskData.staticFactors.distanceToRiver / 1000).toFixed(1)} km`} mono />
                      <KeyValueRow label="Flood Susceptibility" value={riskData.staticFactors.floodSusceptibility} mono />
                      <KeyValueRow label="Seismic Risk Zone" value={riskData.staticFactors.seismicRisk} mono />
                    </div>
                  </div>
                </div>
              </TabPanel>

              {/* TAB 3: EVIDENCE & SOURCES */}
              <TabPanel value="evidence" active={tab === 'evidence'}>
                <div className={styles.tabContent}>
                  <div className={styles.section}>
                    <h4 className={styles.sectionHeading}>Verified Media & Bulletin Sources</h4>
                    <p className={styles.sectionDesc}>
                      Evidence links cross-referenced and corroborated across regional Northeast news feeds.
                    </p>

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
                              {new Date(ev.reported_at || Date.now()).toLocaleDateString()}
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
        </PanelBody>
      </Panel>
    </aside>
  )
}

export default ContextPanel
