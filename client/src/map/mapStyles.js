// MapLibre vector style configurations and RESQ custom cartography resolver
import { buildResqVectorStyle } from './resqMapCartography.js'

export const MAP_MODES = {
  NORMAL: 'normal',
  LIBERTY: 'liberty',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  RESQ: 'resq',
}

// Standalone Satellite Style (Esri World Imagery)
export const STANDALONE_SATELLITE_STYLE = Object.freeze({
  version: 8,
  sources: {
    satelliteTiles: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Maxar, Earthstar Geographics, ISRO',
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: 'satellite-tiles',
      type: 'raster',
      source: 'satelliteTiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
})

// Standalone Hybrid Style (Satellite + Overlay)
export const STANDALONE_HYBRID_STYLE = Object.freeze({
  version: 8,
  sources: {
    satelliteTiles: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Maxar, Earthstar Geographics, ISRO',
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: 'satellite-tiles',
      type: 'raster',
      source: 'satelliteTiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
})

// Returns custom RESQ vector style or standalone raster style for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL, theme = 'light') {
  switch (mode) {
    case MAP_MODES.NORMAL:
    case MAP_MODES.LIBERTY:
    case MAP_MODES.RESQ:
    case MAP_MODES.D3:
    case MAP_MODES.TERRAIN:
      return buildResqVectorStyle({ theme, mode })
    case MAP_MODES.SATELLITE:
      return STANDALONE_SATELLITE_STYLE
    case MAP_MODES.HYBRID:
      return STANDALONE_HYBRID_STYLE
    default:
      return buildResqVectorStyle({ theme, mode })
  }
}

export default {
  MAP_MODES,
  STANDALONE_SATELLITE_STYLE,
  STANDALONE_HYBRID_STYLE,
  getMapStyle,
}
