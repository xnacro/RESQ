import { createContext, useContext, useSyncExternalStore } from 'react'

export const ViewportContext = createContext(null)
export const CursorContext = createContext(null)

// Cursor position lives outside React state so pointer moves never re-render the map
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
      listeners.forEach((listener) => listener())
    },
  }
}

export function useMapViewport() {
  const context = useContext(ViewportContext)
  if (!context) throw new Error('useMapViewport must be used inside MapViewportProvider')
  return context
}

export function useCursorStore() {
  const store = useContext(CursorContext)
  if (!store) throw new Error('useCursorStore must be used inside MapViewportProvider')
  return store
}

export function useCursorPosition() {
  const store = useCursorStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
