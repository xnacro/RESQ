// MapLibre WebGL vector map substrate for RESQ disaster intelligence
import { useEffect, useRef, useState, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapStyle, MAP_MODES } from './mapStyles.js'
import { GUWAHATI_CENTER, DEFAULT_ZOOM } from './constants.js'
import { useMapViewport, useCursorStore } from './viewportContext.js'
import { getViewportGrids, getActiveDisasterEvents } from '../services/api.js'
import styles from './MapSurface.module.css'

export function MapSurface({
  children,
  mode = MAP_MODES.NORMAL,
  onMapClick,
  onGridSelect,
  onEventSelect,
  onMapReady,
  selectedLocation = null,
  selectedGridGeometry = null,
  selectedGridStatus = null,
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const popupRef = useRef(null)
  const currentModeRef = useRef(mode)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { setCenter, setZoom } = useMapViewport()
  const cursorStore = useCursorStore()

  // Helper to attach risk grid & disaster event layers to MapLibre
  const setupLayers = useCallback((map) => {
    if (!map || !map.isStyleLoaded()) return

    // 1. Add 500m Risk Grid Source & Layers
    if (!map.getSource('risk-grid-source')) {
      map.addSource('risk-grid-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'risk-grid-fill',
        type: 'fill',
        source: 'risk-grid-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'risk_status'],
            'CRITICAL', 'rgba(220, 38, 38, 0.55)',
            'HIGH', 'rgba(234, 88, 12, 0.45)',
            'MODERATE', 'rgba(217, 119, 6, 0.35)',
            'rgba(22, 163, 74, 0.25)',
          ],
          'fill-opacity': 0.85,
        },
      })

      map.addLayer({
        id: 'risk-grid-line',
        type: 'line',
        source: 'risk-grid-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'risk_status'],
            'CRITICAL', '#dc2626',
            'HIGH', '#ea580c',
            'MODERATE', '#d97706',
            '#16a34a',
          ],
          'line-width': 1.2,
          'line-opacity': 0.9,
        },
      })

      map.on('click', 'risk-grid-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties
          if (onGridSelect) onGridSelect(props)
        }
      })

      map.on('mouseenter', 'risk-grid-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'risk-grid-fill', () => {
        map.getCanvas().style.cursor = ''
      })
    }

    // 2. Add Selected Grid Highlight Layer
    if (!map.getSource('selected-grid-highlight-source')) {
      map.addSource('selected-grid-highlight-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'selected-grid-highlight-fill',
        type: 'fill',
        source: 'selected-grid-highlight-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'risk_status'],
            'CRITICAL', 'rgba(220, 38, 38, 0.65)',
            'HIGH', 'rgba(234, 88, 12, 0.55)',
            'MODERATE', 'rgba(217, 119, 6, 0.45)',
            'rgba(22, 163, 74, 0.35)',
          ],
          'fill-opacity': 0.9,
        },
      })

      map.addLayer({
        id: 'selected-grid-highlight-line',
        type: 'line',
        source: 'selected-grid-highlight-source',
        paint: {
          'line-color': '#0f172a',
          'line-width': 3,
          'line-opacity': 1,
        },
      })
    }

    // 3. Add Active Disaster Events Source & Layers
    if (!map.getSource('active-events-source')) {
      map.addSource('active-events-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'active-events-circle',
        type: 'circle',
        source: 'active-events-source',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, 8,
            14, 14,
          ],
          'circle-color': [
            'match',
            ['get', 'hazard_type'],
            'FLASH_FLOOD', '#2563eb',
            'FLOOD', '#0284c7',
            'LANDSLIDE', '#b45309',
            'EARTHQUAKE', '#7c3aed',
            '#dc2626',
          ],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      })

      map.on('click', 'active-events-circle', (e) => {
        if (e.features && e.features.length > 0) {
          const feat = e.features[0]
          const props = feat.properties
          const coords = feat.geometry.coordinates

          if (popupRef.current) popupRef.current.remove()

          const popupHtml = `
            <div style="font-family: var(--font-sans); padding: 4px; min-width: 200px;">
              <div style="font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase; margin-bottom: 2px;">
                🚨 ${props.event_type || 'DISASTER EVENT'}
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">
                ${props.news_title || props.location_text || 'Reported Hazard'}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
                Severity: <b>${props.severity || 0}/100</b> | Confidence: <b>${Math.round((props.confidence || 0.9) * 100)}%</b>
              </div>
              <div style="font-size: 10px; color: #94a3b8;">
                Source: ${props.source_name || 'Verified Media'}
              </div>
            </div>
          `

          popupRef.current = new maplibregl.Popup({ offset: 12 })
            .setLngLat(coords)
            .setHTML(popupHtml)
            .addTo(map)

          if (onEventSelect) onEventSelect(props)
        }
      })

      map.on('mouseenter', 'active-events-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'active-events-circle', () => {
        map.getCanvas().style.cursor = ''
      })
    }
  }, [onGridSelect, onEventSelect])

  // Helper to fetch visible grid cells for current viewport
  const refreshViewportGrids = useCallback(async () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const z = map.getZoom()
    const source = map.getSource('risk-grid-source')
    if (!source) return

    if (z < 10.5) {
      source.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const bounds = map.getBounds()
    const w = bounds.getWest()
    const s = bounds.getSouth()
    const e = bounds.getEast()
    const n = bounds.getNorth()

    try {
      const geoJson = await getViewportGrids(w, s, e, n, 400)
      if (map.getSource('risk-grid-source')) {
        map.getSource('risk-grid-source').setData(geoJson)
      }
    } catch (err) {
      console.error('Failed to refresh viewport grids:', err.message)
    }
  }, [])

  // Helper to fetch and render active disaster events
  const refreshActiveEvents = useCallback(async () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const source = map.getSource('active-events-source')
    if (!source) return

    try {
      const events = await getActiveDisasterEvents()
      const geoJson = {
        type: 'FeatureCollection',
        features: events
          .filter((ev) => ev.longitude && ev.latitude)
          .map((ev) => ({
            type: 'Feature',
            id: ev.id,
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(ev.longitude), parseFloat(ev.latitude)],
            },
            properties: {
              ...ev,
              hazard_type: ev.hazard_type || ev.event_type,
            },
          })),
      }
      source.setData(geoJson)
    } catch (err) {
      console.error('Failed to load active events:', err.message)
    }
  }, [])

  // 1. Initialize MapLibre instance with ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const initialStyle = getMapStyle(mode)

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: GUWAHATI_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: mode === MAP_MODES.D3 ? 55 : 0,
      bearing: mode === MAP_MODES.D3 ? -15 : 0,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
    })

    map.on('load', () => {
      setMapLoaded(true)
      map.resize()
      setupLayers(map)
      refreshViewportGrids()
      refreshActiveEvents()
      if (onMapReady) onMapReady(map)
    })

    map.on('error', (e) => {
      console.warn('MapLibre notice:', e.error?.message || e.message)
    })

    map.on('move', () => {
      const c = map.getCenter()
      const z = map.getZoom()
      if (typeof setCenter === 'function') setCenter([c.lng, c.lat])
      if (typeof setZoom === 'function') setZoom(z)
    })

    map.on('moveend', () => {
      refreshViewportGrids()
    })

    map.on('mousemove', (e) => {
      cursorStore.set({ lon: e.lngLat.lng, lat: e.lngLat.lat })
    })

    map.on('mouseout', () => {
      cursorStore.set(null)
    })

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
          point: e.point,
        })
      }
    })

    // ResizeObserver ensures map canvas always updates when layout resizes
    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(mapContainerRef.current)

    mapRef.current = map

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [setupLayers, refreshViewportGrids, refreshActiveEvents])

  // 2. Handle Map Mode Changes (Normal, Liberty, 3D, Terrain, Satellite, Hybrid, RESQ)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (currentModeRef.current === mode) return
    currentModeRef.current = mode

    const nextStyle = getMapStyle(mode)
    map.setStyle(nextStyle)

    map.once('style.load', () => {
      map.resize()
      setupLayers(map)
      refreshViewportGrids()
      refreshActiveEvents()
    })

    if (mode === MAP_MODES.D3) {
      map.easeTo({ pitch: 55, bearing: -15, duration: 800 })
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 })
    }
  }, [mode, mapLoaded, setupLayers, refreshViewportGrids, refreshActiveEvents])

  // 3. Render Selected / Current 500m Grid Highlight Polygon
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.isStyleLoaded()) return

    const source = map.getSource('selected-grid-highlight-source')
    if (!source) return

    if (selectedGridGeometry) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: selectedGridGeometry,
            properties: {
              risk_status: selectedGridStatus || 'CRITICAL',
            },
          },
        ],
      })
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [selectedGridGeometry, selectedGridStatus, mapLoaded])

  // 4. Render Current Location Marker with Radar Pulse
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (selectedLocation && selectedLocation.lat && selectedLocation.lon) {
      if (!markerRef.current) {
        const el = document.createElement('div')
        el.style.width = '48px'
        el.style.height = '48px'
        el.style.position = 'relative'
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'
        el.style.pointerEvents = 'auto'
        el.style.cursor = 'pointer'
        el.innerHTML = `
          <div style="position:absolute; width:48px; height:48px; border-radius:50%; background:rgba(37,99,235,0.3); animation:pulseRing 2s infinite ease-out;"></div>
          <div style="position:relative; width:22px; height:22px; border-radius:50%; background:#2563eb; border:3px solid #ffffff; box-shadow:0 2px 10px rgba(0,0,0,0.5); z-index:2; display:flex; align-items:center; justify-content:center;">
            <div style="width:6px; height:6px; border-radius:50%; background:#ffffff;"></div>
          </div>
        `
        markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([selectedLocation.lon, selectedLocation.lat])
          .addTo(map)
      } else {
        markerRef.current.setLngLat([selectedLocation.lon, selectedLocation.lat])
      }

      map.flyTo({
        center: [selectedLocation.lon, selectedLocation.lat],
        zoom: Math.max(map.getZoom(), 13),
        speed: 1.2,
        curve: 1.4,
        essential: true,
      })
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [selectedLocation, mapLoaded])

  return (
    <div className={styles.wrapper}>
      <div ref={mapContainerRef} className={styles.mapContainer} />
      {children}
    </div>
  )
}

export default MapSurface
