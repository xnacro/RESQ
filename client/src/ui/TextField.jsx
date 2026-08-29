import { useId } from 'react'
import { cx } from '../lib/cx.js'
import styles from './TextField.module.css'

export function TextField({
  label,
  hint,
  icon: Icon,
  trailing,
  accentDot,
  invalid = false,
  className,
  controlClassName,
  id,
  ...rest
}) {
  const generatedId = useId()
  const fieldId = id || generatedId

  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label htmlFor={fieldId} className="label">
          {label}
        </label>
      )}
      <div className={cx(styles.control, invalid && styles.invalid, controlClassName)}>
        {accentDot && <span className={styles.dot} style={{ background: accentDot }} />}
        {Icon && <Icon size={15} strokeWidth={1.75} className={styles.icon} />}
        <input id={fieldId} className={styles.input} aria-invalid={invalid || undefined} {...rest} />
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {hint && <p className={cx(styles.hint, invalid && styles.hintInvalid)}>{hint}</p>}
    </div>
  )
}
