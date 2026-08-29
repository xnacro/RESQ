import { Crosshair, Minus, Plus } from 'lucide-react'
import { IconButton, Tooltip } from '../ui/index.js'
import { formatCoord } from '../lib/format.js'
import { metersPerPixel } from './projection.js'
import { useCursorPosition, useMapViewport } from './viewportContext.js'
import styles from './MapChrome.module.css'

const NICE_DISTANCES = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000]
const TARGET_BAR_PX = 96

export function ZoomControls() {
  const { zoomBy, reset } = useMapViewport()

  return (
    <div className={styles.zoomStack}>
      <Tooltip content="Zoom in" placement="left">
        <IconButton icon={Plus} label="Zoom in" variant="secondary" onClick={() => zoomBy(0.75, null)} />
      </Tooltip>
      <Tooltip content="Zoom out" placement="left">
        <IconButton icon={Minus} label="Zoom out" variant="secondary" onClick={() => zoomBy(-0.75, null)} />
      </Tooltip>
      <Tooltip content="Recenter on Guwahati" placement="left">
        <IconButton icon={Crosshair} label="Recenter on Guwahati" variant="secondary" onClick={reset} />
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

export function MapChrome() {
  return (
    <>
      <div className={styles.rightRail}>
        <ZoomControls />
      </div>
      <div className={styles.bottomStrip}>
        <ScaleBar />
        <CoordinateReadout />
      </div>
    </>
  )
}
