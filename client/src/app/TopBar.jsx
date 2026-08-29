import { NavLink, Link } from 'react-router-dom'
import { Search, Siren } from 'lucide-react'
import { Button, TextField } from '../ui/index.js'
import { cx } from '../lib/cx.js'
import { BrandMark } from './BrandMark.jsx'
import styles from './TopBar.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Map', end: true },
  { to: '/about', label: 'About', end: false },
]

export function TopBar({ onSosOpen, showSearch = true }) {
  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.brand}>
        <BrandMark size={22} />
        <span className={styles.brandName}>resQ</span>
      </Link>

      {showSearch && (
        <div className={styles.search}>
          <TextField
            icon={Search}
            placeholder="Search any place, district or area in Assam and Meghalaya"
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

        <Button variant="emergency" icon={Siren} onClick={onSosOpen} className={styles.sos}>
          <span className={styles.sosLabel}>resQ SOS</span>
        </Button>
      </div>
    </header>
  )
}
