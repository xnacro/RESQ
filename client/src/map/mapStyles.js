// MapLibre and OpenFreeMap vector and basemap style configurations
// Provides high-contrast vector cartography, orange highways, and blue water bodies

export const MAP_MODES = {
  NORMAL: 'normal',
  LIBERTY: 'liberty',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  RESQ: 'resq',
}

// OpenFreeMap vector style URLs
export const OPEN_FREE_MAP_STYLES = Object.freeze({
  LIBERTY: 'https://tiles.openfreemap.org/styles/liberty',
  BRIGHT: 'https://tiles.openfreemap.org/styles/bright',
  POSITRON: 'https://tiles.openfreemap.org/styles/positron',
})

// High-Performance Vector Cartography Style (Carto Voyager / OpenFreeMap Vector)
export const VOYAGER_VECTOR_STYLE = Object.freeze({
  version: 8,
  sources: {
    voyagerTiles: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a>, &copy; <a href="https://carto.com/">CARTO</a>, &copy; OpenStreetMap',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'basemap-tiles',
      type: 'raster',
      source: 'voyagerTiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
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
      attribution: '&copy; Maxar, Earthstar Geographics, ISRO',
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

// Returns the map style definition for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  switch (mode) {
    case MAP_MODES.NORMAL:
      return VOYAGER_VECTOR_STYLE
    case MAP_MODES.LIBERTY:
      return OPEN_FREE_MAP_STYLES.LIBERTY
    case MAP_MODES.D3:
    case MAP_MODES.TERRAIN:
      return VOYAGER_VECTOR_STYLE
    case MAP_MODES.SATELLITE:
      return STANDALONE_SATELLITE_STYLE
    case MAP_MODES.HYBRID:
      return STANDALONE_HYBRID_STYLE
    case MAP_MODES.RESQ:
      return OPEN_FREE_MAP_STYLES.POSITRON
    default:
      return VOYAGER_VECTOR_STYLE
  }
}
