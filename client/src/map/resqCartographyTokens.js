// Centralized RESQ Cartographic Palette and Visual Tokens
// Defines consistent palettes for basemap geometry, typography, risk states, and operational overlays

export const RESQ_PALETTE = Object.freeze({
  // Land & Surface (Soft warm-neutral light stone tone, never pure white)
  LAND: '#f4f1ea',
  LAND_ALTERNATE: '#eae5dc',
  URBAN: '#e2e5ea',
  RESIDENTIAL_ZONE: '#eaecef',
  INDUSTRIAL_ZONE: '#dcdfe5',
  PARK: '#d4e8d8',
  FOREST: '#c3dec9',
  SAND: '#e8dfc8',

  // Water & Rivers (Medium-light rich calm blue with prominent river channels for Brahmaputra & Barak)
  WATER: '#a8ceee',
  WATER_DEEP: '#8ebde4',
  WATER_LINE: '#2575b8',
  WATER_STREAM: '#5b9dd4',

  // Buildings & Footprints (Slightly darker than land, visible at high zoom with clean stroke)
  BUILDING: '#d9dee5',
  BUILDING_STROKE: '#c7cdd6',
  BUILDING_3D_LOW: '#cbd2db',
  BUILDING_3D_MID: '#b4beca',
  BUILDING_3D_HIGH: '#94a3b8',

  // Administrative Boundaries (Understated medium gray)
  BOUNDARY_COUNTRY: '#475569',
  BOUNDARY_STATE: '#64748b',
  BOUNDARY_DISTRICT: '#94a3b8',

  // Road Network Hierarchy (Deep slate casings with crisp warm-white centers for depth)
  ROAD_MOTORWAY: '#ffffff',
  ROAD_MOTORWAY_CASING: '#2d3748',
  ROAD_TRUNK: '#ffffff',
  ROAD_TRUNK_CASING: '#4a5568',
  ROAD_PRIMARY: '#ffffff',
  ROAD_PRIMARY_CASING: '#64748b',
  ROAD_SECONDARY: '#ffffff',
  ROAD_SECONDARY_CASING: '#94a3b8',
  ROAD_TERTIARY: '#ffffff',
  ROAD_TERTIARY_CASING: '#cbd5e1',
  ROAD_RESIDENTIAL: '#ffffff',
  ROAD_RESIDENTIAL_CASING: '#e2e8f0',
  ROAD_PATH: '#94a3b8',
  ROAD_TUNNEL_CASING: '#64748b',

  // Typography & Labels (High-contrast slate-900 / slate-800 with crisp 2px white halos)
  LABEL_CITY: '#0f172a',
  LABEL_TOWN: '#1e293b',
  LABEL_LOCALITY: '#334155',
  LABEL_SUBURB: '#475569',
  LABEL_ROAD: '#334155',
  LABEL_WATER: '#1e5380',
  LABEL_PARK: '#1b5e20',
  LABEL_HALO: '#ffffff',

  // POI & Infrastructure Colors (High readability operational markers)
  POI_EMERGENCY: '#b91c1c',
  POI_HOSPITAL: '#b91c1c',
  POI_POLICE: '#1d4ed8',
  POI_FIRE: '#c2410c',
  POI_TRANSIT: '#0369a1',
  POI_AIRPORT: '#0f172a',
  POI_CIVIC: '#334155',
  POI_COMMERCIAL: '#475569',

  // Dark Theme Cartography Palette
  DARK_LAND: '#0b1120',
  DARK_LAND_ALTERNATE: '#111827',
  DARK_URBAN: '#1e293b',
  DARK_WATER: '#0c2438',
  DARK_WATER_LINE: '#38bdf8',
  DARK_BUILDING: '#1e293b',
  DARK_BUILDING_STROKE: '#334155',
  DARK_ROAD_PRIMARY: '#334155',
  DARK_LABEL_PRIMARY: '#f8fafc',
  DARK_LABEL_HALO: '#0b1120',
})

// Dedicated RESQ Risk Color System (Foreground emergency intelligence)
// Used consistently across risk grid, event markers, panel meters, and legends
export const RESQ_RISK_COLORS = Object.freeze({
  LOW: {
    key: 'LOW',
    label: 'Low',
    color: '#10b981',
    fillRgba: 'rgba(16, 185, 129, 0.16)',
    lineRgba: 'rgba(16, 185, 129, 0.0)',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    description: 'Safe / Baseline Conditions',
  },
  MODERATE: {
    key: 'MODERATE',
    label: 'Moderate',
    color: '#f59e0b',
    fillRgba: 'rgba(245, 158, 11, 0.24)',
    lineRgba: 'rgba(245, 158, 11, 0.55)',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    description: 'Caution / Moderate Susceptibility',
  },
  HIGH: {
    key: 'HIGH',
    label: 'High',
    color: '#ea580c',
    fillRgba: 'rgba(234, 88, 12, 0.35)',
    lineRgba: 'rgba(234, 88, 12, 0.85)',
    badgeBg: '#fff7ed',
    badgeBorder: '#fed7aa',
    description: 'Danger / Heightened Risk',
  },
  CRITICAL: {
    key: 'CRITICAL',
    label: 'Critical',
    color: '#dc2626',
    fillRgba: 'rgba(220, 38, 38, 0.48)',
    lineRgba: 'rgba(220, 38, 38, 0.95)',
    badgeBg: '#fef2f2',
    badgeBorder: '#fecaca',
    description: 'Emergency / Direct Hazards',
  },
})

// Disaster Event Color Tokens by Hazard Type
export const RESQ_EVENT_COLORS = Object.freeze({
  FLASH_FLOOD: '#2563eb',
  FLOOD: '#0284c7',
  LANDSLIDE: '#b45309',
  EARTHQUAKE: '#7c3aed',
  BRIDGE_CLOSURE: '#dc2626',
  ROAD_BLOCKAGE: '#ea580c',
  SEVERE_RAINFALL: '#0369a1',
  DEFAULT: '#dc2626',
})

// Future Route Style Presets
export const RESQ_ROUTE_PRESETS = Object.freeze({
  SAFE: {
    casingColor: '#1d4ed8',
    casingWidth: 8,
    fillColor: '#3b82f6',
    fillWidth: 5,
    glowColor: 'rgba(59, 130, 246, 0.3)',
  },
  WARNING: {
    casingColor: '#b45309',
    casingWidth: 8,
    fillColor: '#f59e0b',
    fillWidth: 5,
    glowColor: 'rgba(245, 158, 11, 0.3)',
  },
  BLOCKED: {
    casingColor: '#991b1b',
    casingWidth: 8,
    fillColor: '#dc2626',
    fillWidth: 5,
    glowColor: 'rgba(220, 38, 38, 0.4)',
  },
})

export default {
  RESQ_PALETTE,
  RESQ_RISK_COLORS,
  RESQ_EVENT_COLORS,
  RESQ_ROUTE_PRESETS,
}
