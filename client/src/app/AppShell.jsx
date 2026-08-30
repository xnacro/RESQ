// Persistent chrome around views with mandatory in-dashboard modal authentication overlay

import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar.jsx'
import { useAuth } from './authContext.jsx'
import { useRouteStore } from '../services/routeStore.js'
import LoginView from '../views/LoginView.jsx'
import styles from './AppShell.module.css'

export function AppShell({ children }) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()
  const { navigationMode } = useRouteStore()
  const isMap = location.pathname === '/'
  const isDriving = navigationMode === 'driving'

  return (
    <div className={styles.shell}>
      {!isDriving && <TopBar showSearch={isMap} />}
      <main className={styles.main}>{children}</main>

      {/* Mandatory Authentication Overlay over Live Map Dashboard */}
      {!isLoading && !isAuthenticated && <LoginView />}
    </div>
  )
}

export default AppShell
