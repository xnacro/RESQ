import { cx } from '../lib/cx.js'
import { scoreToBand } from '../lib/riskBands.js'
import styles from './MeterBar.module.css'

export function MeterBar({ value, band, max = 100, showTicks = false, className }) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? Math.min(max, Math.max(0, value)) : 0
  const resolved = band || scoreToBand(value)
  const percent = (safe / max) * 100

  return (
    <div
      data-risk={resolved}
      className={cx(styles.track, className)}
      role="meter"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <span className={styles.fill} style={{ width: `${percent}%` }} />
      {showTicks && (
        <span className={styles.ticks} aria-hidden="true">
          <span style={{ left: '30%' }} />
          <span style={{ left: '55%' }} />
          <span style={{ left: '80%' }} />
        </span>
      )}
    </div>
  )
}
