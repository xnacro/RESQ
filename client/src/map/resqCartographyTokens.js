// Centralized RESQ Cartographic Palette and Visual Tokens
// Defines consistent palettes for basemap geometry, typography, risk states, and operational overlays

export const RESQ_PALETTE = Object.freeze({
  // Land & Surface (Ultra-calm, paper-like neutral baseline)
  LAND: '#fbfcfd',
  LAND_ALTERNATE: '#f4f6f8',
  URBAN: '#f0f3f6',
  PARK: '#eef6f0',
  FOREST: '#e5f2e8',
  SAND: '#fbf7ed',

  // Water & Rivers (Calm, readable for flood intelligence)
  WATER: '#e3edf7',
  WATER_DEEP: '#d0e2f2',
  WATER_LINE: '#7aa2c7',
  WATER_STREAM: '#9dbddc',

  // Buildings & Footprints (Invisible at low zoom, clean subtle outlines at high zoom)
  BUILDING: '#ffffff',
  BUILDING_STROKE: '#e8ecf1',
  BUILDING_3D_LOW: '#e2e8f0',
  BUILDING_3D_MID: '#cbd5e1',
  BUILDING_3D_HIGH: '#94a3b8',

  // Administrative Boundaries (Understated, non-competing)
  BOUNDARY_COUNTRY: '#64748b',
  BOUNDARY_STATE: '#94a3b8',
  BOUNDARY_DISTRICT: '#cbd5e1',

  // Road Network Hierarchy (Neutral, slate, white hierarchy; no strong orange/yellow)
  ROAD_MOTORWAY: '#ffffff',
  ROAD_MOTORWAY_CASING: '#7c8ba1',
  ROAD_TRUNK: '#ffffff',
  ROAD_TRUNK_CASING: '#94a3b8',
  ROAD_PRIMARY: '#ffffff',
  ROAD_PRIMARY_CASING: '#b8c4d4',
  ROAD_SECONDARY: '#ffffff',
  ROAD_SECONDARY_CASING: '#d1dbe6',
  ROAD_TERTIARY: '#ffffff',
  ROAD_TERTIARY_CASING: '#e2e8f0',
  ROAD_RESIDENTIAL: '#ffffff',
  ROAD_RESIDENTIAL_CASING: '#f1f5f9',
  ROAD_PATH: '#cbd5e1',
  ROAD_TUNNEL_CASING: '#94a3b8',

  // Typography & Labels (High contrast, crisp halos, reduced visual clutter)
  LABEL_CITY: '#0f172a',
  LABEL_TOWN: '#1e293b',
  LABEL_LOCALITY: '#475569',
  LABEL_SUBURB: '#64748b',
  LABEL_ROAD: '#475569',
  LABEL_WATER: '#2d6a9f',
  LABEL_PARK: '#2e7d32',
  LABEL_HALO: '#ffffff',

  // Dark Theme Cartography Palette
  DARK_LAND: '#0b1120',
  DARK_LAND_ALTERNATE: '#111827',
  DARK_URBAN: '#1e293b',
  DARK_WATER: '#0c2438',
  DARK_WATER_LINE: '#1e4976',
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
    fillRgba: 'rgba(16, 185, 129, 0.08)',
    lineRgba: 'rgba(16, 185, 129, 0.0)',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    description: 'Safe / Baseline Conditions',
  },
  MODERATE: {
    key: 'MODERATE',
    label: 'Moderate',
    color: '#f59e0b',
    fillRgba: 'rgba(245, 158, 11, 0.20)',
    lineRgba: 'rgba(245, 158, 11, 0.45)',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    description: 'Caution / Moderate Susceptibility',
  },
  HIGH: {
    key: 'HIGH',
    label: 'High',
    color: '#ea580c',
    fillRgba: 'rgba(234, 88, 12, 0.32)',
    lineRgba: 'rgba(234, 88, 12, 0.75)',
    badgeBg: '#fff7ed',
    badgeBorder: '#fed7aa',
    description: 'Danger / Heightened Risk',
  },
  CRITICAL: {
    key: 'CRITICAL',
    label: 'Critical',
    color: '#dc2626',
    fillRgba: 'rgba(220, 38, 38, 0.45)',
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
