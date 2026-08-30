// Viewport context provider for map projection, center, and zoom synchronization
import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_ZOOM, GUWAHATI_CENTER, REGION_BOUNDS, ZOOM_RANGE } from './constants.js'
import { createProjection } from './projection.js'
import { CursorContext, ViewportContext, createCursorStore } from './viewportContext.js'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clampCenter([lon, lat]) {
  return [
    clamp(lon, REGION_BOUNDS.minLon, REGION_BOUNDS.maxLon),
    clamp(lat, REGION_BOUNDS.minLat, REGION_BOUNDS.maxLat),
  ]
}

export function MapViewportProvider({ children, center = GUWAHATI_CENTER, zoom = DEFAULT_ZOOM }) {
  const [view, setView] = useState({ center, zoom })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cursorStore] = useState(createCursorStore)

  const projection = useMemo(
    () => createProjection({ center: view.center, zoom: view.zoom, width: size.width, height: size.height }),
    [view.center, view.zoom, size.width, size.height],
  )

  const setCenter = useCallback((nextCenter) => {
    setView((prev) => ({
      ...prev,
      center: clampCenter(nextCenter),
    }))
  }, [])

  const setZoom = useCallback((nextZoom) => {
    setView((prev) => ({
      ...prev,
      zoom: clamp(nextZoom, ZOOM_RANGE.min, ZOOM_RANGE.max),
    }))
  }, [])

  const panBy = useCallback((dx, dy) => {
    setView((prev) => {
      const p = createProjection({ center: prev.center, zoom: prev.zoom, width: 0, height: 0 })
      const [cx, cy] = p.project(prev.center[0], prev.center[1])
      return { ...prev, center: clampCenter(p.unproject(cx - dx, cy - dy)) }
    })
  }, [])

  const zoomBy = useCallback((delta, anchor) => {
    setView((prev) => {
      const nextZoom = clamp(prev.zoom + delta, ZOOM_RANGE.min, ZOOM_RANGE.max)
      if (nextZoom === prev.zoom) return prev
      if (!anchor) return { ...prev, zoom: nextZoom }

      const before = createProjection({ center: prev.center, zoom: prev.zoom, ...anchor.size })
      const [targetLon, targetLat] = before.unproject(anchor.x, anchor.y)
      const after = createProjection({ center: prev.center, zoom: nextZoom, ...anchor.size })
      const [tx, ty] = after.project(targetLon, targetLat)
      const [cx, cy] = after.project(prev.center[0], prev.center[1])
      return { center: clampCenter(after.unproject(cx + (tx - anchor.x), cy + (ty - anchor.y))), zoom: nextZoom }
    })
  }, [])

  const flyTo = useCallback((nextCenter, nextZoom) => {
    setView((prev) => ({
      center: clampCenter(nextCenter || prev.center),
      zoom: nextZoom == null ? prev.zoom : clamp(nextZoom, ZOOM_RANGE.min, ZOOM_RANGE.max),
    }))
  }, [])

  const reset = useCallback(() => setView({ center: GUWAHATI_CENTER, zoom: DEFAULT_ZOOM }), [])

  const value = useMemo(
    () => ({
      ...view,
      size,
      projection,
      setSize,
      setCenter,
      setZoom,
      panBy,
      zoomBy,
      flyTo,
      reset,
    }),
    [view, size, projection, setCenter, setZoom, panBy, zoomBy, flyTo, reset],
  )

  return (
    <ViewportContext.Provider value={value}>
      <CursorContext.Provider value={cursorStore}>{children}</CursorContext.Provider>
    </ViewportContext.Provider>
  )
}

export default MapViewportProvider
