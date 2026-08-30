// Risk Intelligence Service Layer
const API_BASE = '/api'

// Resolves a lat/lon coordinate point to its containing 500m grid cell with full static/dynamic risk and geometry
export async function getCurrentGridRisk(lat, lon) {
  if (lat == null || lon == null) return null
  try {
    const res = await fetch(`${API_BASE}/risk/point?lat=${lat}&lon=${lon}`)
    if (!res.ok) {
      if (res.status === 404) {
        const json = await res.json()
        return { inCoverage: false, message: json.message }
      }
      throw new Error(`Risk point lookup failed: HTTP ${res.status}`)
    }
    const json = await res.json()
    return { inCoverage: true, ...json.data }
  } catch (err) {
    console.error('getCurrentGridRisk error:', err.message)
    throw err
  }
}

// Retrieves complete static and dynamic risk explainability for a specific grid ID
export async function getGridRisk(gridId) {
  if (!gridId) return null
  try {
    const res = await fetch(`${API_BASE}/risk/grid/${encodeURIComponent(gridId)}`)
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Grid risk lookup failed: HTTP ${res.status}`)
    }
    const json = await res.json()
    return json.data || null
  } catch (err) {
    console.error('getGridRisk error:', err.message)
    throw err
  }
}

// Retrieves all currently active disaster events from RSS news & NLP extraction
export async function getActiveDisasterEvents() {
  try {
    const res = await fetch(`${API_BASE}/news/events/active`)
    if (!res.ok) throw new Error(`Active events query failed: HTTP ${res.status}`)
    const json = await res.json()
    return json.data || []
  } catch (err) {
    console.error('getActiveDisasterEvents error:', err.message)
    return []
  }
}

export default {
  getCurrentGridRisk,
  getGridRisk,
  getActiveDisasterEvents,
}
