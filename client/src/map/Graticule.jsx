import { useMapViewport } from './viewportContext.js'
import styles from './Graticule.module.css'

const STEPS = [5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01]

function stepForZoom(zoom) {
  const index = Math.min(STEPS.length - 1, Math.max(0, Math.floor(zoom) - 8))
  return STEPS[index]
}

function ticks(min, max, step) {
  const start = Math.ceil(min / step) * step
  const values = []
  for (let v = start; v <= max; v += step) values.push(Number(v.toFixed(6)))
  return values
}

// Latitude and longitude reference lines, the only marking on the empty surface
export function Graticule() {
  const { projection, size } = useMapViewport()
  if (!size.width || !size.height) return null

  const step = stepForZoom(projection.zoom)
  const topLeft = projection.unproject(0, 0)
  const bottomRight = projection.unproject(size.width, size.height)

  const lons = ticks(topLeft[0], bottomRight[0], step)
  const lats = ticks(bottomRight[1], topLeft[1], step)

  return (
    <svg className={styles.graticule} width={size.width} height={size.height} aria-hidden="true">
      <g className={styles.lines}>
        {lons.map((lon) => {
          const [x] = projection.project(lon, topLeft[1])
          return <line key={`lon-${lon}`} x1={x} y1={0} x2={x} y2={size.height} />
        })}
        {lats.map((lat) => {
          const [, y] = projection.project(topLeft[0], lat)
          return <line key={`lat-${lat}`} x1={0} y1={y} x2={size.width} y2={y} />
        })}
      </g>
    </svg>
  )
}
