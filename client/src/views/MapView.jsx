// Main MapView coordinating MapLibre WebGL canvas, search, geolocation, and intelligence panel
import { useState, useCallback, useEffect } from 'react'
import { MapChrome } from '../map/MapChrome.jsx'
import { MapSurface } from '../map/MapSurface.jsx'
import { MapViewportProvider } from '../map/viewport.jsx'
import { ContextPanel } from '../panels/ContextPanel.jsx'
import { MobileBottomSheet } from '../panels/MobileBottomSheet.jsx'
import { ResqModeModal } from '../panels/ResqModeModal.jsx'
import { MAP_MODES } from '../map/mapStyles.js'
import { getGridByPoint, searchGeocode, getGridRiskBreakdown } from '../services/api.js'
import styles from './MapView.module.css'

export default function MapView() {
  const [mode, setMode] = useState(MAP_MODES.NORMAL)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedGridId, setSelectedGridId] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [isResqModeOpen, setIsResqModeOpen] = useState(false)
  const [geoLocating, setGeoLocating] = useState(false)

  // Fetch full risk breakdown when grid changes
  useEffect(() => {
    if (!selectedGridId) {
      setRiskData(null)
      return
    }

    let isCurrent = true
    getGridRiskBreakdown(selectedGridId).then((data) => {
      if (isCurrent) setRiskData(data)
    })

    return () => {
      isCurrent = false
    }
  }, [selectedGridId])

  // Listen to place selection from TopBar search
  useEffect(() => {
    const handlePlaceEvent = async (e) => {
      const candidate = e.detail
      if (!candidate) return
      setSelectedLocation(candidate)

      if (candidate.gridId) {
        setSelectedGridId(candidate.gridId)
      } else {
        const grid = await getGridByPoint(candidate.lat, candidate.lon, candidate.state)
        if (grid && grid.grid_id) {
          setSelectedGridId(grid.grid_id)
        }
      }
    }

    window.addEventListener('resq:select-place', handlePlaceEvent)
    return () => window.removeEventListener('resq:select-place', handlePlaceEvent)
  }, [])

  // 1. Real-Time Browser Geolocation Handler
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }

    setGeoLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude

        setSelectedLocation({
          name: 'Your Location',
          district: 'Live Device GPS',
          state: 'Assam / Meghalaya',
          lat,
          lon,
        })

        // Reverse lookup 500m grid cell via PostGIS ST_Contains
        try {
          const grid = await getGridByPoint(lat, lon)
          if (grid && grid.grid_id) {
            setSelectedGridId(grid.grid_id)
          }
        } catch (err) {
          console.error('Point lookup error:', err)
        } finally {
          setGeoLocating(false)
        }
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err.message)
        // Graceful fallback to default demonstration coordinates (Guwahati)
        setSelectedLocation({
          name: 'Guwahati (Default GPS Fallback)',
          district: 'Kamrup Metropolitan',
          state: 'Assam',
          lat: 26.1445,
          lon: 91.7362,
        })
        setSelectedGridId('AS_00210744')
        setGeoLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // 2. Quick Demo Place Selection Handler
  const handleSelectQuickPlace = useCallback(async (placeName) => {
    try {
      const candidates = await searchGeocode(placeName)
      if (candidates && candidates.length > 0) {
        const top = candidates[0]
        setSelectedLocation(top)

        if (top.gridId) {
          setSelectedGridId(top.gridId)
        } else {
          const grid = await getGridByPoint(top.lat, top.lon, top.state)
          if (grid && grid.grid_id) {
            setSelectedGridId(grid.grid_id)
          }
        }
      }
    } catch (err) {
      console.error('Quick place selection error:', err)
    }
  }, [])

  // 3. Map Grid Cell Click Handler
  const handleGridSelect = useCallback((props) => {
    if (!props || !props.grid_id) return
    setSelectedGridId(props.grid_id)
    setSelectedLocation({
      name: `Grid ${props.grid_id}`,
      district: props.district || 'Assam',
      state: props.state || 'Assam',
      lat: parseFloat(props.center_lat),
      lon: parseFloat(props.center_lon),
    })
  }, [])

  // 4. Active Event Marker Click Handler
  const handleEventSelect = useCallback((props) => {
    if (!props) return
    setSelectedLocation({
      name: props.location_text || props.event_type || 'Disaster Incident',
      district: props.state || 'Assam',
      state: props.state || 'Assam',
      lat: parseFloat(props.latitude),
      lon: parseFloat(props.longitude),
    })
  }, [])

  return (
    <MapViewportProvider>
      <div className={styles.screen}>
        <div className={styles.mapArea}>
          <MapSurface
            mode={mode}
            selectedLocation={selectedLocation}
            selectedGridId={selectedGridId}
            onGridSelect={handleGridSelect}
            onEventSelect={handleEventSelect}
          />
          <MapChrome
            activeMode={mode}
            onModeChange={setMode}
            onLocateMe={handleLocateMe}
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
