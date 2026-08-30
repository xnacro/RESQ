import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Radio, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../app/authContext.jsx'
import styles from './EmergencyBroadcastModal.module.css'

const ALERT_TYPES = [
  { id: 'FLASH_FLOOD_EVACUATION', label: 'Flash Flood Surge — Route Impassable' },
  { id: 'BRIDGE_SCOUR_WASHOUT', label: 'Bridge Scour / Washout Evacuation' },
  { id: 'LANDSLIDE_DEBRIS_COLLAPSE', label: 'Landslide Collapse — Convoy Trapped' },
  { id: 'MEDICAL_CONVOY_DISTRESS', label: 'Critical Medical Cargo Distress' },
]

export function EmergencyBroadcastModal({
  isOpen,
  onClose,
  currentLocation = 'Kamrup Metro / Guwahati Relief Corridor',
  activeMission = 'CONVOY-BRAVO-12 (Insulin & Blood Bags)',
}) {
  const { getAuthHeaders, isViewer, canEdit } = useAuth()
  const [alertType, setAlertType] = useState('FLASH_FLOOD_EVACUATION')
  const [timestamp, setTimestamp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState({ error: '', success: '' })

  // Keep timestamp fresh when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setResultMsg({ error: '', success: '' })
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSendAlert = async () => {
    if (isViewer) return

    setSubmitting(true)
    setResultMsg({ error: '', success: '' })

    try {
      const res = await fetch('/api/damage/sos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          location: currentLocation,
          missionCode: activeMission,
          alertType,
          notes: 'Emergency operational broadcast transmitted from field command console.',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transmit emergency broadcast')
      }

      setResultMsg({ error: '', success: '✓ EMERGENCY ALERT SENT' })

      // Dispatch global event for live map reaction
      window.dispatchEvent(
        new CustomEvent('resq:emergency-broadcast', {
          detail: data.alert,
        })
      )

      setTimeout(() => {
        onClose()
      }, 1600)
    } catch (err) {
      setResultMsg({ error: err.message || 'Transmission failed', success: '' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Emergency Broadcast">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerIconRow}>
            <div className={styles.iconCircle}>
              <Radio size={20} />
            </div>
            <div>
              <h2 className={styles.title}>EMERGENCY BROADCAST</h2>
              <p className={styles.subtitle}>Are you sure you want to send an emergency alert?</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          {resultMsg.success ? (
            <div className={styles.successBanner}>
              <CheckCircle2 size={18} />
              <span>{resultMsg.success}</span>
            </div>
          ) : (
            <>
              {resultMsg.error && (
                <div style={{ color: '#dc2626', fontSize: '13px', display: 'flex', gap: '6px' }}>
                  <AlertTriangle size={16} />
                  <span>{resultMsg.error}</span>
                </div>
              )}

              {/* Operational Dispatch Data */}
              <div className={styles.dataCard}>
                <div className={styles.dataRow}>
                  <span className={styles.dataLabel}>Location</span>
                  <span className={styles.dataValue}>{currentLocation}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.dataLabel}>Current Convoy</span>
                  <span className={styles.monoVal}>{activeMission}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.dataLabel}>Timestamp</span>
                  <span className={styles.dataValue}>{timestamp || 'Live UTC+5:30'}</span>
                </div>
              </div>

              {/* Alert Type Selector */}
              <div className={styles.field}>
                <label className={styles.label}>Emergency Incident Type</label>
                <select
                  className={styles.select}
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  disabled={isViewer || submitting}
                >
                  {ALERT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Viewer restriction alert */}
              {isViewer && (
                <div className={styles.viewerRestrictionBox}>
                  <strong>Observer Clearance:</strong> You are currently signed in with a Read-Only Viewer role.
                  Emergency broadcast transmission is restricted to Operator and Administrator personnel.
                </div>
              )}

              {canEdit && (
                <div className={styles.warningBox}>
                  <AlertTriangle size={16} />
                  <span>This alert immediately re-routes all active convoys away from this corridor.</span>
                </div>
              )}
            </>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSendAlert}
            disabled={isViewer || submitting || !!resultMsg.success}
          >
            <Radio size={16} />
            <span>{submitting ? 'TRANSMITTING...' : 'SEND EMERGENCY ALERT'}</span>
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
