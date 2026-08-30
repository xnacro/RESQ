// MapLibre and OpenFreeMap style configurations
// Provides instant synchronous initialization with zero proprietary tokens

export const MAP_MODES = {
  NORMAL: 'normal',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
}

// Standalone Light Basemap Style (instant synchronous load in 0ms)
export const STANDALONE_LIGHT_STYLE = Object.freeze({
  version: 8,
  sources: {
    openFreeMapTiles: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a>, &copy; <a href="https://carto.com/">CARTO</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'basemap-tiles',
      type: 'raster',
      source: 'openFreeMapTiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
})

// Standalone Terrain Style
export const STANDALONE_TERRAIN_STYLE = Object.freeze({
  version: 8,
  sources: {
    topoTiles: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenTopoMap',
      maxzoom: 17,
    },
  },
  layers: [
    {
      id: 'topo-tiles',
      type: 'raster',
      source: 'topoTiles',
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

// Returns the style definition for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  switch (mode) {
    case MAP_MODES.NORMAL:
      return STANDALONE_LIGHT_STYLE
    case MAP_MODES.D3:
    case MAP_MODES.TERRAIN:
      return STANDALONE_TERRAIN_STYLE
    case MAP_MODES.SATELLITE:
      return STANDALONE_SATELLITE_STYLE
    case MAP_MODES.HYBRID:
      return STANDALONE_HYBRID_STYLE
    default:
      return STANDALONE_LIGHT_STYLE
  }
}
