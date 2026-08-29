import { cx } from '../lib/cx.js'
import { BAND_META } from '../lib/riskBands.js'
import styles from './Badge.module.css'

export function Badge({ tone = 'neutral', size = 'md', icon: Icon, className, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[size], className)}>
      {Icon && <Icon size={12} strokeWidth={2} />}
      {children}
    </span>
  )
}

export function RiskBadge({ band, size = 'md', solid = false, showDot = true, className }) {
  const meta = BAND_META[band] || BAND_META.UNKNOWN
  return (
    <span
      data-risk={band}
      className={cx(styles.badge, styles.risk, solid && styles.riskSolid, styles[size], className)}
    >
      {showDot && !solid && <span className={styles.dot} />}
      {meta.label.toUpperCase()}
    </span>
  )
}
