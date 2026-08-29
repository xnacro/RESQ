import { cx } from '../lib/cx.js'
import styles from './Panel.module.css'

export function Panel({ as: Tag = 'section', flush = false, className, children, ...rest }) {
  return (
    <Tag className={cx(styles.panel, flush && styles.flush, className)} {...rest}>
      {children}
    </Tag>
  )
}

export function PanelHeader({ eyebrow, title, meta, actions, className, children }) {
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.headingGroup}>
        {eyebrow && <span className="label">{eyebrow}</span>}
        {title && <h2 className={styles.title}>{title}</h2>}
        {meta && <p className={styles.meta}>{meta}</p>}
        {children}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}

export function PanelBody({ scroll = false, className, children }) {
  return <div className={cx(styles.body, scroll && styles.scroll, className)}>{children}</div>
}

export function PanelSection({ label, actions, className, children }) {
  return (
    <section className={cx(styles.section, className)}>
      {(label || actions) && (
        <div className={styles.sectionHead}>
          {label && <span className="label">{label}</span>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function PanelFooter({ className, children }) {
  return <footer className={cx(styles.footer, className)}>{children}</footer>
}
