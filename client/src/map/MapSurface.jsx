import { useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx.js'
import { Graticule } from './Graticule.jsx'
import { useCursorStore, useMapViewport } from './viewportContext.js'
import styles from './MapSurface.module.css'

const KEY_PAN_STEP = 80
const WHEEL_ZOOM_RATE = 0.0022

// Full bleed map substrate. The real map service mounts into the node exposed by
// mountRef, and the placeholder hides itself once that node has a child.
export function MapSurface({ children, className, onBackgroundClick, mountRef }) {
  const containerRef = useRef(null)
  const internalMountRef = useRef(null)
  const resolvedMountRef = mountRef || internalMountRef
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const { size, setSize, panBy, zoomBy, projection } = useMapViewport()
  const cursorStore = useCursorStore()

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [setSize])

  const anchorFor = useCallback(
    (event) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return null
      return { x: event.clientX - rect.left, y: event.clientY - rect.top, size }
    },
    [size],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined

    const handleWheel = (event) => {
      event.preventDefault()
      const anchor = anchorFor(event)
      const delta = -event.deltaY * WHEEL_ZOOM_RATE * (event.ctrlKey ? 4 : 1)
      zoomBy(delta, anchor)
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [anchorFor, zoomBy])

  const handlePointerDown = (event) => {
    if (event.button !== 0) return
    dragRef.current = { x: event.clientX, y: event.clientY, moved: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (event) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect && projection.width) {
      const [lon, lat] = projection.unproject(event.clientX - rect.left, event.clientY - rect.top)
      cursorStore.set({ lon, lat })
    }

    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    drag.moved += Math.abs(dx) + Math.abs(dy)
    drag.x = event.clientX
    drag.y = event.clientY
    panBy(dx, dy)
  }

  const handlePointerUp = (event) => {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag && drag.moved < 4 && onBackgroundClick) onBackgroundClick(event)
  }

  const handleKeyDown = (event) => {
    const map = {
      ArrowUp: [0, KEY_PAN_STEP],
      ArrowDown: [0, -KEY_PAN_STEP],
      ArrowLeft: [KEY_PAN_STEP, 0],
      ArrowRight: [-KEY_PAN_STEP, 0],
    }
    if (map[event.key]) {
      event.preventDefault()
      panBy(...map[event.key])
      return
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(0.5, null)
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomBy(-0.5, null)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cx(styles.surface, dragging && styles.dragging, className)}
      role="application"
      aria-label="resQ risk map"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => cursorStore.set(null)}
      onKeyDown={handleKeyDown}
      onDoubleClick={(event) => zoomBy(1, anchorFor(event))}
    >
      <div ref={resolvedMountRef} className={styles.mount} data-map-mount="true" />

      <div className={styles.basemap} aria-hidden="true">
        <Graticule />
      </div>

      <div className={styles.overlays}>{children}</div>

      <div className={styles.vignette} aria-hidden="true" />
    </div>
  )
}
