// MapLibre and OpenFreeMap 100% Vector Tile Style Configurations
// Uses official OpenFreeMap vector tile styles for Bright, Liberty, 3D, and Positron

export const MAP_MODES = {
  NORMAL: 'normal',
  LIBERTY: 'liberty',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  RESQ: 'resq',
}

// Official OpenFreeMap vector tile styles
export const OPEN_FREE_MAP_STYLES = Object.freeze({
  BRIGHT: 'https://tiles.openfreemap.org/styles/bright',
  LIBERTY: 'https://tiles.openfreemap.org/styles/liberty',
  POSITRON: 'https://tiles.openfreemap.org/styles/positron',
})

// Standalone Satellite Style
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

// Standalone Hybrid Style (Satellite + Vector Boundaries)
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

// Returns the vector style definition for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  switch (mode) {
    case MAP_MODES.NORMAL:
      return OPEN_FREE_MAP_STYLES.BRIGHT
    case MAP_MODES.LIBERTY:
      return OPEN_FREE_MAP_STYLES.LIBERTY
    case MAP_MODES.D3:
    case MAP_MODES.TERRAIN:
      return OPEN_FREE_MAP_STYLES.LIBERTY
    case MAP_MODES.SATELLITE:
      return STANDALONE_SATELLITE_STYLE
    case MAP_MODES.HYBRID:
      return STANDALONE_HYBRID_STYLE
    case MAP_MODES.RESQ:
      return OPEN_FREE_MAP_STYLES.POSITRON
    default:
      return OPEN_FREE_MAP_STYLES.BRIGHT
  }
}
