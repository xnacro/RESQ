// Mobile Expandable Bottom Sheet for Map-First Disaster Intelligence
import { useState } from 'react'
import { ChevronUp, ChevronDown, Navigation, ShieldAlert } from 'lucide-react'
import { Badge, Button, MeterBar } from '../ui/index.js'
import styles from './MobileBottomSheet.module.css'

export function MobileBottomSheet({
  riskData = null,
  selectedLocation = null,
  onOpenResqMode,
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!riskData && !selectedLocation) return null

  const riskScore = riskData ? parseFloat(riskData.riskSummary.riskScore || 0) : null
  const riskStatus = riskData ? riskData.riskSummary.riskStatus : 'LOW'
  const placeTitle = selectedLocation?.name || (riskData ? `Grid ${riskData.gridId}` : 'Selected Area')
  const placeDistrict = selectedLocation?.district || riskData?.district || 'Assam / Meghalaya'

  let statusTone = 'neutral'
  if (riskStatus === 'CRITICAL') statusTone = 'critical'
  else if (riskStatus === 'HIGH') statusTone = 'high'
  else if (riskStatus === 'MODERATE') statusTone = 'moderate'
  else if (riskStatus === 'LOW') statusTone = 'low'

  return (
    <div className={`${styles.sheet} ${isExpanded ? styles.sheetExpanded : styles.sheetCollapsed}`}>
      {/* Drag handle & Header */}
      <div className={styles.handleBar} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.handlePill} />
      </div>

      <div className={styles.peekHeader} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.peekLeft}>
          <div className={styles.locationTitle}>{placeTitle}</div>
          <div className={styles.locationMeta}>{placeDistrict}</div>
        </div>

        {riskScore !== null && (
          <div className={styles.peekRight}>
            <div className={styles.peekScore}>{riskScore}</div>
            <Badge tone={statusTone} size="sm">
              {riskStatus}
            </Badge>
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && riskData && (
        <div className={styles.expandedBody}>
          <div className={styles.meterContainer}>
            <MeterBar value={riskScore} max={100} tone={statusTone} />
          </div>

          <div className={styles.splitRow}>
            <div className={styles.splitItem}>
              <span className={styles.splitLabel}>Static Baseline</span>
              <span className={styles.splitVal}>{riskData.riskSummary.staticRisk}</span>
            </div>
            <div className={styles.splitItem}>
              <span className={styles.splitLabel}>Dynamic Risk</span>
              <span className={styles.splitVal}>{riskData.riskSummary.dynamicRisk}</span>
            </div>
          </div>

          {/* Active Hazards */}
          {parseFloat(riskData.dynamicFactorChannels.roadClosureRisk || 0) > 0 && (
            <div className={styles.hazardAlert}>
              <ShieldAlert size={15} color="var(--emergency)" />
              <span>Critical Road / Bridge Blockage Detected (+{riskData.dynamicFactorChannels.roadClosureRisk})</span>
            </div>
          )}

          <Button
            variant="primary"
            icon={Navigation}
            block
            onClick={onOpenResqMode}
            className={styles.dispatchBtn}
          >
            Enter RESQ Mode (Relief Routing)
          </Button>
        </div>
      )}
    </div>
  )
}

export default MobileBottomSheet
