// TopBar navigation header with live search auto-complete, status, and emergency actions
import { useState, useEffect, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Search, Siren, Bell, MapPin, Navigation, Landmark, Building2, Droplets, X } from 'lucide-react'
import { Button, TextField, Badge } from '../ui/index.js'
import { cx } from '../lib/cx.js'
import { BrandMark } from './BrandMark.jsx'
import { searchGeocode } from '../services/api.js'
import { useAuth } from './authContext.jsx'
import { UserProfileModal } from './UserProfileModal.jsx'
import styles from './TopBar.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Map', end: true },
  { to: '/about', label: 'About', end: false },
]

export function TopBar({ onSosOpen, showSearch = true, onSelectPlace }) {
  const { user, isAdmin } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const searchWrapperRef = useRef(null)

  // Debounced geocoding search
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return
    }

    const timer = setTimeout(async () => {
      const results = await searchGeocode(trimmed)
      setCandidates(results)
      setIsOpen(results.length > 0)
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSelect = (candidate) => {
    setQuery(candidate.name)
    setIsOpen(false)
    if (onSelectPlace) {
      onSelectPlace(candidate)
    }
    // Also trigger global place event for MapView
    window.dispatchEvent(new CustomEvent('resq:select-place', { detail: candidate }))
  }

  const getCategoryIcon = (category) => {
    if (category === 'BRIDGE_STRUCTURE') return Landmark
    if (category === 'HIGHWAY_CORRIDOR') return Navigation
    if (category === 'RIVER_BASIN') return Droplets
    if (category === 'DISTRICT') return Building2
    return MapPin
  }

  return (
    <header className={styles.bar}>
      <div className={styles.brandWrapper}>
        <Link to="/" className={styles.brand}>
          <BrandMark size={20} />
          <span className={styles.brandName}>RESQ</span>
        </Link>
        <div className={styles.liveBadge}>
          <span className={styles.liveDot} />
          <span className={styles.liveText}>LIVE</span>
        </div>
      </div>

      {showSearch && (
        <div ref={searchWrapperRef} className={styles.search}>
          <div className={styles.searchInner}>
            <TextField
              icon={Search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => candidates.length > 0 && setIsOpen(true)}
              placeholder="Search place, district, bridge, or grid ID (e.g. Guwahati, Boko, Saraighat, AS_00210744)"
              aria-label="Search location"
              controlClassName={styles.searchControl}
            />
            {query && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => {
                  setQuery('')
                  setCandidates([])
                  setIsOpen(false)
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Auto-complete dropdown */}
          {isOpen && (
            <div className={styles.dropdown} role="listbox">
              {candidates.map((c, idx) => {
                const Icon = getCategoryIcon(c.category)
                return (
                  <button
                    key={idx}
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => handleSelect(c)}
                    role="option"
                    aria-selected="false"
                  >
                    <div className={styles.itemIconCircle}>
                      <Icon size={14} />
                    </div>
                    <div className={styles.itemContent}>
                      <span className={styles.itemName}>{c.name}</span>
                      <span className={styles.itemMeta}>
                        {c.district ? `${c.district}, ${c.state || 'Assam'}` : c.state || 'Assam & Meghalaya'}
                      </span>
                    </div>
                    {c.riskStatus && (
                      <Badge
                        tone={
                          c.riskStatus === 'CRITICAL'
                            ? 'critical'
                            : c.riskStatus === 'HIGH'
                            ? 'high'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {c.riskStatus}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className={styles.right}>
        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
            >
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
            >
              Admin
            </NavLink>
          )}
        </nav>

        <button type="button" className={styles.iconBtn} aria-label="Notifications" title="Disaster Bulletins">
          <Bell size={17} />
          <span className={styles.alertDot} />
        </button>

        {/* User Profile Control */}
        {user && (
          <button
            type="button"
            className={styles.userControl}
            onClick={() => setIsProfileOpen(true)}
            title="Open Personnel Command Profile"
            aria-label="User Profile"
          >
            <div className={styles.userAvatarCircle}>
              {user.profile_photo ? (
                <img
                  src={user.profile_photo}
                  alt={user.name}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                user.name
                  ? user.name
                      .split(' ')
                      .filter(Boolean)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'US'
              )}
            </div>
            <div className={styles.userInfoCol}>
              <span className={styles.userNameHeader}>{user.name}</span>
              <span className={styles.userUsernameHeader}>
                {user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : user.role}
              </span>
            </div>
          </button>
        )}

        <Button variant="emergency" icon={Siren} onClick={onSosOpen} className={styles.sos}>
          <span className={styles.sosLabel}>RESQ SOS</span>
        </Button>
      </div>

      {/* Personnel Command Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </header>
  )
}
