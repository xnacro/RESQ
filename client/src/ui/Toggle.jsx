import { useId } from 'react'
import { cx } from '../lib/cx.js'
import styles from './Toggle.module.css'

export function Toggle({ checked, onChange, label, description, swatch, disabled, className, id }) {
  const generatedId = useId()
  const toggleId = id || generatedId

  return (
    <div className={cx(styles.row, disabled && styles.disabled, className)}>
      {swatch && <span className={styles.swatch} style={{ background: swatch }} />}
      <label htmlFor={toggleId} className={styles.labelGroup}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </label>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(styles.track, checked && styles.on)}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  )
}
