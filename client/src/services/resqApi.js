// RESQ Mode API Client for Session Lifecycle, Live Tracking, and Safety Operations
const API_BASE = '/api/resq/session'

// Helper to get authorization headers
function getAuthHeaders() {
  const token = localStorage.getItem('resq_auth_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// 1. Start a new RESQ Mode Safety Session
export async function startResqSession({
  safetyTimerMinutes = 30,
  trustedContacts = [],
  metadata = {},
} = {}) {
  try {
    const res = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        safetyTimerMinutes,
        trustedContacts,
        metadata,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to start RESQ Mode session')
    }
    return data
  } catch (err) {
    console.error('startResqSession error:', err.message)
    throw err
  }
}

// 2. Stop an active RESQ Mode Safety Session
export async function stopResqSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to stop RESQ Mode session')
    }
    return data
  } catch (err) {
    console.error('stopResqSession error:', err.message)
    throw err
  }
}

// 3. Get Active Session for the Authenticated User
export async function getActiveResqSession() {
  try {
    const res = await fetch(`${API_BASE}/active/me`, {
      headers: getAuthHeaders(),
    })

    if (!res.ok) {
      if (res.status === 401) return null
      throw new Error(`Failed with status ${res.status}`)
    }
    const data = await res.json()
    return data.session || null
  } catch (err) {
    console.error('getActiveResqSession error:', err.message)
    return null
  }
}

// 4. Get Session Details by Session ID
export async function getResqSessionById(sessionId) {
  if (!sessionId) return null
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(sessionId)}`)
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Failed with status ${res.status}`)
    }
    const data = await res.json()
    return data.session || null
  } catch (err) {
    console.error('getResqSessionById error:', err.message)
    return null
  }
}

// 5. Update Session Location and Retrieve Real-time 500m Grid Risk
export async function updateResqSessionLocation({
  sessionId,
  lat,
  lon,
  accuracy = 10,
  speed = 0,
  heading = 0,
}) {
  try {
    const res = await fetch(`${API_BASE}/location`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sessionId,
        lat,
        lon,
        accuracy,
        speed,
        heading,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update session location')
    }
    return data
  } catch (err) {
    console.error('updateResqSessionLocation error:', err.message)
    throw err
  }
}

export default {
  startResqSession,
  stopResqSession,
  getActiveResqSession,
  getResqSessionById,
  updateResqSessionLocation,
}
