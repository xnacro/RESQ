import { cx } from '../lib/cx.js'
import styles from './Divider.module.css'

export function Divider({ vertical = false, className }) {
  return <span role="separator" className={cx(vertical ? styles.vertical : styles.horizontal, className)} />
}
