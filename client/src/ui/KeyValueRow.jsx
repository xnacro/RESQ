import { cx } from '../lib/cx.js'
import styles from './KeyValueRow.module.css'

export function KeyValueRow({ label, value, mono = true, tone = 'default', className, children }) {
  return (
    <div className={cx(styles.row, className)}>
      <span className={styles.key}>{label}</span>
      {children || <span className={cx(styles.value, mono && 'mono', styles[tone])}>{value}</span>}
    </div>
  )
}
