// MapLibre and OpenFreeMap vector style configurations
// Uses 100% open, free, zero-token OpenFreeMap and MapLibre vector tile infrastructure

export const MAP_MODES = {
  NORMAL: 'normal',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
}

// OpenFreeMap vector styles and MapLibre style endpoints
export const OPEN_FREE_MAP_STYLES = Object.freeze({
  // OpenFreeMap Positron: clean, light, high-performance operational vector basemap
  POSITRON: 'https://tiles.openfreemap.org/styles/positron',
  // OpenFreeMap Liberty: rich detail, roads, topographic features, and labels
  LIBERTY: 'https://tiles.openfreemap.org/styles/liberty',
  // OpenFreeMap Bright: high-contrast clear cartography
  BRIGHT: 'https://tiles.openfreemap.org/styles/bright',
  // MapLibre demo vector style
  MAPLIBRE_DEMO: 'https://demotiles.maplibre.org/style.json',
})

// Returns the style URL or custom MapLibre style definition for the specified mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  switch (mode) {
    case MAP_MODES.NORMAL:
      // OpenFreeMap Positron: clean light vector map
      return OPEN_FREE_MAP_STYLES.POSITRON

    case MAP_MODES.D3:
      // OpenFreeMap Liberty for 3D terrain exploration
      return OPEN_FREE_MAP_STYLES.LIBERTY

    case MAP_MODES.TERRAIN:
      // OpenFreeMap Liberty with topographic contours
      return OPEN_FREE_MAP_STYLES.LIBERTY

    case MAP_MODES.SATELLITE:
      // Open high-resolution satellite imagery
      return {
        version: 8,
        sources: {
          satelliteSource: {
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
            id: 'satellite-layer',
            type: 'raster',
            source: 'satelliteSource',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      }

    case MAP_MODES.HYBRID:
      // Satellite base imagery with OpenFreeMap vector overlays
      return {
        version: 8,
        sources: {
          satelliteSource: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '&copy; Maxar, Earthstar Geographics, ISRO, OpenFreeMap',
            maxzoom: 18,
          },
          cartoOverlay: {
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
            id: 'satellite-layer',
            type: 'raster',
            source: 'satelliteSource',
            minzoom: 0,
            maxzoom: 22,
          },
          {
            id: 'labels-overlay',
            type: 'raster',
            source: 'cartoOverlay',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      }

    default:
      return OPEN_FREE_MAP_STYLES.POSITRON
  }
}
