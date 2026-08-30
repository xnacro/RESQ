// RESQ Mode Emergency Relief Routing Modal
import { useState } from 'react'
import {
  X,
  Truck,
  Droplets,
  Package,
  HeartPulse,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  Flame,
  ArrowRight,
} from 'lucide-react'
import { Button, Badge, TextField } from '../ui/index.js'
import styles from './ResqModeModal.module.css'

const VEHICLES = [
  { id: 'ambulance', label: 'Ambulance', icon: HeartPulse, desc: 'High speed, shallow flood sensitive (< 15cm)' },
  { id: 'truck', label: 'Relief Truck', icon: Truck, desc: 'Heavy payload, bridge weight check required' },
  { id: 'tanker', label: 'Water Tanker', icon: Droplets, desc: 'Heavy liquid load, avoids slopes > 15%' },
  { id: 'offroad', label: '4x4 Off-Road', icon: Flame, desc: 'High ground clearance all-terrain rescue' },
]

const CARGO_TYPES = [
  { id: 'medical', label: 'Medical / Oxygen', priority: 'CRITICAL' },
  { id: 'food', label: 'Emergency Rations', priority: 'HIGH' },
  { id: 'water', label: 'Drinking Water', priority: 'HIGH' },
  { id: 'shelter', label: 'Shelter & Blankets', priority: 'NORMAL' },
]

export function ResqModeModal({ isOpen, onClose, destinationGrid = null, destinationPlace = null }) {
  const [vehicle, setVehicle] = useState('truck')
  const [cargo, setCargo] = useState('medical')
  const [origin, setOrigin] = useState('Guwahati Emergency Depot')
  const [dest, setDest] = useState(destinationPlace?.name || destinationGrid || 'Boko Relief Camp')

  if (!isOpen) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="resq-mode-title">
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleRow}>
            <div className={styles.badgePulse}>
              <span className={styles.pulseDot} />
              <span>EMERGENCY DISPATCH</span>
            </div>
            <h2 id="resq-mode-title" className={styles.title}>
              RESQ Mode — Safe Relief Routing
            </h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Origin & Destination */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>1. Dispatch Origin & Destination</h3>
            <div className={styles.routeInputs}>
              <TextField
                label="Relief Dispatch Depot (Origin)"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Origin depot name"
              />
              <TextField
                label="Target Disaster Area (Destination)"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="Target village, camp, or grid ID"
              />
            </div>
          </div>

          {/* Vehicle Selection */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>2. Select Relief Vehicle</h3>
            <div className={styles.vehicleGrid}>
              {VEHICLES.map((v) => {
                const Icon = v.icon
                const isSelected = vehicle === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`${styles.vehicleCard} ${isSelected ? styles.vehicleCardActive : ''}`}
                    onClick={() => setVehicle(v.id)}
                  >
                    <div className={styles.vehicleIcon}>
                      <Icon size={20} />
                    </div>
                    <div className={styles.vehicleInfo}>
                      <span className={styles.vehicleLabel}>{v.label}</span>
                      <span className={styles.vehicleDesc}>{v.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cargo Selection */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>3. Emergency Cargo & Priority</h3>
            <div className={styles.cargoGrid}>
              {CARGO_TYPES.map((c) => {
                const isSelected = cargo === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.cargoCard} ${isSelected ? styles.cargoCardActive : ''}`}
                    onClick={() => setCargo(c.id)}
                  >
                    <span className={styles.cargoLabel}>{c.label}</span>
                    <Badge tone={c.priority === 'CRITICAL' ? 'critical' : c.priority === 'HIGH' ? 'high' : 'neutral'} size="sm">
                      {c.priority}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Route Safety Preview */}
          <div className={styles.routePreview}>
            <div className={styles.previewHeader}>
              <ShieldCheck size={16} color="var(--risk-low)" />
              <span className={styles.previewTitle}>Route Intelligence Contract</span>
            </div>
            <p className={styles.previewText}>
              RESQ dynamic routing penalizes 500m cells with active flood hazard inundation and bypasses closed bridges/washouts (e.g. NH-27 Boko Bridge).
            </p>
            <div className={styles.statusBands}>
              <span className={styles.statusPillSafe}>🟢 SAFE</span>
              <span className={styles.statusPillCaution}>🟡 CAUTION</span>
              <span className={styles.statusPillAvoid}>🟠 AVOID</span>
              <span className={styles.statusPillBlocked}>🔴 BLOCKED</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Navigation} onClick={onClose}>
            Generate Risk-Aware Relief Route
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ResqModeModal
