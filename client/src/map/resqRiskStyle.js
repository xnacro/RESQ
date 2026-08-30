// Reusable data-driven MapLibre style expressions for RESQ risk layers and event overlays
import { RESQ_RISK_COLORS, RESQ_EVENT_COLORS, RESQ_ROUTE_PRESETS } from './resqCartographyTokens.js'

// Returns data-driven fill paint expression for 500m risk grids
export function getRiskFillStyle() {
  return {
    'fill-color': [
      'match',
      ['get', 'risk_status'],
      'CRITICAL', RESQ_RISK_COLORS.CRITICAL.fillRgba,
      'HIGH', RESQ_RISK_COLORS.HIGH.fillRgba,
      'MODERATE', RESQ_RISK_COLORS.MODERATE.fillRgba,
      'rgba(0, 0, 0, 0)',
    ],
    'fill-opacity': 0.85,
  }
}

// Returns data-driven line paint expression for 500m risk grids (No heavy border for LOW)
export function getRiskOutlineStyle() {
  return {
    'line-color': [
      'match',
      ['get', 'risk_status'],
      'CRITICAL', RESQ_RISK_COLORS.CRITICAL.color,
      'HIGH', RESQ_RISK_COLORS.HIGH.color,
      'MODERATE', RESQ_RISK_COLORS.MODERATE.color,
      'rgba(0, 0, 0, 0)',
    ],
    'line-width': [
      'match',
      ['get', 'risk_status'],
      'CRITICAL', 1.25,
      'HIGH', 1.0,
      'MODERATE', 0.6,
      0,
    ],
    'line-opacity': 0.8,
  }
}

// Returns selected user grid highlight fill paint expression
export function getSelectedGridFillStyle() {
  return {
    'fill-color': [
      'match',
      ['get', 'risk_status'],
      'CRITICAL', 'rgba(220, 38, 38, 0.35)',
      'HIGH', 'rgba(234, 88, 12, 0.30)',
      'MODERATE', 'rgba(245, 158, 11, 0.25)',
      'rgba(37, 99, 235, 0.18)',
    ],
    'fill-opacity': 0.9,
  }
}

// Returns selected user grid highlight line paint expression
export function getSelectedGridOutlineStyle() {
  return {
    'line-color': '#2563eb',
    'line-width': 2.5,
    'line-opacity': 1,
  }
}

// Returns active disaster event marker circle paint expressions
export function getEventCirclePaint() {
  return {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      8, 6,
      12, 9,
      15, 13,
    ],
    'circle-color': [
      'match',
      ['get', 'hazard_type'],
      'FLASH_FLOOD', RESQ_EVENT_COLORS.FLASH_FLOOD,
      'FLOOD', RESQ_EVENT_COLORS.FLOOD,
      'LANDSLIDE', RESQ_EVENT_COLORS.LANDSLIDE,
      'EARTHQUAKE', RESQ_EVENT_COLORS.EARTHQUAKE,
      'BRIDGE_CLOSURE', RESQ_EVENT_COLORS.BRIDGE_CLOSURE,
      'ROAD_BLOCKAGE', RESQ_EVENT_COLORS.ROAD_BLOCKAGE,
      'SEVERE_RAINFALL', RESQ_EVENT_COLORS.SEVERE_RAINFALL,
      RESQ_EVENT_COLORS.DEFAULT,
    ],
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.95,
  }
}

// Returns prepared route style layer configs
export function getRouteLayerStyles() {
  return {
    casing: {
      'line-color': RESQ_ROUTE_PRESETS.SAFE.casingColor,
      'line-width': RESQ_ROUTE_PRESETS.SAFE.casingWidth,
      'line-opacity': 0.9,
    },
    fill: {
      'line-color': RESQ_ROUTE_PRESETS.SAFE.fillColor,
      'line-width': RESQ_ROUTE_PRESETS.SAFE.fillWidth,
      'line-opacity': 1,
    },
  }
}

export default {
  getRiskFillStyle,
  getRiskOutlineStyle,
  getSelectedGridFillStyle,
  getSelectedGridOutlineStyle,
  getEventCirclePaint,
  getRouteLayerStyles,
}
