// MapLibre WebGL vector map substrate for RESQ disaster intelligence
import { useEffect, useRef, useState, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapStyle, MAP_MODES } from './mapStyles.js'
import { GUWAHATI_CENTER, DEFAULT_ZOOM } from './constants.js'
import { useViewportStore, useCursorStore } from './viewportContext.js'
import { getViewportGrids, getActiveDisasterEvents } from '../services/api.js'
import styles from './MapSurface.module.css'

// Inject pulsing marker keyframe animation once
const PULSE_STYLE_ID = 'resq-pulse-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(PULSE_STYLE_ID)) {
  const style = document.createElement('style')
  style.id = PULSE_STYLE_ID
  style.textContent = `@keyframes pulseRing { 0% { transform: scale(0.4); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }`
  document.head.appendChild(style)
}

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
  const modeRef = useRef(mode)
  const selectedLocationRef = useRef(selectedLocation)
  const [mapReady, setMapReady] = useState(false)

  const viewportStore = useViewportStore()
  const cursorStore = useCursorStore()

  // Store volatile callbacks in refs to avoid re-triggering effects
  const callbacksRef = useRef({ onMapClick, onGridSelect, onEventSelect, onMapReady })
  callbacksRef.current = { onMapClick, onGridSelect, onEventSelect, onMapReady }
  selectedLocationRef.current = selectedLocation
  modeRef.current = mode

  // Helper to attach custom layers on top of OpenFreeMap vector styles
  const addCustomLayers = useCallback((map) => {
    if (!map || !map.isStyleLoaded()) return

    const allLayers = map.getStyle().layers || []
    const firstSymbol = allLayers.find((l) => l.type === 'symbol')
    const beforeId = firstSymbol ? firstSymbol.id : undefined

    // 1. 3D buildings extrusion layer for OpenFreeMap 3D mode
    if (modeRef.current === MAP_MODES.D3 && map.getSource('openmaptiles') && !map.getLayer('3d-buildings')) {
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'],
              0, '#e2e8f0',
              20, '#cbd5e1',
              50, '#94a3b8',
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13, 0,
              15.5, ['coalesce', ['get', 'render_height'], 10],
            ],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85,
          },
        },
        beforeId,
      )
    }

    // 2. 500m Risk Grid Fill and Line Layers below labels
    if (!map.getSource('risk-grid-source')) {
      map.addSource('risk-grid-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer(
        {
          id: 'risk-grid-fill',
          type: 'fill',
          source: 'risk-grid-source',
          paint: {
            'fill-color': [
              'match',
              ['get', 'risk_status'],
              'CRITICAL', 'rgba(220, 38, 38, 0.45)',
              'HIGH', 'rgba(234, 88, 12, 0.35)',
              'MODERATE', 'rgba(217, 119, 6, 0.25)',
              'rgba(0, 0, 0, 0)',
            ],
            'fill-opacity': 0.85,
          },
        },
        beforeId,
      )

      map.addLayer(
        {
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
              'rgba(148, 163, 184, 0.2)',
            ],
            'line-width': 1.0,
            'line-opacity': 0.8,
          },
        },
        beforeId,
      )

      map.on('click', 'risk-grid-fill', (e) => {
        if (e.features && e.features.length > 0 && callbacksRef.current.onGridSelect) {
          callbacksRef.current.onGridSelect(e.features[0].properties)
        }
      })

      map.on('mouseenter', 'risk-grid-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'risk-grid-fill', () => {
        map.getCanvas().style.cursor = ''
      })
    }

    // 3. Selected Grid Cell Highlight Polygon
    if (!map.getSource('selected-grid-highlight-source')) {
      map.addSource('selected-grid-highlight-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer(
        {
          id: 'selected-grid-highlight-fill',
          type: 'fill',
          source: 'selected-grid-highlight-source',
          paint: {
            'fill-color': [
              'match',
              ['get', 'risk_status'],
              'CRITICAL', 'rgba(220, 38, 38, 0.55)',
              'HIGH', 'rgba(234, 88, 12, 0.45)',
              'MODERATE', 'rgba(217, 119, 6, 0.35)',
              'rgba(37, 99, 235, 0.25)',
            ],
            'fill-opacity': 0.9,
          },
        },
        beforeId,
      )

      map.addLayer(
        {
          id: 'selected-grid-highlight-line',
          type: 'line',
          source: 'selected-grid-highlight-source',
          paint: {
            'line-color': '#2563eb',
            'line-width': 2.5,
            'line-opacity': 1,
          },
        },
        beforeId,
      )
    }

    // 4. Active Disaster Events Circle Markers
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

          if (callbacksRef.current.onEventSelect) {
            callbacksRef.current.onEventSelect(props)
          }
        }
      })

      map.on('mouseenter', 'active-events-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'active-events-circle', () => {
        map.getCanvas().style.cursor = ''
      })
    }

    // 5. User Location WebGL Circle Layers (GPU-rendered fallback)
    if (!map.getSource('user-location-source')) {
      map.addSource('user-location-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'user-location-halo',
        type: 'circle',
        source: 'user-location-source',
        paint: {
          'circle-radius': 22,
          'circle-color': '#2563eb',
          'circle-opacity': 0.3,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#2563eb',
          'circle-stroke-opacity': 0.7,
        },
      })

      map.addLayer({
        id: 'user-location-core',
        type: 'circle',
        source: 'user-location-source',
        paint: {
          'circle-radius': 9,
          'circle-color': '#2563eb',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
      })
    }
  }, [])

  // Helper to fetch viewport risk grids
  const refreshViewportGrids = useCallback(async () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const source = map.getSource('risk-grid-source')
    if (!source) return

    if (map.getZoom() < 10.5) {
      source.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const bounds = map.getBounds()
    try {
      const geoJson = await getViewportGrids(
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
        400,
      )
      if (map.getSource('risk-grid-source')) {
        map.getSource('risk-grid-source').setData(geoJson)
      }
    } catch (err) {
      console.error('Failed to load viewport grids:', err.message)
    }
  }, [])

  // Helper to fetch active disaster event markers
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

  // Helper to update the pulsing location marker on the map
  const updateLocationMarker = useCallback((loc, mapInstance) => {
    const map = mapInstance || mapRef.current
    if (!map) return

    if (loc && loc.lat && loc.lon) {
      const lat = parseFloat(loc.lat)
      const lon = parseFloat(loc.lon)

      // Update WebGL circle layer
      if (map.isStyleLoaded()) {
        const source = map.getSource('user-location-source')
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lon, lat] },
              },
            ],
          })
        }
      }

      // Create or reposition DOM marker with animated radar pulse
      if (!markerRef.current) {
        const el = document.createElement('div')
        el.className = 'resq-user-location-marker'
        el.innerHTML = `
          <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
            <div style="position:absolute; width:48px; height:48px; border-radius:50%; background:rgba(37,99,235,0.3); animation:pulseRing 2s infinite ease-out;"></div>
            <div style="position:relative; width:22px; height:22px; border-radius:50%; background:#2563eb; border:3.5px solid #ffffff; box-shadow:0 3px 12px rgba(0,0,0,0.5); z-index:2; display:flex; align-items:center; justify-content:center;">
              <div style="width:6px; height:6px; border-radius:50%; background:#ffffff;"></div>
            </div>
          </div>
        `
        markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lon, lat])
          .addTo(map)
      } else {
        markerRef.current.setLngLat([lon, lat])
      }

      map.flyTo({
        center: [lon, lat],
        zoom: Math.max(map.getZoom(), 13),
        speed: 1.2,
        curve: 1.4,
        essential: true,
      })
    } else {
      if (map.isStyleLoaded()) {
        const source = map.getSource('user-location-source')
        if (source) source.setData({ type: 'FeatureCollection', features: [] })
      }
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    }
  }, [])

  // 1. Initialize MapLibre instance ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const initialStyle = getMapStyle(modeRef.current)

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: GUWAHATI_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: modeRef.current === MAP_MODES.D3 ? 55 : 0,
      bearing: modeRef.current === MAP_MODES.D3 ? -15 : 0,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
    })

    viewportStore.setMapInstance(map)

    map.on('load', () => {
      setMapReady(true)
      map.resize()
      addCustomLayers(map)
      refreshViewportGrids()
      refreshActiveEvents()

      if (selectedLocationRef.current) {
        updateLocationMarker(selectedLocationRef.current, map)
      }

      if (callbacksRef.current.onMapReady) {
        callbacksRef.current.onMapReady(map)
      }
    })

    map.on('move', () => {
      const c = map.getCenter()
      const z = map.getZoom()
      viewportStore.set({ center: [c.lng, c.lat], zoom: z })
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
      if (callbacksRef.current.onMapClick) {
        callbacksRef.current.onMapClick({
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
          point: e.point,
        })
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(mapContainerRef.current)

    mapRef.current = map

    return () => {
      resizeObserver.disconnect()
      viewportStore.setMapInstance(null)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      setMapReady(false)
    }
  }, []) // Empty dependency array ensures MapLibre is never torn down and recreated

  // 2. Handle Layer Style / Mode Changes smoothly without recreating the map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const nextStyle = getMapStyle(mode)
    map.setStyle(nextStyle)

    map.once('style.load', () => {
      map.resize()
      addCustomLayers(map)
      refreshViewportGrids()
      refreshActiveEvents()
      if (selectedLocationRef.current) {
        updateLocationMarker(selectedLocationRef.current, map)
      }
    })

    if (mode === MAP_MODES.D3) {
      map.easeTo({ pitch: 55, bearing: -15, duration: 800 })
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 })
    }
  }, [mode, mapReady, addCustomLayers, refreshViewportGrids, refreshActiveEvents, updateLocationMarker])

  // 3. Render Selected Grid Cell Highlight Polygon
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const applyGrid = () => {
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
    }

    if (map.isStyleLoaded()) {
      applyGrid()
    } else {
      map.once('style.load', applyGrid)
    }
  }, [selectedGridGeometry, selectedGridStatus, mapReady])

  // 4. Update Location Pointer when selectedLocation updates
  useEffect(() => {
    if (!mapReady) return
    updateLocationMarker(selectedLocation)
  }, [selectedLocation, mapReady, updateLocationMarker])

  return (
    <div className={styles.wrapper}>
      <div ref={mapContainerRef} className={styles.mapContainer} />
      {children}
    </div>
  )
}

export default MapSurface
