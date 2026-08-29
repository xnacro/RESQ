import { cx } from '../lib/cx.js'
import { BAND_META, scoreToBand } from '../lib/riskBands.js'
import { formatScore } from '../lib/format.js'
import styles from './ScoreReadout.module.css'

export function ScoreReadout({ score, band, label, caption, size = 'lg', className }) {
  const resolved = band || scoreToBand(score)
  const meta = BAND_META[resolved] || BAND_META.UNKNOWN

  return (
    <div data-risk={resolved} className={cx(styles.readout, styles[size], className)}>
      {label && <span className="label">{label}</span>}
      <div className={styles.valueRow}>
        <span className={cx(styles.score, 'mono')}>{formatScore(score)}</span>
        <span className={cx(styles.denominator, 'mono')}>/100</span>
      </div>
      <div className={styles.bandRow}>
        <span className={styles.bandBar} />
        <span className={styles.band}>{meta.label.toUpperCase()}</span>
      </div>
      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  )
}
