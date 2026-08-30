// Centralized API Client Service for RESQ Disaster Intelligence
const API_BASE = '/api'

// Searches regional places, towns, districts, bridges, and grid IDs
export async function searchGeocode(query) {
  if (!query || !query.trim()) return []
  try {
    const res = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query.trim())}`)
    if (!res.ok) throw new Error(`Geocoding failed with status ${res.status}`)
    const json = await res.json()
    return json.candidates || []
  } catch (err) {
    console.error('Geocoding search error:', err.message)
    return []
  }
}

// Reverse point-to-grid lookup (PostGIS ST_Contains)
export async function getGridByPoint(lat, lon, state = null) {
  if (lat == null || lon == null) return null
  try {
    const url = state
      ? `${API_BASE}/grid/point?lat=${lat}&lon=${lon}&state=${encodeURIComponent(state)}`
      : `${API_BASE}/grid/point?lat=${lat}&lon=${lon}`
    const res = await fetch(url)
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Grid lookup failed with status ${res.status}`)
    }
    const json = await res.json()
    return json.data || null
  } catch (err) {
    console.error('Point-in-grid lookup error:', err.message)
    return null
  }
}

// Retrieves comprehensive static and dynamic risk explainability for a 500m grid cell
export async function getGridRiskBreakdown(gridId) {
  if (!gridId) return null
  try {
    const res = await fetch(`${API_BASE}/risk/grid/${encodeURIComponent(gridId)}`)
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Risk breakdown failed with status ${res.status}`)
    }
    const json = await res.json()
    return json.data || null
  } catch (err) {
    console.error('Risk breakdown error:', err.message)
    return null
  }
}

// Queries visible 500m risk grid cells inside the map viewport bounding box
export async function getViewportGrids(minLon, minLat, maxLon, maxLat, limit = 500) {
  try {
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`
    const res = await fetch(`${API_BASE}/grid/viewport?bbox=${bbox}&limit=${limit}`)
    if (!res.ok) throw new Error(`Viewport grid query failed with status ${res.status}`)
    const json = await res.json()
    return json.data || { type: 'FeatureCollection', features: [] }
  } catch (err) {
    console.error('Viewport grid query error:', err.message)
    return { type: 'FeatureCollection', features: [] }
  }
}

// Retrieves all currently active disaster events from RSS news & NLP extraction
export async function getActiveDisasterEvents() {
  try {
    const res = await fetch(`${API_BASE}/news/events/active`)
    if (!res.ok) throw new Error(`Active events query failed with status ${res.status}`)
    const json = await res.json()
    return json.data || []
  } catch (err) {
    console.error('Active events query error:', err.message)
    return []
  }
}

export default {
  searchGeocode,
  getGridByPoint,
  getGridRiskBreakdown,
  getViewportGrids,
  getActiveDisasterEvents,
}
