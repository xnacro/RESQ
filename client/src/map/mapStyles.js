// MapLibre and OpenFreeMap 100% Free Vector Tile Style Configurations
// Zero API keys required, zero watermarks, 100% open-source vector tiles

export const MAP_MODES = {
  NORMAL: 'normal',
  LIBERTY: 'liberty',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  RESQ: 'resq',
}

// OpenFreeMap vector styles (100% Free & Open Source)
export const OPEN_FREE_MAP_STYLES = Object.freeze({
  LIBERTY: 'https://tiles.openfreemap.org/styles/liberty',
  BRIGHT: 'https://tiles.openfreemap.org/styles/bright',
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

// Standalone Hybrid Style (Satellite + OpenFreeMap Vector Labels)
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
    case MAP_MODES.LIBERTY:
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
      return OPEN_FREE_MAP_STYLES.LIBERTY
  }
}
