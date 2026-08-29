import { cx } from '../lib/cx.js'
import styles from './Skeleton.module.css'

export function Skeleton({ width = '100%', height = 12, radius = 'var(--r-sm)', className }) {
  return <span className={cx(styles.skeleton, className)} style={{ width, height, borderRadius: radius }} />
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <span className={cx(styles.stack, className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  )
}
