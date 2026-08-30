// Main MapView coordinating MapLibre WebGL canvas, search, geolocation, and intelligence panel
import { useState, useCallback, useEffect } from 'react'
import { MapChrome } from '../map/MapChrome.jsx'
import { MapSurface } from '../map/MapSurface.jsx'
import { MapViewportProvider } from '../map/viewport.jsx'
import { ContextPanel } from '../panels/ContextPanel.jsx'
import { MobileBottomSheet } from '../panels/MobileBottomSheet.jsx'
import { ResqModeModal } from '../panels/ResqModeModal.jsx'
import { MAP_MODES } from '../map/mapStyles.js'
import {
  getDeviceCoordinates,
  searchLocations,
  GEOLOCATION_STATE,
} from '../services/locationApi.js'
import { getCurrentGridRisk, getGridRisk } from '../services/riskApi.js'
import styles from './MapView.module.css'

export default function MapView() {
  const [mode, setMode] = useState(MAP_MODES.NORMAL)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedGridId, setSelectedGridId] = useState(null)
  const [selectedGridGeometry, setSelectedGridGeometry] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [geoState, setGeoState] = useState(GEOLOCATION_STATE.INITIAL)
  const [geoError, setGeoError] = useState(null)
  const [isResqModeOpen, setIsResqModeOpen] = useState(false)

  // 1. Real-Time Browser Geolocation Handler
  const handleLocateMe = useCallback(async () => {
    setGeoState(GEOLOCATION_STATE.LOCATING)
    setGeoError(null)

    try {
      const coords = await getDeviceCoordinates()
      setGeoState(GEOLOCATION_STATE.LOCATED)

      setSelectedLocation({
        name: 'Your Location',
        district: `GPS Accuracy: ±${coords.accuracy}m`,
        state: 'Live Device Geolocation',
        lat: coords.lat,
        lon: coords.lon,
        accuracy: coords.accuracy,
      })

      // Resolve coordinates to 500m grid cell via PostGIS ST_Contains
      const pointRisk = await getCurrentGridRisk(coords.lat, coords.lon)
      if (pointRisk && pointRisk.inCoverage) {
        setSelectedGridId(pointRisk.gridId)
        setSelectedGridGeometry(pointRisk.geometry)
        setRiskData(pointRisk)
      } else {
        setSelectedGridId(null)
        setSelectedGridGeometry(null)
        setRiskData(null)
        setGeoError('Location is outside RESQ operational coverage (Assam & Meghalaya).')
      }
    } catch (err) {
      setGeoState(err.state || GEOLOCATION_STATE.ERROR)
      setGeoError(err.message || 'Unable to retrieve location.')

      // Graceful fallback demo coordinates (Guwahati, Assam)
      const fallbackLat = 26.1445
      const fallbackLon = 91.7362
      setSelectedLocation({
        name: 'Guwahati (Default Demonstration GPS)',
        district: 'Kamrup Metropolitan',
        state: 'Assam',
        lat: fallbackLat,
        lon: fallbackLon,
        accuracy: 50,
      })

      try {
        const pointRisk = await getCurrentGridRisk(fallbackLat, fallbackLon)
        if (pointRisk && pointRisk.inCoverage) {
          setSelectedGridId(pointRisk.gridId)
          setSelectedGridGeometry(pointRisk.geometry)
          setRiskData(pointRisk)
        }
      } catch (e) {
        console.error('Fallback lookup failed:', e)
      }
    }
  }, [])

  // 2. Quick Demo Place Selection Handler
  const handleSelectQuickPlace = useCallback(async (placeName) => {
    try {
      const candidates = await searchLocations(placeName)
      if (candidates && candidates.length > 0) {
        const top = candidates[0]
        setSelectedLocation(top)

        const pointRisk = await getCurrentGridRisk(top.lat, top.lon)
        if (pointRisk && pointRisk.inCoverage) {
          setSelectedGridId(pointRisk.gridId)
          setSelectedGridGeometry(pointRisk.geometry)
          setRiskData(pointRisk)
        }
      }
    } catch (err) {
      console.error('Quick place selection error:', err)
    }
  }, [])

  // 3. Map Grid Cell Click Handler
  const handleGridSelect = useCallback(async (props) => {
    if (!props || !props.grid_id) return
    const gridId = props.grid_id
    setSelectedGridId(gridId)
    setSelectedLocation({
      name: `Grid ${gridId}`,
      district: props.district || 'Assam',
      state: props.state || 'Assam',
      lat: parseFloat(props.center_lat),
      lon: parseFloat(props.center_lon),
    })

    try {
      const risk = await getGridRisk(gridId)
      setRiskData(risk)
    } catch (err) {
      console.error('Grid risk fetch error:', err)
    }
  }, [])

  // 4. Active Event Marker Click Handler
  const handleEventSelect = useCallback(async (props) => {
    if (!props) return
    const lat = parseFloat(props.latitude)
    const lon = parseFloat(props.longitude)

    setSelectedLocation({
      name: props.location_text || props.event_type || 'Disaster Incident',
      district: props.state || 'Assam',
      state: props.state || 'Assam',
      lat,
      lon,
    })

    try {
      const pointRisk = await getCurrentGridRisk(lat, lon)
      if (pointRisk && pointRisk.inCoverage) {
        setSelectedGridId(pointRisk.gridId)
        setSelectedGridGeometry(pointRisk.geometry)
        setRiskData(pointRisk)
      }
    } catch (err) {
      console.error('Event grid lookup error:', err)
    }
  }, [])

  // 5. Global Search Event Listener
  useEffect(() => {
    const handlePlaceEvent = async (e) => {
      const candidate = e.detail
      if (!candidate) return
      setSelectedLocation(candidate)

      const pointRisk = await getCurrentGridRisk(candidate.lat, candidate.lon)
      if (pointRisk && pointRisk.inCoverage) {
        setSelectedGridId(pointRisk.gridId)
        setSelectedGridGeometry(pointRisk.geometry)
        setRiskData(pointRisk)
      }
    }

    window.addEventListener('resq:select-place', handlePlaceEvent)
    return () => window.removeEventListener('resq:select-place', handlePlaceEvent)
  }, [])

  // 6. Auto-detect user's live location on initial mount
  useEffect(() => {
    handleLocateMe()
  }, [handleLocateMe])

  return (
    <MapViewportProvider>
      <div className={styles.screen}>
        <div className={styles.mapArea}>
          <MapSurface
            mode={mode}
            selectedLocation={selectedLocation}
            selectedGridGeometry={selectedGridGeometry}
            selectedGridStatus={riskData?.riskSummary?.riskStatus}
            onGridSelect={handleGridSelect}
            onEventSelect={handleEventSelect}
          />

          {geoError && (
            <div className={styles.geoBanner}>
              <span>{geoError}</span>
              <button
                type="button"
                className={styles.geoBannerClose}
                onClick={() => setGeoError(null)}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          <MapChrome
            activeMode={mode}
            onModeChange={setMode}
            onLocateMe={handleLocateMe}
            isLocating={geoState === GEOLOCATION_STATE.LOCATING}
          />

          <MobileBottomSheet
            riskData={riskData}
            selectedLocation={selectedLocation}
            onOpenResqMode={() => setIsResqModeOpen(true)}
          />
        </div>

        <ContextPanel
          selectedGridId={selectedGridId}
          selectedLocation={selectedLocation}
          onLocateMe={handleLocateMe}
          onSelectQuickPlace={handleSelectQuickPlace}
          onOpenResqMode={() => setIsResqModeOpen(true)}
        />

        <ResqModeModal
          isOpen={isResqModeOpen}
          onClose={() => setIsResqModeOpen(false)}
          destinationGrid={selectedGridId}
          destinationPlace={selectedLocation}
        />
      </div>
    </MapViewportProvider>
  )
}
