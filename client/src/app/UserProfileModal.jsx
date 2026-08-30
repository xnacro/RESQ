// User Profile and Security Drawer for RESQ
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import { X, LogOut, Settings, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from './authContext.jsx'
import styles from './UserProfileModal.module.css'

export function UserProfileModal({ isOpen, onClose }) {
  const { user, logout, changePassword, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwdStatus, setPwdStatus] = useState({ error: '', success: '' })
  const [changing, setChanging] = useState(false)

  if (!isOpen || !user || typeof document === 'undefined') return null

  // Compute initials (e.g. "Dr. Ananya Roy" -> "AR")
  const initials = user.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'US'

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPwdStatus({ error: '', success: '' })

    if (!currentPassword || !newPassword) {
      setPwdStatus({ error: 'Both password fields are required.', success: '' })
      return
    }

    if (newPassword.length < 8) {
      setPwdStatus({ error: 'New password must be at least 8 characters long.', success: '' })
      return
    }

    try {
      setChanging(true)
      await changePassword(currentPassword, newPassword)
      setPwdStatus({ error: '', success: 'Password changed successfully.' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPwdStatus({ error: err.message || 'Failed to update password.', success: '' })
    } finally {
      setChanging(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    onClose()
    navigate('/login', { replace: true })
  }

  const roleClass =
    user.role === 'ADMIN'
      ? styles.badgeAdmin
      : user.role === 'OPERATOR'
      ? styles.badgeOperator
      : styles.badgeViewer

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Personnel Command Profile">
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.headerTitle}>Personnel Command Profile</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close Profile">
            <X size={18} />
          </button>
        </header>

        <div className={styles.content}>
          {/* User Profile Hero Card */}
          <div className={styles.userHero}>
            <div className={styles.avatarBig}>
              {user.profile_photo ? (
                <img
                  src={user.profile_photo}
                  alt={user.name}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>
                {user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : user.email}
              </div>
              <div className={styles.roleBadgeRow}>
                <span className={`${styles.badge} ${roleClass}`}>{user.role}</span>
              </div>
            </div>
          </div>

          {/* Operational Status */}
          <div className={styles.section}>
            <h3 className={styles.sectionHeading}>Operational Status</h3>
            <div className={styles.infoCard}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoVal}>{user.email}</span>
              </div>
              {user.mobile && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Mobile</span>
                  <span className={styles.infoVal}>{user.mobile}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Department</span>
                <span className={styles.infoVal}>{user.department || 'Disaster Operations'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Account Status</span>
                <span className={styles.statusIndicator}>
                  <span className={styles.statusDot} />
                  Active Session
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Clearance Level</span>
                <span className={styles.infoVal}>
                  {user.role === 'ADMIN'
                    ? 'Level 3 — Command & Control'
                    : user.role === 'OPERATOR'
                    ? 'Level 2 — Field Operations'
                    : 'Level 1 — Tactical Observer'}
                </span>
              </div>
            </div>
          </div>

          {/* Admin shortcut if ADMIN */}
          {isAdmin && (
            <div className={styles.section}>
              <Link
                to="/admin"
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  color: '#1d4ed8',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Settings size={16} />
                <span>Open Admin User Management</span>
              </Link>
            </div>
          )}

          {/* Security Credentials */}
          <div className={styles.section}>
            <h3 className={styles.sectionHeading}>Security Credentials</h3>
            <form onSubmit={handlePasswordSubmit} className={styles.pwdForm}>
              {pwdStatus.error && (
                <div style={{ color: '#dc2626', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{pwdStatus.error}</span>
                </div>
              )}
              {pwdStatus.success && (
                <div style={{ color: '#059669', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} />
                  <span>{pwdStatus.success}</span>
                </div>
              )}
              <input
                type="password"
                className={styles.input}
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <input
                type="password"
                className={styles.input}
                placeholder="New Password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button type="submit" className={styles.pwdBtn} disabled={changing}>
                {changing ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out from Command Center</span>
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
