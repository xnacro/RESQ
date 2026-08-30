// Admin Management Console for RESQ
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../app/authContext.jsx'
import styles from './AdminView.module.css'

export default function AdminView() {
  const { getAuthHeaders, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/auth/users', {
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setNotice(`Updated role to ${newRole}`)
        setTimeout(() => setNotice(''), 3000)
        fetchUsers()
      } else {
        alert(data.error || 'Failed to update role')
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (res.ok) {
        setNotice(`Account status updated to ${nextStatus}`)
        setTimeout(() => setNotice(''), 3000)
        fetchUsers()
      } else {
        alert(data.error || 'Failed to update status')
      }
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>RESQ Command &amp; Access Control Center</h1>
        <p className={styles.subtitle}>
          System-wide personnel role assignment, active logistics monitoring, and mission oversight.
        </p>
      </header>

      {notice && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#ecfdf5',
            color: '#047857',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ✓ {notice}
        </div>
      )}

      {/* Operational Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Personnel</div>
          <div className={styles.metricValue}>{users.length || 3}</div>
          <div className={styles.metricSubtext}>3 Verified Demo Roles</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Active Convoys</div>
          <div className={styles.metricValue}>2</div>
          <div className={styles.metricSubtext}>Assam &amp; Meghalaya Corridors</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Active Hazards</div>
          <div className={styles.metricValue}>4</div>
          <div className={styles.metricSubtext}>Auto-fused in 500m Grid</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Command Status</div>
          <div className={styles.metricValue} style={{ color: '#10b981' }}>
            OPTIMAL
          </div>
          <div className={styles.metricSubtext}>Real-time routing live</div>
        </div>
      </div>

      {/* User Management Section */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Personnel Access Control &amp; Role Management</h2>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Personnel</th>
                <th className={styles.th}>Work Email</th>
                <th className={styles.th}>Security Role</th>
                <th className={styles.th}>Account Status</th>
                <th className={styles.th}>Last Login</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                    Loading personnel directory...
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id}>
                      <td className={styles.td}>
                        <div className={styles.userName}>{u.name}</div>
                        <div className={styles.userDept}>{u.department || 'Operations'}</div>
                      </td>
                      <td className={styles.td} style={{ fontFamily: 'monospace' }}>
                        {u.email}
                      </td>
                      <td className={styles.td}>
                        <select
                          className={styles.roleSelect}
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="OPERATOR">OPERATOR</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>
                      <td className={styles.td}>
                        {u.status === 'ACTIVE' ? (
                          <span className={styles.statusActive}>
                            <span
                              className={`${styles.statusDot} ${styles.statusDotActive}`}
                            />
                            ACTIVE
                          </span>
                        ) : (
                          <span className={styles.statusDisabled}>
                            <span
                              className={`${styles.statusDot} ${styles.statusDotDisabled}`}
                            />
                            DISABLED
                          </span>
                        )}
                      </td>
                      <td className={styles.td} style={{ color: '#64748b', fontSize: '12px' }}>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className={styles.td}>
                        {!isSelf && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${
                              u.status === 'ACTIVE'
                                ? styles.actionBtnDisable
                                : styles.actionBtnEnable
                            }`}
                            onClick={() => handleStatusToggle(u.id, u.status)}
                          >
                            {u.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
