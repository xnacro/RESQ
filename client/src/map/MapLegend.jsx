// Compact floating RESQ Risk Legend component with collapsible state for operational map awareness
import { useState } from 'react'
import { Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { RESQ_RISK_COLORS } from './resqCartographyTokens.js'
import styles from './MapLegend.module.css'

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(false)

  const items = [
    RESQ_RISK_COLORS.LOW,
    RESQ_RISK_COLORS.MODERATE,
    RESQ_RISK_COLORS.HIGH,
    RESQ_RISK_COLORS.CRITICAL,
  ]

  return (
    <div className={`${styles.legendContainer} ${collapsed ? styles.collapsed : ''}`} aria-label="Risk Level Map Legend">
      <button
        type="button"
        className={styles.headerBtn}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        title="Toggle risk index legend"
      >
        <Shield size={11} className={styles.headerIcon} />
        <span className={styles.title}>RISK INDEX</span>
        {collapsed ? <ChevronDown size={11} className={styles.toggleIcon} /> : <ChevronUp size={11} className={styles.toggleIcon} />}
      </button>

      {!collapsed && (
        <div className={styles.itemsRow}>
          {items.map((item) => (
            <div key={item.key} className={styles.legendItem} title={item.description}>
              <span className={styles.dot} style={{ background: item.color }} />
              <span className={styles.label}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MapLegend
