// MapChrome floating UI controls and overlays for RESQ Operations Map
import { useState } from 'react'
import { Crosshair, Minus, Plus, Compass, Maximize2, Minimize2, Box, Info } from 'lucide-react'
import { Tooltip } from '../ui/index.js'
import { formatCoord } from '../lib/format.js'
import { metersPerPixel } from './projection.js'
import { useCursorPosition, useMapViewport } from './viewportContext.js'
import { LayerSwitcher } from './LayerSwitcher.jsx'
import { MapLegend } from './MapLegend.jsx'
import { MAP_MODES } from './mapStyles.js'
import styles from './MapChrome.module.css'

const NICE_DISTANCES = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]
const TARGET_BAR_PX = 96

export function VerticalControls({ onLocateMe, onToggle3D, is3D = false }) {
  const { zoomBy, reset } = useMapViewport()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  return (
    <div className={styles.verticalStack} role="toolbar" aria-label="Map Navigation Controls">
      <Tooltip content="Locate me (GPS)" placement="left">
        <button type="button" className={styles.ctrlBtn} onClick={onLocateMe} aria-label="Use my device location">
          <Crosshair size={17} strokeWidth={2} />
        </button>
      </Tooltip>

      <Tooltip content="Recenter on Guwahati" placement="left">
        <button type="button" className={styles.ctrlBtn} onClick={reset} aria-label="Reset orientation to north">
          <Compass size={17} strokeWidth={2} />
        </button>
      </Tooltip>

      <div className={styles.ctrlDivider} />

      <Tooltip content="Zoom in" placement="left">
        <button type="button" className={styles.ctrlBtn} onClick={() => zoomBy(0.75, null)} aria-label="Zoom in">
          <Plus size={17} strokeWidth={2} />
        </button>
      </Tooltip>

      <Tooltip content="Zoom out" placement="left">
        <button type="button" className={styles.ctrlBtn} onClick={() => zoomBy(-0.75, null)} aria-label="Zoom out">
          <Minus size={17} strokeWidth={2} />
        </button>
      </Tooltip>

      <div className={styles.ctrlDivider} />

      <Tooltip content={is3D ? "Reset 2D View" : "3D Terrain Tilt"} placement="left">
        <button
          type="button"
          className={`${styles.ctrlBtn} ${is3D ? styles.ctrlBtnActive : ''}`}
          onClick={onToggle3D}
          aria-label="Toggle 3D Terrain view"
        >
          <Box size={17} strokeWidth={2} />
        </button>
      </Tooltip>

      <Tooltip content={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} placement="left">
        <button type="button" className={styles.ctrlBtn} onClick={handleFullscreen} aria-label="Toggle fullscreen">
          {isFullscreen ? <Minimize2 size={17} strokeWidth={2} /> : <Maximize2 size={17} strokeWidth={2} />}
        </button>
      </Tooltip>
    </div>
  )
}

export function CoordinateReadout() {
  const { center, zoom } = useMapViewport()
  const cursor = useCursorPosition()
  const lon = cursor ? cursor.lon : center[0]
  const lat = cursor ? cursor.lat : center[1]

  return (
    <div className={styles.readout}>
      <span className={`${styles.coords} mono`}>{formatCoord(lon, lat)}</span>
      <span className={styles.sep} />
      <span className={`${styles.zoom} mono`}>z{zoom.toFixed(1)}</span>
    </div>
  )
}

export function ScaleBar() {
  const { center, zoom } = useMapViewport()
  const mpp = metersPerPixel(center[1], zoom)
  const targetMeters = mpp * TARGET_BAR_PX
  const meters = NICE_DISTANCES.find((d) => d >= targetMeters) || NICE_DISTANCES[NICE_DISTANCES.length - 1]
  const widthPx = Math.round(meters / mpp)
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`

  return (
    <div className={styles.scale}>
      <span className={styles.scaleBar} style={{ width: widthPx }} />
      <span className={`${styles.scaleLabel} mono`}>{label}</span>
    </div>
  )
}

export function MapChrome({
  activeMode = MAP_MODES.NORMAL,
  onModeChange,
  onLocateMe,
}) {
  const is3D = activeMode === MAP_MODES.D3

  const handleToggle3D = () => {
    if (onModeChange) {
      onModeChange(is3D ? MAP_MODES.NORMAL : MAP_MODES.D3)
    }
  }

  return (
    <div className={styles.chromeOverlay}>
      {/* Top-left floating attribution and legend stack */}
      <div className={styles.topLeftStack}>
        <div className={styles.topLeftPill}>
          <Info size={14} className={styles.pillIcon} />
          <span className={styles.pillBold}>RESQ MAP</span>
          <span className={styles.pillSep}>•</span>
          <span className={styles.pillText}>Assam &amp; Meghalaya</span>
          <span className={styles.pillSep}>•</span>
          <span className={styles.pillText}>408K Grid Cells</span>
        </div>
        <MapLegend />
      </div>

      {/* Right vertical controls stack */}
      <div className={styles.rightRail}>
        <VerticalControls onLocateMe={onLocateMe} onToggle3D={handleToggle3D} is3D={is3D} />
      </div>

      {/* Bottom center layer switcher */}
      <div className={styles.bottomCenter}>
        <LayerSwitcher activeMode={activeMode} onModeChange={onModeChange} />
      </div>

      {/* Bottom strip status */}
      <div className={styles.bottomStrip}>
        <ScaleBar />
        <CoordinateReadout />
      </div>
    </div>
  )
}

export default MapChrome
