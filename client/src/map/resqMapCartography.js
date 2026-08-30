// Custom RESQ Cartographic Map Style Generator
// Crafts an operational, high-readability, high-contrast vector basemap with crisp POIs, roads, and emergency layers

import { RESQ_PALETTE } from './resqCartographyTokens.js'

// Standard vector tile source and asset configuration
const VECTOR_SOURCE_ID = 'openmaptiles'
const VECTOR_SOURCE_URL = 'https://tiles.openfreemap.org/planet'
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
const SPRITE_URL = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm'

// High-contrast place and POI label expression (supports English + regional OSM names)
const NAME_EXPRESSION = ['coalesce', ['get', 'name:en'], ['get', 'name'], ['get', 'name:latin']]

export function buildResqVectorStyle({ theme = 'light' } = {}) {
  const isDark = theme === 'dark'
  const p = isDark
    ? {
        bg: RESQ_PALETTE.DARK_LAND,
        landAlt: RESQ_PALETTE.DARK_LAND_ALTERNATE,
        urban: RESQ_PALETTE.DARK_URBAN,
        water: RESQ_PALETTE.DARK_WATER,
        waterLine: RESQ_PALETTE.DARK_WATER_LINE,
        park: '#064e3b',
        forest: '#065f46',
        building: RESQ_PALETTE.DARK_BUILDING,
        buildingStroke: RESQ_PALETTE.DARK_BUILDING_STROKE,
        roadCasing: '#475569',
        roadFill: '#1e293b',
        boundary: '#64748b',
        label: RESQ_PALETTE.DARK_LABEL_PRIMARY,
        labelMuted: '#94a3b8',
        labelWater: '#38bdf8',
        labelHalo: RESQ_PALETTE.DARK_LABEL_HALO,
      }
    : {
        bg: RESQ_PALETTE.LAND,
        landAlt: RESQ_PALETTE.LAND_ALTERNATE,
        urban: RESQ_PALETTE.URBAN,
        water: RESQ_PALETTE.WATER,
        waterLine: RESQ_PALETTE.WATER_LINE,
        park: RESQ_PALETTE.PARK,
        forest: RESQ_PALETTE.FOREST,
        building: RESQ_PALETTE.BUILDING,
        buildingStroke: RESQ_PALETTE.BUILDING_STROKE,
        roadCasing: RESQ_PALETTE.ROAD_PRIMARY_CASING,
        roadFill: '#ffffff',
        boundary: RESQ_PALETTE.BOUNDARY_STATE,
        label: RESQ_PALETTE.LABEL_CITY,
        labelMuted: RESQ_PALETTE.LABEL_LOCALITY,
        labelWater: RESQ_PALETTE.LABEL_WATER,
        labelHalo: RESQ_PALETTE.LABEL_HALO,
      }

  return {
    version: 8,
    name: `RESQ High-Contrast Cartography (${isDark ? 'Dark' : 'Light'})`,
    metadata: {
      'resq:cartography_version': '3.5.0',
    },
    sources: {
      [VECTOR_SOURCE_ID]: {
        type: 'vector',
        url: VECTOR_SOURCE_URL,
      },
    },
    glyphs: GLYPHS_URL,
    sprite: SPRITE_URL,
    layers: [
      // 1. Background Canvas
      {
        id: 'resq-background',
        type: 'background',
        paint: {
          'background-color': p.bg,
        },
      },

      // 2. Landcover & Natural Areas
      {
        id: 'resq-landcover-glacier',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'landcover',
        filter: ['==', ['get', 'subclass'], 'glacier'],
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.8,
        },
      },
      {
        id: 'resq-landcover-wood',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: {
          'fill-color': p.forest,
          'fill-opacity': 0.65,
        },
      },
      {
        id: 'resq-landcover-grass',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'grass'],
        paint: {
          'fill-color': p.park,
          'fill-opacity': 0.55,
        },
      },

      // 3. Landuse (Parks, Urban, Residential)
      {
        id: 'resq-landuse-park',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'park',
        paint: {
          'fill-color': p.park,
          'fill-opacity': 0.75,
        },
      },
      {
        id: 'resq-landuse-residential',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood'], true, false],
        paint: {
          'fill-color': p.landAlt,
          'fill-opacity': 0.5,
        },
      },
      {
        id: 'resq-landuse-commercial',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['commercial', 'retail'], true, false],
        paint: {
          'fill-color': p.urban,
          'fill-opacity': 0.35,
        },
      },
      {
        id: 'resq-landuse-industrial',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['industrial', 'dam', 'garages'], true, false],
        paint: {
          'fill-color': p.urban,
          'fill-opacity': 0.4,
        },
      },

      // 4. Water Polygons & Waterways (Flooding context)
      {
        id: 'resq-water-fill',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'water',
        paint: {
          'fill-color': p.water,
          'fill-opacity': 0.95,
        },
      },
      {
        id: 'resq-waterway-major',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'waterway',
        filter: ['match', ['get', 'class'], ['river', 'canal'], true, false],
        paint: {
          'line-color': p.waterLine,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            6, 1.2,
            12, 3.5,
            16, 7,
          ],
          'line-opacity': 0.9,
        },
      },
      {
        id: 'resq-waterway-minor',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'waterway',
        filter: ['match', ['get', 'class'], ['stream', 'drain', 'ditch'], true, false],
        minzoom: 11,
        paint: {
          'line-color': p.waterLine,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            11, 0.8,
            16, 2.5,
          ],
          'line-opacity': 0.75,
        },
      },

      // 5. Road Tunnels
      {
        id: 'resq-tunnel-casing',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'brunnel'], 'tunnel'],
        paint: {
          'line-color': p.roadCasing,
          'line-dasharray': [2, 2],
          'line-width': 2,
        },
      },

      // 6. Road Network Hierarchy (High-contrast casing and bright fills)
      {
        id: 'resq-road-path',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['path', 'track', 'pedestrian', 'footway'], true, false],
        minzoom: 13,
        paint: {
          'line-color': isDark ? '#334155' : '#94a3b8',
          'line-dasharray': [2, 2],
          'line-width': 1,
        },
      },
      {
        id: 'resq-road-minor-casing',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'residential', 'service'], true, false],
        minzoom: 12,
        paint: {
          'line-color': isDark ? '#1e293b' : '#cbd5e1',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            12, 1.5,
            16, 4.0,
          ],
        },
      },
      {
        id: 'resq-road-minor-fill',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'residential', 'service'], true, false],
        minzoom: 12,
        paint: {
          'line-color': p.roadFill,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            12, 0.75,
            16, 2.5,
          ],
        },
      },
      {
        id: 'resq-road-secondary-casing',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false],
        minzoom: 8,
        paint: {
          'line-color': isDark ? '#334155' : '#94a3b8',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 1.8,
            16, 6.0,
          ],
        },
      },
      {
        id: 'resq-road-secondary-fill',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false],
        minzoom: 8,
        paint: {
          'line-color': p.roadFill,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 1.0,
            16, 4.5,
          ],
        },
      },
      {
        id: 'resq-road-primary-casing',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['primary', 'trunk'], true, false],
        minzoom: 5,
        paint: {
          'line-color': isDark ? '#475569' : '#64748b',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 2.0,
            12, 4.0,
            16, 8.5,
          ],
        },
      },
      {
        id: 'resq-road-primary-fill',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['primary', 'trunk'], true, false],
        minzoom: 5,
        paint: {
          'line-color': p.roadFill,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 1.2,
            12, 2.5,
            16, 6.5,
          ],
        },
      },
      {
        id: 'resq-road-motorway-casing',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        minzoom: 4,
        paint: {
          'line-color': isDark ? '#64748b' : '#334155',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 2.2,
            12, 5.0,
            16, 10.0,
          ],
        },
      },
      {
        id: 'resq-road-motorway-fill',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        minzoom: 4,
        paint: {
          'line-color': p.roadFill,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 1.4,
            12, 3.5,
            16, 8.0,
          ],
        },
      },

      // 7. Subtle 2D Building Footprints (High Zoom)
      {
        id: 'resq-building-fill',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': p.building,
          'fill-outline-color': p.buildingStroke,
          'fill-opacity': 0.85,
        },
      },

      // 8. Administrative Boundaries (State & District)
      {
        id: 'resq-boundary-district',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'boundary',
        filter: ['>=', ['get', 'admin_level'], 4],
        minzoom: 7,
        paint: {
          'line-color': isDark ? '#475569' : '#94a3b8',
          'line-width': 1.0,
          'line-dasharray': [2, 2],
        },
      },
      {
        id: 'resq-boundary-state',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 3],
        paint: {
          'line-color': p.boundary,
          'line-width': 1.5,
          'line-dasharray': [4, 2],
        },
      },

      // 9. Water Labels
      {
        id: 'resq-label-water',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'water_name',
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Italic'],
          'text-size': 11.5,
          'text-letter-spacing': 0.05,
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': p.labelWater,
          'text-halo-color': p.labelHalo,
          'text-halo-width': 1.5,
        },
      },

      // 10. Road Hierarchy Labels
      {
        id: 'resq-label-road-major',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'transportation_name',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
        minzoom: 10,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            10, 9.5,
            15, 12,
          ],
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': p.labelMuted,
          'text-halo-color': p.labelHalo,
          'text-halo-width': 1.5,
        },
      },

      // 11. Points of Interest (POIs) — Emergency, Transit, Landmarks, Civic
      {
        id: 'resq-poi-emergency',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'poi',
        filter: ['match', ['get', 'class'], ['hospital', 'police', 'fire_station', 'doctor', 'pharmacy', 'emergency'], true, false],
        minzoom: 11,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Bold'],
          'text-size': 11.5,
          'text-anchor': 'top',
          'text-offset': [0, 0.4],
        },
        paint: {
          'text-color': RESQ_PALETTE.POI_HOSPITAL,
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      },
      {
        id: 'resq-poi-transit',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'poi',
        filter: ['match', ['get', 'class'], ['railway', 'bus', 'ferry', 'airport'], true, false],
        minzoom: 10.5,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 0.4],
        },
        paint: {
          'text-color': RESQ_PALETTE.POI_TRANSIT,
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      },
      {
        id: 'resq-poi-airport',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'aerodrome_label',
        minzoom: 8,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 0.4],
        },
        paint: {
          'text-color': RESQ_PALETTE.POI_AIRPORT,
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      },
      {
        id: 'resq-poi-civic',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'poi',
        filter: ['match', ['get', 'class'], ['college', 'school', 'university', 'townhall', 'courthouse', 'post_office', 'bank', 'fuel', 'place_of_worship'], true, false],
        minzoom: 13,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Regular'],
          'text-size': 10.5,
          'text-anchor': 'top',
          'text-offset': [0, 0.3],
        },
        paint: {
          'text-color': RESQ_PALETTE.POI_CIVIC,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'resq-poi-general',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'poi',
        filter: ['match', ['get', 'class'], ['hospital', 'police', 'fire_station', 'doctor', 'pharmacy', 'emergency', 'railway', 'bus', 'ferry', 'airport', 'college', 'school', 'university', 'townhall', 'courthouse', 'post_office', 'bank', 'fuel', 'place_of_worship'], false, true],
        minzoom: 14,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 0.3],
        },
        paint: {
          'text-color': RESQ_PALETTE.POI_COMMERCIAL,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },

      // 12. Place Labels (Towns, Localities, Cities with high contrast)
      {
        id: 'resq-label-place-suburb',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['neighbourhood', 'suburb', 'village'], true, false],
        minzoom: 11.5,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: {
          'text-color': p.labelMuted,
          'text-halo-color': p.labelHalo,
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'resq-label-place-town',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['town', 'district'], true, false],
        minzoom: 7,
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            7, 11,
            13, 14,
          ],
        },
        paint: {
          'text-color': p.label,
          'text-halo-color': p.labelHalo,
          'text-halo-width': 2,
        },
      },
      {
        id: 'resq-label-place-city',
        type: 'symbol',
        source: VECTOR_SOURCE_ID,
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'state', 'country'], true, false],
        layout: {
          'text-field': NAME_EXPRESSION,
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4, 12,
            10, 15,
            14, 18,
          ],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.04,
        },
        paint: {
          'text-color': p.label,
          'text-halo-color': p.labelHalo,
          'text-halo-width': 2.5,
        },
      },
    ],
  }
}

export default {
  buildResqVectorStyle,
}
