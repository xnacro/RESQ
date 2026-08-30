// TopBar navigation header with search, live status, and emergency actions
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Search, Siren, Bell, Shield, Radio } from 'lucide-react'
import { Button, TextField } from '../ui/index.js'
import { cx } from '../lib/cx.js'
import { BrandMark } from './BrandMark.jsx'
import styles from './TopBar.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Map', end: true },
  { to: '/about', label: 'About', end: false },
]

export function TopBar({ onSosOpen, showSearch = true, onSearchSubmit, onSearchChange, searchValue = '' }) {
  const [query, setQuery] = useState(searchValue)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit(query)
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (onSearchChange) onSearchChange(val)
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
        <div className={styles.search}>
          <TextField
            icon={Search}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search place, district, bridge, or grid ID (e.g. Guwahati, Boko, AS_00239973)"
            aria-label="Search location"
            controlClassName={styles.searchControl}
          />
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
