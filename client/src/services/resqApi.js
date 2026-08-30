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

// 6. User Safety Check-in (Resets safety countdown)
export async function checkInResqSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/checkin`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to check in')
    }
    return data
  } catch (err) {
    console.error('checkInResqSession error:', err.message)
    throw err
  }
}

// 7. Modify Safety Timer Countdown Interval
export async function updateResqSessionTimer({ sessionId, safetyTimerMinutes }) {
  try {
    const res = await fetch(`${API_BASE}/timer/update`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, safetyTimerMinutes }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update timer')
    }
    return data
  } catch (err) {
    console.error('updateResqSessionTimer error:', err.message)
    throw err
  }
}

// 8. Trigger Emergency SOS Dispatch
export async function dispatchResqSessionSos({
  sessionId,
  emergencyType = 'GENERAL_DISTRESS',
  notes = '',
}) {
  try {
    const res = await fetch(`${API_BASE}/sos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, emergencyType, notes }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch SOS')
    }
    return data
  } catch (err) {
    console.error('dispatchResqSessionSos error:', err.message)
    throw err
  }
}

// 9. Cancel / Resolve Active Emergency SOS
export async function cancelResqSessionSos({ sessionId, reason = 'Resolved' }) {
  try {
    const res = await fetch(`${API_BASE}/sos/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, reason }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to cancel SOS')
    }
    return data
  } catch (err) {
    console.error('cancelResqSessionSos error:', err.message)
    throw err
  }
}

// 10. Fetch Live Telemetry Snapshot for Trusted Monitor Viewer (Public Link)
export async function getResqSessionTelemetry(sessionId) {
  if (!sessionId) return null
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(sessionId)}/telemetry`)
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Telemetry request failed with status ${res.status}`)
    }
    const data = await res.json()
    return data
  } catch (err) {
    console.error('getResqSessionTelemetry error:', err.message)
    return null
  }
}

// 11. Register Trusted Viewer Heartbeat
export async function registerResqTracker(sessionId, trackerName = 'Trusted Monitor') {
  if (!sessionId) return null
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(sessionId)}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackerName }),
    })
    return await res.json()
  } catch (err) {
    console.warn('registerResqTracker warning:', err.message)
    return null
  }
}

// 12. Attach Travel Route to Session for Corridor Risk Monitoring
export async function attachResqSessionRoute({
  sessionId,
  origin,
  destination,
  routeGeometry,
  distanceM,
  durationS,
  routeId,
}) {
  try {
    const res = await fetch(`${API_BASE}/route/attach`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sessionId,
        origin,
        destination,
        routeGeometry,
        distanceM,
        durationS,
        routeId,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to attach route')
    }
    return data
  } catch (err) {
    console.error('attachResqSessionRoute error:', err.message)
    throw err
  }
}

// 13. Detach Travel Route from Session
export async function detachResqSessionRoute(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/route/detach`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to detach route')
    }
    return data
  } catch (err) {
    console.error('detachResqSessionRoute error:', err.message)
    throw err
  }
}

// 14. Execute Corridor Reroute for Active Session
export async function executeResqSessionReroute(sessionId, currentPosition = null) {
  try {
    const res = await fetch(`${API_BASE}/route/reroute`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, currentPosition }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to execute reroute')
    }
    return data
  } catch (err) {
    console.error('executeResqSessionReroute error:', err.message)
    throw err
  }
}

export default {
  startResqSession,
  stopResqSession,
  getActiveResqSession,
  getResqSessionById,
  updateResqSessionLocation,
  checkInResqSession,
  updateResqSessionTimer,
  dispatchResqSessionSos,
  cancelResqSessionSos,
  getResqSessionTelemetry,
  registerResqTracker,
  attachResqSessionRoute,
  detachResqSessionRoute,
  executeResqSessionReroute,
}
