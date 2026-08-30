// Hook for RESQ Mode Session Lifecycle, Live GPS Tracking, 500m Grid, Risk, and Safety Timer
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  startResqSession,
  stopResqSession,
  getActiveResqSession,
  getResqSessionById,
  updateResqSessionLocation,
  checkInResqSession,
  updateResqSessionTimer,
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

  // Safety Timer States
  const [timeRemainingMs, setTimeRemainingMs] = useState(0)
  const [isCheckInPending, setIsCheckInPending] = useState(false)

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

  // 2. Continuous 1-Second Timer Countdown Loop
  useEffect(() => {
    if (!isActive || !session || !session.timer_expires_at) {
      setTimeRemainingMs(0)
      return
    }

    const updateTimer = () => {
      const expiresAt = new Date(session.timer_expires_at).getTime()
      const remaining = Math.max(0, expiresAt - Date.now())
      setTimeRemainingMs(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [isActive, session?.timer_expires_at])

  // 3. Throttled Server Location Sync Function
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

  // 4. Start Browser GPS watchPosition when Session is Active
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

      setLiveLocation(currentGps)
      syncLocationWithServer(pos.coords, sessionId)
    }

    const onPositionError = (err) => {
      console.warn('Geolocation watch error, using demo fallback:', err.message)
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

    navigator.geolocation.getCurrentPosition(onPositionSuccess, onPositionError, watchOptions)
    const id = navigator.geolocation.watchPosition(onPositionSuccess, onPositionError, watchOptions)
    watchIdRef.current = id

    return () => {
      if (id !== null) {
        navigator.geolocation.clearWatch(id)
      }
      watchIdRef.current = null
    }
  }, [isActive, sessionId, syncLocationWithServer])

  // 5. User Safety Check-in Action
  const checkIn = useCallback(async () => {
    if (!sessionId) return

    setIsCheckInPending(true)
    setError(null)

    try {
      const res = await checkInResqSession(sessionId)
      if (res && res.session) {
        setSession(res.session)
      }
      return res
    } catch (err) {
      setError(err.message || 'Check-in failed')
      throw err
    } finally {
      setIsCheckInPending(false)
    }
  }, [sessionId])

  // 6. Extend Safety Timer Action
  const extendTimer = useCallback(
    async (additionalMinutes) => {
      if (!sessionId || !session) return

      const currentMins = session.safety_timer_minutes || 30
      const newMins = currentMins + additionalMinutes

      try {
        const res = await updateResqSessionTimer({
          sessionId,
          safetyTimerMinutes: newMins,
        })
        if (res && res.session) {
          setSession(res.session)
        }
        return res
      } catch (err) {
        setError(err.message || 'Failed to extend safety timer')
        throw err
      }
    },
    [sessionId, session]
  )

  // 7. Start a new RESQ Safety Session
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

  // 8. Stop active RESQ Safety Session
  const stopSession = useCallback(async () => {
    if (!sessionId) return

    setIsLoading(true)
    setError(null)

    try {
      await stopResqSession(sessionId)
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
      setTimeRemainingMs(0)
    } catch (err) {
      setError(err.message || 'Failed to end RESQ Mode session')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  // Compute formatted timer string
  const totalSeconds = Math.floor(timeRemainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formattedTimeRemaining =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const isTimerWarning = timeRemainingMs > 0 && timeRemainingMs <= 5 * 60 * 1000
  const isTimerExpired = isActive && timeRemainingMs === 0 && session?.timer_expires_at

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
    timeRemainingMs,
    formattedTimeRemaining,
    isTimerWarning,
    isTimerExpired,
    isCheckInPending,
    checkIn,
    extendTimer,
    startSession,
    stopSession,
    setSession,
  }
}

export default useResqMode
