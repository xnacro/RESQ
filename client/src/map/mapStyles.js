// MapLibre style definitions and basemap tile configurations
// Uses open and sovereign-ready raster/vector tile endpoints without proprietary tokens

export const MAP_MODES = {
  NORMAL: 'normal',
  D3: '3d',
  TERRAIN: 'terrain',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
}

// Generates a MapLibre style object for a given mode
export function getMapStyle(mode = MAP_MODES.NORMAL) {
  const sources = {
    // OpenStreetMap standard tile source
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
    // Carto Positron light clean operational basemap
    cartoLight: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OpenStreetMap',
      maxzoom: 19,
    },
    // OpenTopoMap high-relief terrain
    topo: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxzoom: 17,
    },
    // Open Satellite Imagery (Esri World Imagery)
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics, ISRO',
      maxzoom: 18,
    },
    // Carto Overlay labels & boundaries for Hybrid mode
    cartoLabels: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  }

  let baseLayerSource = 'cartoLight'
  if (mode === MAP_MODES.TERRAIN || mode === MAP_MODES.D3) {
    baseLayerSource = 'topo'
  } else if (mode === MAP_MODES.SATELLITE || mode === MAP_MODES.HYBRID) {
    baseLayerSource = 'satellite'
  }

  const layers = [
    {
      id: 'base-tiles',
      type: 'raster',
      source: baseLayerSource,
      minzoom: 0,
      maxzoom: 22,
    },
  ]

  // Add roads & place labels overlay for Hybrid mode
  if (mode === MAP_MODES.HYBRID) {
    layers.push({
      id: 'hybrid-labels',
      type: 'raster',
      source: 'cartoLabels',
      minzoom: 0,
      maxzoom: 22,
    })
  }

  return {
    version: 8,
    sources,
    layers,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  }
}
