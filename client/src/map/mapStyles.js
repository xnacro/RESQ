// MapLibre and OpenFreeMap vector basemap configurations
// Uses 100% open, free, zero-token OpenFreeMap vector tile infrastructure

export const MAP_MODES = {
  NORMAL: 'normal',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
}

// OpenFreeMap vector style endpoints
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

// Standalone Hybrid Style
export const STANDALONE_HYBRID_STYLE = Object.freeze({
  version: 8,
  sources: {
    satelliteTiles: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Maxar, Earthstar Geographics, ISRO, OpenFreeMap',
      maxzoom: 18,
    },
    overlayLabels: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      maxzoom: 19,
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
    {
      id: 'labels-tiles',
      type: 'raster',
      source: 'overlayLabels',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
})

// Returns the style definition for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  switch (mode) {
    case MAP_MODES.NORMAL:
      return OPEN_FREE_MAP_STYLES.BRIGHT
    case MAP_MODES.D3:
    case MAP_MODES.TERRAIN:
      return OPEN_FREE_MAP_STYLES.LIBERTY
    case MAP_MODES.SATELLITE:
      return STANDALONE_SATELLITE_STYLE
    case MAP_MODES.HYBRID:
      return STANDALONE_HYBRID_STYLE
    default:
      return OPEN_FREE_MAP_STYLES.BRIGHT
  }
}
