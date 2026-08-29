import { MapChrome } from '../map/MapChrome.jsx'
import { MapSurface } from '../map/MapSurface.jsx'
import { MapViewportProvider } from '../map/viewport.jsx'
import { ContextPanel } from '../panels/ContextPanel.jsx'
import styles from './MapView.module.css'

export default function MapView() {
  return (
    <MapViewportProvider>
      <div className={styles.screen}>
        <div className={styles.mapArea}>
          <MapSurface />
          <MapChrome />
        </div>
        <ContextPanel />
      </div>
    </MapViewportProvider>
  )
}
