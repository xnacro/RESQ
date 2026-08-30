// Compact floating RESQ Risk Legend component for operational map awareness
import { Shield } from 'lucide-react'
import { RESQ_RISK_COLORS } from './resqCartographyTokens.js'
import styles from './MapLegend.module.css'

export function MapLegend() {
  const items = [
    RESQ_RISK_COLORS.LOW,
    RESQ_RISK_COLORS.MODERATE,
    RESQ_RISK_COLORS.HIGH,
    RESQ_RISK_COLORS.CRITICAL,
  ]

  return (
    <div className={styles.legendContainer} aria-label="Risk Level Map Legend">
      <div className={styles.header}>
        <Shield size={11} className={styles.headerIcon} />
        <span className={styles.title}>RISK INDEX</span>
      </div>

      <div className={styles.itemsRow}>
        {items.map((item) => (
          <div key={item.key} className={styles.legendItem} title={item.description}>
            <span className={styles.dot} style={{ background: item.color }} />
            <span className={styles.label}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MapLegend
