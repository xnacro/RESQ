import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './app/authContext.jsx'
import { ProtectedRoute } from './app/ProtectedRoute.jsx'
import { AppShell } from './app/AppShell.jsx'
import LoginView from './views/LoginView.jsx'
import MapView from './views/MapView.jsx'
import AboutView from './views/AboutView.jsx'
import AdminView from './views/AdminView.jsx'
import UnauthorizedView from './views/UnauthorizedView.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Gate */}
          <Route path="/login" element={<LoginView initialMode="login" />} />
          <Route path="/signup" element={<LoginView initialMode="register" />} />
          <Route path="/forgot-password" element={<LoginView initialMode="forgot" />} />
          <Route path="/reset-password" element={<LoginView initialMode="reset" />} />

          {/* Protected Command Center (Default View) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <MapView />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Protected Strategic About View */}
          <Route
            path="/about"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AboutView />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Console (Role: ADMIN only) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AppShell>
                  <AdminView />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* 403 Forbidden Access State */}
          <Route
            path="/unauthorized"
            element={
              <ProtectedRoute>
                <AppShell>
                  <UnauthorizedView />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
