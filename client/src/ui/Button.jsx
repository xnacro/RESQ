import { cx } from '../lib/cx.js'
import { Spinner } from './Spinner.jsx'
import styles from './Button.module.css'

export function Button({
  as: Tag = 'button',
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}) {
  const isNativeButton = Tag === 'button'

  return (
    <Tag
      type={isNativeButton ? 'button' : undefined}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, className)}
      disabled={isNativeButton ? disabled || loading : undefined}
      aria-disabled={!isNativeButton && (disabled || loading) ? true : undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} />}
      {children && <span className={styles.text}>{children}</span>}
      {IconRight && !loading && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={1.75} />}
    </Tag>
  )
}

export function IconButton({ icon: Icon, label, size = 'md', variant = 'ghost', active = false, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cx(styles.iconButton, styles[variant], styles[`icon_${size}`], active && styles.active, className)}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 17} strokeWidth={1.75} />
    </button>
  )
}
