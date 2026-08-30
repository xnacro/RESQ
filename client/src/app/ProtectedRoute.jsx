// Protected Route Gate enforcing authentication and RBAC for RESQ
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './authContext.jsx'
import { BrandMark } from './BrandMark.jsx'
import styles from './ProtectedRoute.module.css'

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, role } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.loaderCard}>
          <div className={styles.brandHeader}>
            <BrandMark size={28} />
            <span className={styles.brandName}>RESQ</span>
          </div>

          <div className={styles.spinnerWrapper}>
            <div className={styles.spinner} />
          </div>

          <h2 className={styles.title}>Initializing Secure Command Center...</h2>

          <ul className={styles.checklist}>
            <li className={styles.checkItem}>
              <span className={styles.pulseDot} />
              <span>Authentication Gateway</span>
            </li>
            <li className={styles.checkItem}>
              <span className={styles.pulseDot} />
              <span>Operations Routing Network</span>
            </li>
            <li className={styles.checkItem}>
              <span className={styles.pulseDot} />
              <span>Intelligence & Hazard Layer</span>
            </li>
          </ul>
        </div>
      </div>
    )
  }

  // Not signed in -> send to login page, remember attempt location
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Signed in, but role is insufficient for this route
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
