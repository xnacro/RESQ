// Floating bottom layer switcher for MapLibre map modes
import { Map, Box, Mountain, Globe, Layers } from 'lucide-react'
import { MAP_MODES } from './mapStyles.js'
import styles from './LayerSwitcher.module.css'

const LAYERS = [
  { id: MAP_MODES.NORMAL, label: 'Normal', icon: Map },
  { id: MAP_MODES.D3, label: '3D', icon: Box },
  { id: MAP_MODES.TERRAIN, label: 'Terrain', icon: Mountain },
  { id: MAP_MODES.SATELLITE, label: 'Satellite', icon: Globe },
  { id: MAP_MODES.HYBRID, label: 'Hybrid', icon: Layers },
]

export function LayerSwitcher({ activeMode = MAP_MODES.NORMAL, onModeChange }) {
  return (
    <div className={styles.container} role="toolbar" aria-label="Map Layer Selector">
      {LAYERS.map((layer) => {
        const Icon = layer.icon
        const isActive = activeMode === layer.id
        return (
          <button
            key={layer.id}
            type="button"
            className={`${styles.layerBtn} ${isActive ? styles.layerBtnActive : ''}`}
            onClick={() => onModeChange && onModeChange(layer.id)}
            aria-pressed={isActive}
          >
            <Icon size={14} strokeWidth={isActive ? 2.2 : 1.75} />
            <span className={styles.label}>{layer.label}</span>
          </button>
        )
      })}
    </div>
  )
}
