import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Droplets, Navigation, Landmark, Truck } from 'lucide-react'
import { useAuth } from '../app/authContext.jsx'
import styles from './DamageReportModal.module.css'

const CATEGORIES = [
  { id: 'ROAD', label: 'Blocked Road', icon: Navigation },
  { id: 'FLOOD', label: 'Flood Surge', icon: Droplets },
  { id: 'BRIDGE', label: 'Damaged Bridge', icon: Landmark },
  { id: 'CONVOY', label: 'Relief Convoy', icon: Truck },
]

export function DamageReportModal({ isOpen, onClose, onSubmitted }) {
  const { getAuthHeaders } = useAuth()
  const [activeCategory, setActiveCategory] = useState('ROAD')
  const [locationText, setLocationText] = useState('Saraighat North Corridor')
  const [district, setDistrict] = useState('Kamrup Metropolitan')
  const [state, setState] = useState('Assam')
  const [severity, setSeverity] = useState(80)
  const [roadBlocked, setRoadBlocked] = useState(true)
  const [bridgeDamaged, setBridgeDamaged] = useState(false)
  const [bridgeClosed, setBridgeClosed] = useState(false)

  // Convoy specifics
  const [convoyCode, setConvoyCode] = useState('CONVOY-ECHO-07')
  const [origin, setOrigin] = useState('Guwahati Central Depot')
  const [destination, setDestination] = useState('Nongpoh Hub')
  const [cargoType, setCargoType] = useState('Water Purifiers, Dry Rations, Emergency Tarps')
  const [vehicles, setVehicles] = useState(3)

  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState({ error: '', success: '' })

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatusMsg({ error: '', success: '' })
    setSubmitting(true)

    try {
      if (activeCategory === 'CONVOY') {
        const res = await fetch('/api/damage/missions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            code: convoyCode,
            title: `Convoy to ${destination}`,
            origin,
            destination,
            cargoType,
            vehicles,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to dispatch mission')
        setStatusMsg({ error: '', success: data.message })
      } else {
        const payload = {
          eventType:
            activeCategory === 'ROAD'
              ? 'ROAD_BLOCKAGE'
              : activeCategory === 'FLOOD'
              ? 'FLOOD'
              : 'BRIDGE_DAMAGE',
          hazardType:
            activeCategory === 'ROAD'
              ? 'PHYSICAL_DEBRIS'
              : activeCategory === 'FLOOD'
              ? 'RIVER_OVERFLOW'
              : 'STRUCTURAL_CRACK',
          locationText,
          district,
          state,
          severity,
          roadBlocked: activeCategory === 'ROAD' ? roadBlocked : false,
          bridgeDamaged: activeCategory === 'BRIDGE' ? bridgeDamaged : false,
          bridgeClosed: activeCategory === 'BRIDGE' ? bridgeClosed : false,
        }

        const res = await fetch('/api/damage/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to submit damage report')
        setStatusMsg({ error: '', success: data.message })
      }

      if (onSubmitted) onSubmitted()
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      setStatusMsg({ error: err.message || 'Operation failed', success: '' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Field Operational Command Entry">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>Field Operational Command Entry</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {/* Action Category Selector */}
        <div className={styles.tabs}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id)
                  if (cat.id === 'BRIDGE') {
                    setBridgeDamaged(true)
                    setBridgeClosed(true)
                  }
                }}
              >
                <Icon size={16} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            {statusMsg.error && (
              <div style={{ color: '#dc2626', fontSize: '13px' }}>✕ {statusMsg.error}</div>
            )}
            {statusMsg.success && (
              <div style={{ color: '#059669', fontSize: '13px', fontWeight: 600 }}>
                ✓ {statusMsg.success}
              </div>
            )}

            {activeCategory === 'CONVOY' ? (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Convoy Call Sign</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={convoyCode}
                    onChange={(e) => setConvoyCode(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Origin Depot</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Destination Sector</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Convoy Vehicles</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className={styles.input}
                      value={vehicles}
                      onChange={(e) => setVehicles(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Supply Manifest</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={cargoType}
                      onChange={(e) => setCargoType(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Hazard Location / Landmark</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="e.g. NH-27 Corridor near Nongpoh"
                    required
                  />
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>District</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>State</label>
                    <select
                      className={styles.input}
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      <option value="Assam">Assam</option>
                      <option value="Meghalaya">Meghalaya</option>
                    </select>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Hazard Severity Level (1 - 100)</label>
                  <div className={styles.sliderWrapper}>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      className={styles.range}
                      value={severity}
                      onChange={(e) => setSeverity(Number(e.target.value))}
                    />
                    <span className={styles.rangeVal}>{severity}</span>
                  </div>
                </div>

                <div className={styles.toggleRow}>
                  {activeCategory === 'ROAD' && (
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={roadBlocked}
                        onChange={(e) => setRoadBlocked(e.target.checked)}
                      />
                      <span>Physical Road Closure (Impassable)</span>
                    </label>
                  )}

                  {activeCategory === 'BRIDGE' && (
                    <>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={bridgeDamaged}
                          onChange={(e) => setBridgeDamaged(e.target.checked)}
                        />
                        <span>Structural Scour / Damage</span>
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={bridgeClosed}
                          onChange={(e) => setBridgeClosed(e.target.checked)}
                        />
                        <span>Vehicular Traffic Suspended</span>
                      </label>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Transmitting...' : activeCategory === 'CONVOY' ? 'Dispatch Convoy' : 'Fuse Incident to Map'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  )
}
