// TopBar navigation header with live search auto-complete, status, and emergency actions
import { useState, useEffect, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Search, Siren, Bell, MapPin, Navigation, Landmark, Building2, Droplets, X } from 'lucide-react'
import { Button, TextField, Badge } from '../ui/index.js'
import { cx } from '../lib/cx.js'
import { BrandMark } from './BrandMark.jsx'
import { searchGeocode } from '../services/api.js'
import styles from './TopBar.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Map', end: true },
  { to: '/about', label: 'About', end: false },
]

export function TopBar({ onSosOpen, showSearch = true, onSelectPlace }) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchWrapperRef = useRef(null)

  // Debounced geocoding search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setCandidates([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const results = await searchGeocode(query)
      setCandidates(results)
      setIsOpen(results.length > 0)
      setIsSearching(false)
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
        </nav>

        <button type="button" className={styles.iconBtn} aria-label="Notifications" title="Disaster Bulletins">
          <Bell size={17} />
          <span className={styles.alertDot} />
        </button>

        <Button variant="emergency" icon={Siren} onClick={onSosOpen} className={styles.sos}>
          <span className={styles.sosLabel}>RESQ SOS</span>
        </Button>
      </div>
    </header>
  )
}
