import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar.jsx'
import styles from './AppShell.module.css'

// Persistent chrome around every view. The SOS overlay layer is added in F6.
export function AppShell({ children }) {
  const location = useLocation()
  const isMap = location.pathname === '/'

  return (
    <div className={styles.shell}>
      <TopBar showSearch={isMap} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
