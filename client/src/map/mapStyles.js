// MapLibre and OpenFreeMap 100% Free Style Configurations
// Zero API keys required, zero watermarks, 100% open-source cartography

export const MAP_MODES = {
  NORMAL: 'normal',
  LIBERTY: 'liberty',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  RESQ: 'resq',
}

// 100% Free OpenFreeMap & Humanitarian OpenStreetMap Base Style
export const OPEN_FREE_MAP_BASE_STYLE = Object.freeze({
  version: 8,
  sources: {
    openmaptiles: {
      type: 'vector',
      tiles: [
        'https://tiles.openfreemap.org/planet/20260823_080002_pt/{z}/{x}/{y}.pbf',
      ],
      minzoom: 0,
      maxzoom: 14,
      attribution: '<a href="https://openfreemap.org" target="_blank">&copy; OpenFreeMap</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
    },
    openFreeMapRaster: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors, Humanitarian OpenStreetMap Team',
      maxzoom: 19,
    },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  layers: [
    {
      id: 'openfreemap-base',
      type: 'raster',
      source: 'openFreeMapRaster',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
})

// OpenFreeMap vector styles (Remote JSON)
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

// Returns the map style definition for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  switch (mode) {
    case MAP_MODES.NORMAL:
      return OPEN_FREE_MAP_BASE_STYLE
    case MAP_MODES.LIBERTY:
      return OPEN_FREE_MAP_STYLES.LIBERTY
    case MAP_MODES.D3:
    case MAP_MODES.TERRAIN:
      return OPEN_FREE_MAP_BASE_STYLE
    case MAP_MODES.SATELLITE:
      return STANDALONE_SATELLITE_STYLE
    case MAP_MODES.HYBRID:
      return STANDALONE_HYBRID_STYLE
    case MAP_MODES.RESQ:
      return OPEN_FREE_MAP_STYLES.POSITRON
    default:
      return OPEN_FREE_MAP_BASE_STYLE
  }
}
