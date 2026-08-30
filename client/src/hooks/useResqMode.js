// Hook for RESQ Mode Session Lifecycle, Live GPS Tracking, 500m Grid, and Dynamic Risk Monitoring
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  startResqSession,
  stopResqSession,
  getActiveResqSession,
  getResqSessionById,
  updateResqSessionLocation,
} from '../services/resqApi.js'
import { useAuth } from '../app/authContext.jsx'

const STORAGE_KEY = 'resq_active_session'
const LOCATION_THROTTLE_MS = 8000
const DISTANCE_DELTA_METERS = 25

// Helper to compute haversine distance in meters
function computeDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function useResqMode() {
  const { isAuthenticated } = useAuth()
  const [session, setSession] = useState(null)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Live Tracking & Risk States
  const [liveLocation, setLiveLocation] = useState(null)
  const [gridData, setGridData] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [activeEvents, setActiveEvents] = useState([])
  const [riskTransition, setRiskTransition] = useState(null)
  const [riskAlert, setRiskAlert] = useState(null)

  const watchIdRef = useRef(null)
  const lastServerUpdateRef = useRef(0)
  const lastRecordedLocationRef = useRef(null)

  // 1. Recover Active Session on Mount
  useEffect(() => {
    let isCancelled = false

    const recoverSession = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (isAuthenticated) {
          const serverSession = await getActiveResqSession()
          if (serverSession && serverSession.is_active && !isCancelled) {
            setSession(serverSession)
            setIsActive(true)
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ sessionId: serverSession.session_id, timestamp: Date.now() })
            )
            setIsLoading(false)
            return
          }
        }

        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.sessionId) {
            const fetched = await getResqSessionById(parsed.sessionId)
            if (fetched && fetched.is_active && !isCancelled) {
              setSession(fetched)
              setIsActive(true)
            } else {
              localStorage.removeItem(STORAGE_KEY)
              if (!isCancelled) {
                setSession(null)
                setIsActive(false)
              }
            }
          }
        }
      } catch (err) {
        console.warn('Session recovery error:', err.message)
        localStorage.removeItem(STORAGE_KEY)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    recoverSession()

    return () => {
      isCancelled = true
    }
  }, [isAuthenticated])

  // 2. Throttled Server Location Sync Function
  const syncLocationWithServer = useCallback(
    async (coords, sessionId) => {
      if (!sessionId || !coords) return

      const now = Date.now()
      const timeSinceLast = now - lastServerUpdateRef.current
      const lastLoc = lastRecordedLocationRef.current

      let movedDistance = 0
      if (lastLoc) {
        movedDistance = computeDistanceM(lastLoc.lat, lastLoc.lon, coords.latitude, coords.longitude)
      }

      // Check throttle threshold
      const isFirst = lastServerUpdateRef.current === 0
      const isTimeDue = timeSinceLast >= LOCATION_THROTTLE_MS
      const isDistanceDue = movedDistance >= DISTANCE_DELTA_METERS

      if (!isFirst && !isTimeDue && !isDistanceDue) {
        return
      }

      lastServerUpdateRef.current = now
      lastRecordedLocationRef.current = { lat: coords.latitude, lon: coords.longitude }

      try {
        const updateRes = await updateResqSessionLocation({
          sessionId,
          lat: coords.latitude,
          lon: coords.longitude,
          accuracy: coords.accuracy || 10,
          speed: coords.speed || 0,
          heading: coords.heading || 0,
        })

        if (updateRes && updateRes.success) {
          if (updateRes.session) setSession(updateRes.session)
          if (updateRes.grid) setGridData(updateRes.grid)
          if (updateRes.risk) setRiskData(updateRes.risk)
          if (updateRes.activeEvents) setActiveEvents(updateRes.activeEvents)
          if (updateRes.riskTransition) {
            setRiskTransition(updateRes.riskTransition)
            if (updateRes.riskTransition.isEscalation) {
              setRiskAlert({
                title: `Risk Escalated to ${updateRes.risk.riskStatus}`,
                reason: updateRes.activeEvents[0]?.news_title || 'Elevated hazards detected in your 500m corridor.',
                status: updateRes.risk.riskStatus,
                score: updateRes.risk.riskScore,
              })
            }
          }
        }
      } catch (err) {
        console.warn('Live location sync warning:', err.message)
      }
    },
    []
  )

  const sessionId = session?.session_id

  // 3. Start Browser GPS watchPosition when Session is Active
  useEffect(() => {
    if (!isActive || !sessionId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported in this browser environment')
      return
    }

    const onPositionSuccess = (pos) => {
      const { latitude, longitude, accuracy, speed, heading } = pos.coords
      const currentGps = {
        lat: latitude,
        lon: longitude,
        accuracy,
        speed: speed || 0,
        heading: heading || 0,
        timestamp: pos.timestamp || Date.now(),
      }

      // 1. Instant local UI coordinate update
      setLiveLocation(currentGps)

      // 2. Throttled server session & risk synchronization
      syncLocationWithServer(pos.coords, sessionId)
    }

    const onPositionError = (err) => {
      console.warn('Geolocation watch error, using demo fallback:', err.message)
      // Fallback demo coordinates in Guwahati center
      const fallbackCoords = {
        latitude: 26.1445,
        longitude: 91.7362,
        accuracy: 25,
        speed: 0,
        heading: 0,
      }
      setLiveLocation({
        lat: 26.1445,
        lon: 91.7362,
        accuracy: 25,
        speed: 0,
        heading: 0,
        timestamp: Date.now(),
      })
      syncLocationWithServer(fallbackCoords, sessionId)
    }

    const watchOptions = {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    }

    // Trigger immediate single position lookup
    navigator.geolocation.getCurrentPosition(onPositionSuccess, onPositionError, watchOptions)

    // Start continuous watch
    const id = navigator.geolocation.watchPosition(onPositionSuccess, onPositionError, watchOptions)
    watchIdRef.current = id

    return () => {
      if (id !== null) {
        navigator.geolocation.clearWatch(id)
      }
      watchIdRef.current = null
    }
  }, [isActive, sessionId, syncLocationWithServer])

  // 4. Start a new RESQ Safety Session
  const startSession = useCallback(
    async ({ safetyTimerMinutes = 30, trustedContacts = [] } = {}) => {
      setIsLoading(true)
      setError(null)
      lastServerUpdateRef.current = 0
      lastRecordedLocationRef.current = null

      try {
        const res = await startResqSession({
          safetyTimerMinutes,
          trustedContacts,
          metadata: {
            startedFrom: window.location.pathname,
            userAgent: navigator.userAgent,
          },
        })

        if (res && res.session) {
          setSession(res.session)
          setIsActive(true)
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ sessionId: res.session.session_id, timestamp: Date.now() })
          )
          return res.session
        }
        throw new Error('Invalid response starting session')
      } catch (err) {
        setError(err.message || 'Failed to start RESQ Mode')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 5. Stop active RESQ Safety Session
  const stopSession = useCallback(async () => {
    if (!session || !session.session_id) return

    setIsLoading(true)
    setError(null)

    try {
      await stopResqSession(session.session_id)
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      localStorage.removeItem(STORAGE_KEY)
      setSession(null)
      setIsActive(false)
      setLiveLocation(null)
      setGridData(null)
      setRiskData(null)
      setActiveEvents([])
      setRiskAlert(null)
    } catch (err) {
      setError(err.message || 'Failed to end RESQ Mode session')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [session])

  return {
    session,
    isActive,
    isLoading,
    error,
    liveLocation,
    gridData,
    riskData,
    activeEvents,
    riskTransition,
    riskAlert,
    setRiskAlert,
    startSession,
    stopSession,
    setSession,
  }
}

export default useResqMode
