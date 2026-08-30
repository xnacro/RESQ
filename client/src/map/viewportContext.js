// External stores for viewport and cursor synchronization without React render loops
import { createContext, useContext, useSyncExternalStore } from 'react'
import { GUWAHATI_CENTER, DEFAULT_ZOOM, ZOOM_RANGE } from './constants.js'

export const ViewportContext = createContext(null)
export const CursorContext = createContext(null)

// Creates an external store for cursor mouse coordinates
export function createCursorStore() {
  let snapshot = null
  const listeners = new Set()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    set(next) {
      snapshot = next
      listeners.forEach((l) => l())
    },
  }
}

// Creates an external store for map viewport center and zoom
export function createViewportStore() {
  let snapshot = { center: GUWAHATI_CENTER, zoom: DEFAULT_ZOOM }
  let mapInstance = null
  const listeners = new Set()

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    set(next) {
      snapshot = { ...snapshot, ...next }
      listeners.forEach((l) => l())
    },
    setMapInstance(map) {
      mapInstance = map
    },
    getMapInstance() {
      return mapInstance
    },
    zoomBy(delta) {
      if (mapInstance) {
        const cur = mapInstance.getZoom()
        const target = Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, cur + delta))
        mapInstance.easeTo({ zoom: target, duration: 300 })
      }
    },
    reset() {
      if (mapInstance) {
        mapInstance.flyTo({ center: GUWAHATI_CENTER, zoom: DEFAULT_ZOOM, pitch: 0, bearing: 0, essential: true })
      }
    },
    flyTo(center, zoom) {
      if (mapInstance) {
        mapInstance.flyTo({ center, zoom: zoom ?? mapInstance.getZoom(), essential: true })
      }
    },
  }
}

const fallbackViewportStore = createViewportStore()
const fallbackCursorStore = createCursorStore()

export function useViewportStore() {
  const store = useContext(ViewportContext)
  return store || fallbackViewportStore
}

export function useMapViewport() {
  const store = useViewportStore()
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return {
    ...snap,
    zoomBy: store.zoomBy,
    reset: store.reset,
    flyTo: store.flyTo,
    setCenter: (center) => store.set({ center }),
    setZoom: (zoom) => store.set({ zoom }),
  }
}

export function useCursorStore() {
  const store = useContext(CursorContext)
  return store || fallbackCursorStore
}

export function useCursorPosition() {
  const store = useCursorStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
