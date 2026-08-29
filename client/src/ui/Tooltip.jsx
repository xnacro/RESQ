import { useState } from 'react'
import { cx } from '../lib/cx.js'
import styles from './Tooltip.module.css'

export function Tooltip({ content, placement = 'top', className, children }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={cx(styles.wrap, className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && content && (
        <span role="tooltip" className={cx(styles.bubble, styles[placement])}>
          {content}
        </span>
      )}
    </span>
  )
}
