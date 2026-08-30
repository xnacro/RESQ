// Viewport and cursor context provider
import { useState } from 'react'
import {
  ViewportContext,
  CursorContext,
  createViewportStore,
  createCursorStore,
} from './viewportContext.js'

export function MapViewportProvider({ children }) {
  const [viewportStore] = useState(createViewportStore)
  const [cursorStore] = useState(createCursorStore)

  return (
    <ViewportContext.Provider value={viewportStore}>
      <CursorContext.Provider value={cursorStore}>{children}</CursorContext.Provider>
    </ViewportContext.Provider>
  )
}

export default MapViewportProvider
