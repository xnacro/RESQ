import { cx } from '../lib/cx.js'
import styles from './Tabs.module.css'

export function Tabs({ items, value, onChange, ariaLabel = 'Panel sections', className }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx(styles.tabs, className)}>
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.tab, selected && styles.selected)}
            onClick={() => onChange(item.value)}
          >
            {item.icon && <item.icon size={14} strokeWidth={1.75} />}
            {item.label}
            {item.badge != null && <span className={styles.badge}>{item.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ value, active, children, className }) {
  if (!active) return null
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cx(styles.panel, className)}
    >
      {children}
    </div>
  )
}
