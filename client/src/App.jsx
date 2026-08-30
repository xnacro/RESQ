// Application Router configuration with in-dashboard authentication and protected administration console

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './app/authContext.jsx'
import { ProtectedRoute } from './app/ProtectedRoute.jsx'
import { AppShell } from './app/AppShell.jsx'
import MapView from './views/MapView.jsx'
import AboutView from './views/AboutView.jsx'
import AdminView from './views/AdminView.jsx'
import UnauthorizedView from './views/UnauthorizedView.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Main In-Dashboard Map Command Center (Directly Accessible) */}
          <Route
            path="/"
            element={
              <AppShell>
                <MapView />
              </AppShell>
            }
          />

          {/* Strategic About Overview */}
          <Route
            path="/about"
            element={
              <AppShell>
                <AboutView />
              </AppShell>
            }
          />

          {/* Protected Admin Command Console (Role: ADMIN only) */}
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
              <AppShell>
                <UnauthorizedView />
              </AppShell>
            }
          />

          {/* Catch-all redirect to main map dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
