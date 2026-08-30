// Authentication State Context and Provider for RESQ Command Center
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'resq_auth_token'
const USER_KEY = 'resq_auth_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Validate stored session on initial mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken =
          localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
        const storedUserJson =
          localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)

        if (!storedToken) {
          setIsLoading(false)
          return
        }

        // Validate token with backend /api/auth/me
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          setToken(storedToken)
          setUser(data.user)
        } else {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setUser(null)
        }
      } catch (err) {
        console.warn('RESQ Auth restore error, using stored credentials if valid:', err)
        const storedToken =
          localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
        const storedUserJson =
          localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
        if (storedToken && storedUserJson) {
          try {
            setToken(storedToken)
            setUser(JSON.parse(storedUserJson))
          } catch {
            setToken(null)
            setUser(null)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  // Login handler supporting email, username, or mobile
  const login = useCallback(async (identifier, password, rememberMe = false) => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, rememberMe }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.')
      }

      setToken(data.token)
      setUser(data.user)

      // Storage selection based on rememberMe
      const storage = rememberMe ? localStorage : sessionStorage
      storage.setItem(TOKEN_KEY, data.token)
      storage.setItem(USER_KEY, JSON.stringify(data.user))

      const otherStorage = rememberMe ? sessionStorage : localStorage
      otherStorage.removeItem(TOKEN_KEY)
      otherStorage.removeItem(USER_KEY)

      return { success: true, user: data.user }
    } catch (err) {
      setAuthError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Register handler supporting step 1 & 2 fields
  const register = useCallback(async (registerData) => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.')
      }

      setToken(data.token)
      setUser(data.user)

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))

      return { success: true, user: data.user }
    } catch (err) {
      setAuthError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout handler
  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
      setAuthError(null)
    }
  }, [token])

  // Change password handler
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!token) throw new Error('Not authenticated')
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Password update failed.')
      }
      return data
    },
    [token]
  )

  // Auth Header helper for API requests
  const getAuthHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token && !!user,
    isLoading,
    authError,
    login,
    register,
    logout,
    changePassword,
    getAuthHeaders,
    isAdmin: user?.role === 'ADMIN',
    isOperator: user?.role === 'OPERATOR',
    isViewer: user?.role === 'VIEWER',
    canEdit: user?.role === 'ADMIN' || user?.role === 'OPERATOR',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
