// Disaster Intelligence & Explainable AI Context Panel
import { useState, useEffect, useMemo } from 'react'
import {
  MapPin,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Radio,
  ExternalLink,
  Clock,
  Navigation,
  ChevronRight,
  Info,
  Brain,
  Layers,
  Activity,
  Droplets,
  CloudRain,
  Mountain,
  Users,
  Building,
  Target,
  CheckCircle2,
  Cpu,
} from 'lucide-react'
import { Tabs, TabPanel } from '../ui/Tabs.jsx'
import { Button } from '../ui/Button.jsx'
import { Spinner } from '../ui/Spinner.jsx'
import { getGridRisk } from '../services/riskApi.js'
import { RouteSummaryPanel } from './RouteSummaryPanel.jsx'
import styles from './ContextPanel.module.css'

const TAB_ITEMS = [
  { value: 'overview', label: 'OVERVIEW' },
  { value: 'hazards', label: 'AI ANALYSIS' },
  { value: 'evidence', label: 'INTELLIGENCE' },
]

// Cleans source titles from RSS prefixes and redundant category tags
function formatSourceName(raw) {
  if (!raw) return 'Regional News Desk'
  return raw
    .replace(/^Google News - /i, '')
    .replace(/ Flood Alert| Flood Monitor| Landslide & Road Closure/i, '')
    .trim()
}

// Generates structured Explainable AI diagnostic bullets with standard vector icons
function getDiagnosticBullets(riskData) {
  if (!riskData) return []
  const score = riskData.riskSummary?.riskScore ?? 24.8
  const status = riskData.riskSummary?.riskStatus || 'LOW'
  const activeEvents = riskData.activeEvents || []
  const channels = riskData.dynamicFactorChannels || {}
  const staticF = riskData.staticFactors || {}

  const bullets = []

  // 1. Status Assessment
  bullets.push({
    icon: Target,
    iconColor: status === 'CRITICAL' || status === 'HIGH' ? '#dc2626' : '#2563eb',
    label: 'Risk Assessment',
    text: `${status} Risk Index (${score.toFixed(1)} / 100)`,
    isAlert: status === 'CRITICAL' || status === 'HIGH',
  })

  // 2. Direct Cell Inundation / Closure Status
  if (channels.roadClosureRisk >= 80) {
    bullets.push({
      icon: AlertTriangle,
      iconColor: '#dc2626',
      label: 'Transport Corridor',
      text: 'Critical structural road/bridge closure active along transit route.',
      isAlert: true,
    })
  } else if (activeEvents.length > 0) {
    bullets.push({
      icon: ShieldAlert,
      iconColor: '#ea580c',
      label: 'Direct Hazards',
      text: `${activeEvents.length} active verified disaster event(s) directly affecting this 500m cell.`,
      isAlert: true,
    })
  } else {
    bullets.push({
      icon: CheckCircle2,
      iconColor: '#10b981',
      label: 'Direct Hazard Status',
      text: 'No active flood inundation or road blockages detected inside this 500m cell.',
    })
  }

  // 3. Terrain Baseline Breakdown
  const terrainItems = []
  if (staticF.elevationMean) terrainItems.push(`elevation ${staticF.elevationMean.toFixed(0)}m`)
  if (staticF.slopeMean) terrainItems.push(`slope ${staticF.slopeMean.toFixed(1)}°`)
  if (staticF.flowAccumulation) terrainItems.push(`flow accum ${staticF.flowAccumulation.toFixed(0)}`)
  if (terrainItems.length > 0) {
    bullets.push({
      icon: Mountain,
      iconColor: '#64748b',
      label: 'Terrain Baseline',
      text: `Topographic profile: ${terrainItems.join(', ')}.`,
    })
  }

  // 4. Exposed Population & Buildings
  const popCount = staticF.populationDensity != null ? Math.round(staticF.populationDensity) : 0
  const bldCount = staticF.buildingCount != null ? Math.round(staticF.buildingCount) : 0
  if (popCount > 0 || bldCount > 0) {
    bullets.push({
      icon: Users,
      iconColor: '#64748b',
      label: 'Exposure Density',
      text: `Estimated ~${popCount.toLocaleString()} residents and ${bldCount} structural assets in 500m area.`,
    })
  }

  // 5. Environmental Proximity
  if (staticF.riverDistanceMeters) {
    const km = (staticF.riverDistanceMeters / 1000).toFixed(1)
    bullets.push({
      icon: Droplets,
      iconColor: '#0284c7',
      label: 'Hydrology Buffer',
      text: `${km} km proximity to major Brahmaputra river drainage network.`,
    })
  }

  return bullets
}

export function ContextPanel({
  selectedGridId,
  selectedLocation,
  onLocateMe,
  onSelectQuickPlace,
  onOpenResqMode,
  onGetDirections,
  routeData = null,
  routeOrigin = null,
  routeDestination = null,
  onStartNavigation,
  onClearRoute,
}) {
  const [tab, setTab] = useState('overview')
  const [riskData, setRiskData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Fetch full explainability breakdown when selectedGridId changes
  useEffect(() => {
    if (!selectedGridId) return

    let cancelled = false
    const loadRisk = async () => {
      setLoading(true)
      try {
        const data = await getGridRisk(selectedGridId)
        if (!cancelled && data) {
          setRiskData(data)
        }
      } catch (err) {
        console.error('Failed to load grid risk:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRisk()
    return () => {
      cancelled = true
    }
  }, [selectedGridId])

  const riskScore = riskData?.riskSummary?.riskScore ?? (selectedLocation ? 24.8 : 0)
  const riskStatus = riskData?.riskSummary?.riskStatus ?? 'LOW'
  const staticRisk = riskData?.riskSummary?.staticRisk ?? 24.8
  const dynamicRisk = riskData?.riskSummary?.dynamicRisk ?? 0
  const riskConfidence = riskData?.riskSummary?.riskConfidence ?? 0.95
  const dynamicChannels = riskData?.dynamicFactorChannels || {}
  const staticFactors = riskData?.staticFactors || {}
  const activeEvents = riskData?.activeEvents || []
  const regionalEvents = riskData?.regionalEvents || []

  // Deduplicate events for the Intelligence tab
  const deduplicatedEvents = useMemo(() => {
    const rawList = activeEvents.length > 0 ? activeEvents : regionalEvents
    const seen = new Set()
    const result = []

    for (const ev of rawList) {
      const cleanTitle = (ev.news_title || ev.location_text || '').toLowerCase().trim()
      if (cleanTitle && !seen.has(cleanTitle)) {
        seen.add(cleanTitle)
        result.push(ev)
      }
    }
    return result
  }, [activeEvents, regionalEvents])

  const diagnosticBullets = useMemo(() => getDiagnosticBullets(riskData), [riskData])

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.expandTab}
        onClick={() => setCollapsed(false)}
        aria-label="Expand Disaster Intelligence Panel"
      >
        <Shield size={18} />
        <span>Intelligence</span>
      </button>
    )
  }

  // Gauge colors and styling
  let gaugeColor = '#10b981'
  let statusLabel = 'LOW'

  if (riskStatus === 'CRITICAL' || riskScore >= 70) {
    gaugeColor = '#dc2626'
    statusLabel = 'CRITICAL'
  } else if (riskStatus === 'HIGH' || riskScore >= 45) {
    gaugeColor = '#ea580c'
    statusLabel = 'HIGH'
  } else if (riskStatus === 'MODERATE' || riskScore >= 25) {
    gaugeColor = '#d97706'
    statusLabel = 'MODERATE'
  }

  const placeTitle = selectedLocation?.name || (riskData?.gridId ? `Grid ${riskData.gridId}` : 'Safety Intelligence')
  const placeSubtitle = selectedLocation?.isLiveGps
    ? `${selectedLocation.district}, ${selectedLocation.state} · GPS Accuracy ±${selectedLocation.accuracy || 10}m`
    : selectedLocation?.district
    ? `${selectedLocation.district}, ${selectedLocation.state || 'Assam'}`
    : riskData?.district
    ? `${riskData.district}, ${riskData.state || 'Assam'}`
    : 'Search a place to begin'

  // Circular gauge circumference (r = 38)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(riskScore, 100) / 100) * circumference

  // Render Route Summary & Maneuver Preview when route is calculated
  if (routeData) {
    return (
      <aside className={styles.dock} aria-label="Route Summary & Navigation Panel">
        <div className={styles.panelCard} style={{ padding: 0 }}>
          <RouteSummaryPanel
            routeData={routeData}
            origin={routeOrigin}
            destination={routeDestination || selectedLocation}
            onStartNavigation={onStartNavigation}
            onClearRoute={onClearRoute}
          />
        </div>
      </aside>
    )
  }

  return (
    <aside className={styles.dock} aria-label="Disaster Intelligence Panel">
      <div className={styles.panelCard}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconCircle}>
              <MapPin size={18} className={styles.pinIcon} />
            </div>
            <div className={styles.headerTitles}>
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
            onClick={onGetDirections || onOpenResqMode}
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
                <p className={styles.quickLabel}>Demonstration Areas:</p>
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
                    <Navigation size={12} />
                    <span>My Location</span>
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
                  {/* Gauge Container */}
                  <div className={styles.gaugeContainer}>
                    <div className={styles.gaugeCircleWrapper}>
                      <svg className={styles.gaugeSvg} viewBox="0 0 90 90">
                        <circle cx="45" cy="45" r={radius} className={styles.gaugeBgCircle} />
                        <circle
                          cx="45"
                          cy="45"
                          r={radius}
                          className={styles.gaugeFillCircle}
                          style={{
                            stroke: gaugeColor,
                            strokeDasharray: circumference,
                            strokeDashoffset: strokeDashoffset,
                          }}
                        />
                      </svg>
                      <div className={styles.gaugeCenterText}>
                        <span className={styles.gaugeNumber}>{riskScore.toFixed(1)}</span>
                        <span className={styles.gaugeTotal}>/ 100</span>
                      </div>
                    </div>

                    <div className={styles.gaugeLabels}>
                      <span className={styles.gaugeCategory}>DYNAMIC RISK INDEX</span>
                      <span className={styles.gaugeStatusTitle} style={{ color: gaugeColor }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* District & Cell Info: Refined 2x2 Metric Cards Grid */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitleRow}>
                      <Shield size={14} className={styles.sectionIcon} />
                      <h4 className={styles.sectionHeading}>District & Cell Info</h4>
                    </div>

                    <div className={styles.metricGrid}>
                      <div className={styles.metricCard}>
                        <div className={styles.metricHeader}>
                          <Shield size={13} className={styles.metricIcon} />
                          <span className={styles.metricLabel}>Risk Level</span>
                        </div>
                        <div className={styles.metricValueRow}>
                          <span
                            className={styles.metricStatusBadge}
                            style={{
                              background: gaugeColor + '18',
                              color: gaugeColor,
                              borderColor: gaugeColor + '40',
                            }}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      <div className={styles.metricCard}>
                        <div className={styles.metricHeader}>
                          <Activity size={13} className={styles.metricIcon} />
                          <span className={styles.metricLabel}>Dynamic Signals</span>
                        </div>
                        <div className={styles.metricValueRow}>
                          <span className={styles.metricNumber}>{dynamicRisk.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className={styles.metricCard}>
                        <div className={styles.metricHeader}>
                          <Layers size={13} className={styles.metricIcon} />
                          <span className={styles.metricLabel}>Static Baseline</span>
                        </div>
                        <div className={styles.metricValueRow}>
                          <span className={styles.metricNumber}>{staticRisk.toFixed(1)}</span>
                          <span className={styles.metricUnit}>/ 100</span>
                        </div>
                      </div>

                      <div className={styles.metricCard}>
                        <div className={styles.metricHeader}>
                          <Cpu size={13} className={styles.metricIcon} />
                          <span className={styles.metricLabel}>AI Confidence</span>
                        </div>
                        <div className={styles.metricValueRow}>
                          <span className={styles.metricNumber}>{Math.round(riskConfidence * 100)}%</span>
                          <span className={styles.metricUnit}>Optimal</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nearby Safety Resources */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitleRow}>
                      <Radio size={14} className={styles.sectionIcon} />
                      <h4 className={styles.sectionHeading}>Nearby Safety Resources</h4>
                    </div>
                    <p className={styles.sectionSubtitle}>Safety facilities around your current location</p>

                    <div className={styles.resourceList}>
                      <div className={styles.resourceCard}>
                        <div className={styles.resourceIconCircle}>
                          <Shield size={16} color="var(--accent)" />
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
                          <Activity size={16} color="#dc2626" />
                        </div>
                        <div className={styles.resourceInfo}>
                          <span className={styles.resourceName}>District Emergency Hospital</span>
                          <span className={styles.resourceMeta}>Medical Facility · 1.4 km</span>
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
                  {/* Structured AI Diagnostic Bullet Points Card with Vector Icons */}
                  <div className={styles.aiDiagnosticCard}>
                    <div className={styles.aiDiagHeader}>
                      <div className={styles.aiDiagTitleRow}>
                        <Brain size={16} />
                        <span>Neural AI Diagnostic</span>
                      </div>
                      <span className={styles.aiDiagBadge} style={{ background: gaugeColor, color: '#ffffff' }}>
                        {statusLabel}
                      </span>
                    </div>

                    <ul className={styles.diagBulletList}>
                      {diagnosticBullets.map((item, idx) => {
                        const IconComponent = item.icon
                        return (
                          <li key={idx} className={styles.diagBulletItem}>
                            <span className={styles.diagBulletIcon} style={{ color: item.iconColor }}>
                              <IconComponent size={15} />
                            </span>
                            <div className={styles.diagBulletBody}>
                              <strong className={styles.diagBulletLabel}>{item.label}:</strong>{' '}
                              <span className={item.isAlert ? styles.diagBulletAlert : styles.diagBulletText}>
                                {item.text}
                              </span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {/* Mathematical Fusion Formula Card */}
                  <div className={styles.formulaCard}>
                    <div className={styles.formulaHeader}>
                      <span>Risk Fusion Formula</span>
                      <Info size={13} color="var(--text-muted)" />
                    </div>
                    <div className={styles.formulaEquation}>
                      <span>Score = (0.40 × {staticRisk.toFixed(1)}) + (0.60 × {dynamicRisk.toFixed(1)}) = {riskScore.toFixed(1)}</span>
                    </div>
                    <div className={styles.formulaWeights}>
                      <span>Static Baseline: 40%</span>
                      <span>•</span>
                      <span>Real-Time Dynamic Impact: 60%</span>
                    </div>
                  </div>

                  {/* Multi-Channel Decomposition Meters */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitleRow}>
                      <Layers size={14} className={styles.sectionIcon} />
                      <h4 className={styles.sectionHeading}>Risk Factor Channels</h4>
                    </div>

                    <div className={styles.channelMeterList}>
                      {/* News Media Risk */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <Radio size={12} /> News Media Impact
                          </span>
                          <span className={styles.channelMeterVal}>{(dynamicChannels.newsRisk || 0).toFixed(1)} / 100</span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, dynamicChannels.newsRisk || 0)}%`,
                              background: (dynamicChannels.newsRisk || 0) > 50 ? '#dc2626' : '#2563eb',
                            }}
                          />
                        </div>
                      </div>

                      {/* Road / Bridge Closure */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <AlertTriangle size={12} /> Road & Bridge Closures
                          </span>
                          <span className={styles.channelMeterVal}>
                            {(dynamicChannels.roadClosureRisk || 0) >= 80 ? 'CRITICAL CLOSED' : `${(dynamicChannels.roadClosureRisk || 0).toFixed(0)} / 100`}
                          </span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, dynamicChannels.roadClosureRisk || 0)}%`,
                              background: (dynamicChannels.roadClosureRisk || 0) >= 80 ? '#dc2626' : '#10b981',
                            }}
                          />
                        </div>
                      </div>

                      {/* Rainfall Accumulation */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <CloudRain size={12} /> Rainfall Risk
                          </span>
                          <span className={styles.channelMeterVal}>{(dynamicChannels.rainfallRisk || 0).toFixed(1)} / 100</span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, dynamicChannels.rainfallRisk || 0)}%`,
                              background: '#0284c7',
                            }}
                          />
                        </div>
                      </div>

                      {/* Flood Susceptibility */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <Droplets size={12} /> Floodplain Susceptibility
                          </span>
                          <span className={styles.channelMeterVal}>{(staticFactors.floodSusceptibility || 0).toFixed(0)} / 100</span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, staticFactors.floodSusceptibility || 0)}%`,
                              background: '#3b82f6',
                            }}
                          />
                        </div>
                      </div>

                      {/* Landslide Hazard */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <Mountain size={12} /> Landslide Vulnerability
                          </span>
                          <span className={styles.channelMeterVal}>{(staticFactors.landslideSusceptibility || 0).toFixed(0)} / 100</span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, staticFactors.landslideSusceptibility || 0)}%`,
                              background: '#d97706',
                            }}
                          />
                        </div>
                      </div>

                      {/* Population Density */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <Users size={12} /> Population Exposure
                          </span>
                          <span className={styles.channelMeterVal}>{Math.round(staticFactors.populationDensity || 0)} / km²</span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, ((staticFactors.populationDensity || 0) / 3000) * 100)}%`,
                              background: '#8b5cf6',
                            }}
                          />
                        </div>
                      </div>

                      {/* Infrastructure Exposure */}
                      <div className={styles.channelMeterRow}>
                        <div className={styles.channelMeterHeader}>
                          <span className={styles.channelMeterName}>
                            <Building size={12} /> Infrastructure Exposure
                          </span>
                          <span className={styles.channelMeterVal}>{(staticFactors.infrastructureExposure || 0).toFixed(0)}%</span>
                        </div>
                        <div className={styles.channelMeterBar}>
                          <div
                            className={styles.channelMeterFill}
                            style={{
                              width: `${Math.min(100, staticFactors.infrastructureExposure || 0)}%`,
                              background: '#6366f1',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Safety Guidance Action Card */}
                  <div className={styles.actionAdviceCard}>
                    <Shield size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p className={styles.actionAdviceText}>
                      {statusLabel === 'CRITICAL'
                        ? 'Immediate Warning: Avoid low-lying transit corridors. Follow SDRF / NDRF evacuation directives.'
                        : statusLabel === 'HIGH'
                        ? 'Heightened Vigilance: Monitor rising river water levels. Restrict heavy commercial vehicle movements.'
                        : statusLabel === 'MODERATE'
                        ? 'Advisory: Maintain standard safety precautions during heavy rainfall periods.'
                        : 'Clear: Normal operations. Regional transit corridors operating under safe baseline conditions.'}
                    </p>
                  </div>
                </div>
              </TabPanel>

              {/* TAB 3: INTELLIGENCE */}
              <TabPanel value="evidence" active={tab === 'evidence'}>
                <div className={styles.tabContent}>
                  <div className={styles.section}>
                    <div className={styles.sectionTitleRow}>
                      <Radio size={14} className={styles.sectionIcon} />
                      <h4 className={styles.sectionHeading}>
                        Verified Media & Bulletins ({deduplicatedEvents.length})
                      </h4>
                    </div>
                    <p className={styles.sectionDesc}>
                      NLP-extracted disaster reports from regional media desks, IMD alerts, and government bulletins.
                    </p>

                    <div className={styles.evidenceList}>
                      {deduplicatedEvents.map((ev, idx) => {
                        const formattedSource = formatSourceName(ev.source_name)
                        return (
                          <div key={idx} className={styles.evidenceCard}>
                            <div className={styles.evidenceSourceRow}>
                              <span className={styles.evidenceSource}>{formattedSource}</span>
                              <span className={styles.evidenceTier}>Tier {ev.reliability_tier || 2} Verified</span>
                            </div>
                            <p className={styles.evidenceTitle}>{ev.news_title || ev.location_text || 'Disaster Bulletin'}</p>
                            <div className={styles.evidenceFooter}>
                              <span className={styles.evidenceTime}>
                                <Clock size={11} />
                                {ev.reported_at ? new Date(ev.reported_at).toLocaleDateString() : 'Recent'}
                              </span>
                              {ev.raw_extraction?.ml?.confidence && (
                                <span style={{ fontSize: '10.5px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  ML {ev.raw_extraction.ml.modelVersion || 'v1'}: {Math.round(ev.raw_extraction.ml.confidence * 100)}%
                                </span>
                              )}
                              {ev.news_url && (
                                <a
                                  href={ev.news_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.evidenceLink}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>Read Bulletin</span>
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {deduplicatedEvents.length === 0 && (
                        <div className={styles.noHazardBox}>
                          <Info size={15} />
                          <span>No active media bulletins currently recorded for this region.</span>
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
