// Hook for RESQ Mode Session Lifecycle Management and LocalStorage Synchronization
import { useState, useEffect, useCallback } from 'react'
import {
  startResqSession,
  stopResqSession,
  getActiveResqSession,
  getResqSessionById,
} from '../services/resqApi.js'
import { useAuth } from '../app/authContext.jsx'

const STORAGE_KEY = 'resq_active_session'

export function useResqMode() {
  const { isAuthenticated } = useAuth()
  const [session, setSession] = useState(null)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // 1. Recover Active Session on Mount
  useEffect(() => {
    let isCancelled = false

    const recoverSession = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // First check server for user's active session
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

        // Fallback: check localStorage for saved session ID
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

  // 2. Start a new RESQ Safety Session
  const startSession = useCallback(
    async ({ safetyTimerMinutes = 30, trustedContacts = [] } = {}) => {
      setIsLoading(true)
      setError(null)

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

  // 3. Stop active RESQ Safety Session
  const stopSession = useCallback(async () => {
    if (!session || !session.session_id) return

    setIsLoading(true)
    setError(null)

    try {
      await stopResqSession(session.session_id)
      localStorage.removeItem(STORAGE_KEY)
      setSession(null)
      setIsActive(false)
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
    startSession,
    stopSession,
    setSession,
  }
}

export default useResqMode
