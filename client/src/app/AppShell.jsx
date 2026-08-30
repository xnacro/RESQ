import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar.jsx'
import { useRouteStore } from '../services/routeStore.js'
import styles from './AppShell.module.css'

// Persistent chrome around views, automatically hidden during fullscreen driving navigation
export function AppShell({ children }) {
  const location = useLocation()
  const { navigationMode } = useRouteStore()
  const isMap = location.pathname === '/'
  const isDriving = navigationMode === 'driving'

  return (
    <div className={styles.shell}>
      {!isDriving && <TopBar showSearch={isMap} />}
      <main className={styles.main}>{children}</main>
    </div>
  )
}
