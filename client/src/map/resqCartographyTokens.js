// Centralized RESQ Cartographic Palette and Visual Tokens
// Defines consistent palettes for basemap geometry, typography, risk states, and operational overlays

export const RESQ_PALETTE = Object.freeze({
  // Land & Surface (Crisp, clean neutral baseline)
  LAND: '#f8fafc',
  LAND_ALTERNATE: '#f1f5f9',
  URBAN: '#e2e8f0',
  PARK: '#dcfce7',
  FOREST: '#d1fae5',
  SAND: '#fef3c7',

  // Water & Rivers (Crisp, distinct blue for flood intelligence)
  WATER: '#dbeafe',
  WATER_DEEP: '#bfdbfe',
  WATER_LINE: '#0284c7',
  WATER_STREAM: '#38bdf8',

  // Buildings & Footprints
  BUILDING: '#ffffff',
  BUILDING_STROKE: '#cbd5e1',
  BUILDING_3D_LOW: '#e2e8f0',
  BUILDING_3D_MID: '#cbd5e1',
  BUILDING_3D_HIGH: '#94a3b8',

  // Administrative Boundaries
  BOUNDARY_COUNTRY: '#475569',
  BOUNDARY_STATE: '#64748b',
  BOUNDARY_DISTRICT: '#94a3b8',

  // Road Network Hierarchy (Crisp slate casing and bright fills)
  ROAD_MOTORWAY: '#ffffff',
  ROAD_MOTORWAY_CASING: '#334155',
  ROAD_TRUNK: '#ffffff',
  ROAD_TRUNK_CASING: '#475569',
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

  // Typography & Labels (High contrast slate-900 / slate-800 with crisp 1.5px white halos)
  LABEL_CITY: '#0f172a',
  LABEL_TOWN: '#1e293b',
  LABEL_LOCALITY: '#334155',
  LABEL_SUBURB: '#475569',
  LABEL_ROAD: '#334155',
  LABEL_WATER: '#0369a1',
  LABEL_PARK: '#15803d',
  LABEL_HALO: '#ffffff',

  // POI & Infrastructure Colors (High readability operational markers)
  POI_EMERGENCY: '#dc2626',
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
    fillRgba: 'rgba(16, 185, 129, 0.10)',
    lineRgba: 'rgba(16, 185, 129, 0.0)',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    description: 'Safe / Baseline Conditions',
  },
  MODERATE: {
    key: 'MODERATE',
    label: 'Moderate',
    color: '#f59e0b',
    fillRgba: 'rgba(245, 158, 11, 0.22)',
    lineRgba: 'rgba(245, 158, 11, 0.50)',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    description: 'Caution / Moderate Susceptibility',
  },
  HIGH: {
    key: 'HIGH',
    label: 'High',
    color: '#ea580c',
    fillRgba: 'rgba(234, 88, 12, 0.35)',
    lineRgba: 'rgba(234, 88, 12, 0.80)',
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
