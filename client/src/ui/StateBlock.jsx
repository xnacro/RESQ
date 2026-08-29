import { cx } from '../lib/cx.js'
import { Button } from './Button.jsx'
import styles from './StateBlock.module.css'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx(styles.block, className)}>
      {Icon && (
        <span className={styles.icon}>
          <Icon size={20} strokeWidth={1.5} />
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}

export function ErrorState({ icon: Icon, title = 'Could not load data', description, onRetry, className }) {
  return (
    <div className={cx(styles.block, styles.error, className)}>
      {Icon && (
        <span className={cx(styles.icon, styles.errorIcon)}>
          <Icon size={20} strokeWidth={1.5} />
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {onRetry && (
        <div className={styles.action}>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
