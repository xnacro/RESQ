// Location and Geocoding Service Layer
const API_BASE = '/api'

// Geolocation configuration constants
export const GEOLOCATION_CONFIG = Object.freeze({
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 30000,
})

// Geolocation UI state enum
export const GEOLOCATION_STATE = Object.freeze({
  INITIAL: 'INITIAL',
  LOCATING: 'LOCATING',
  LOCATED: 'LOCATED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
})

// Obtains the current device location from browser navigator.geolocation
export function getDeviceCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        state: GEOLOCATION_STATE.POSITION_UNAVAILABLE,
        message: 'Geolocation is not supported by your browser.',
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp,
        })
      },
      (err) => {
        let state = GEOLOCATION_STATE.ERROR
        if (err.code === err.PERMISSION_DENIED) {
          state = GEOLOCATION_STATE.PERMISSION_DENIED
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          state = GEOLOCATION_STATE.POSITION_UNAVAILABLE
        } else if (err.code === err.TIMEOUT) {
          state = GEOLOCATION_STATE.TIMEOUT
        }

        reject({
          state,
          code: err.code,
          message: err.message,
        })
      },
      GEOLOCATION_CONFIG
    )
  })
}

// Searches regional places, towns, districts, bridges, and grid IDs
export async function searchLocations(query) {
  if (!query || !query.trim()) return []
  try {
    const res = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query.trim())}`)
    if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`)
    const json = await res.json()
    return json.candidates || []
  } catch (err) {
    console.error('searchLocations error:', err.message)
    return []
  }
}

export default {
  GEOLOCATION_CONFIG,
  GEOLOCATION_STATE,
  getDeviceCoordinates,
  searchLocations,
}
