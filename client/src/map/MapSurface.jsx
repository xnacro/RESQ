// High-performance MapLibre GL WebGL Map Surface component for RESQ Digital Twin GIS Operations

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibreModule from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_MODES, getMapStyle } from './mapStyles.js'
import { GUWAHATI_CENTER, DEFAULT_ZOOM, ZOOM_RANGE } from './constants.js'
import { useViewportStore, useCursorStore } from './viewportContext.js'
import { getViewportGrids, getActiveDisasterEvents } from '../services/api.js'
import {
  getRiskFillStyle,
  getRiskOutlineStyle,
  getSelectedGridFillStyle,
  getSelectedGridOutlineStyle,
  getRouteLayerStyles,
  getEventCirclePaint,
} from './resqRiskStyle.js'

const ml = maplibreModule.default || maplibreModule
const MapClass = ml.Map || maplibreModule.Map
const MarkerClass = ml.Marker || maplibreModule.Marker
const PopupClass = ml.Popup || maplibreModule.Popup

// Inject high-visibility pulsing radar keyframe animations
const PULSE_STYLE_ID = 'resq-pulse-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(PULSE_STYLE_ID)) {
  const style = document.createElement('style')
  style.id = PULSE_STYLE_ID
  style.textContent = `
    @keyframes pulseRing1 {
      0% { transform: scale(0.25); opacity: 0.95; }
      50% { opacity: 0.55; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes pulseRing2 {
      0% { transform: scale(0.2); opacity: 0.9; }
      50% { opacity: 0.6; }
      100% { transform: scale(1.75); opacity: 0; }
    }
    @keyframes beaconGlow {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 3px rgba(37,99,235,0.4), 0 0 20px rgba(37,99,235,0.7); }
      50% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(37,99,235,0.2), 0 0 28px rgba(37,99,235,0.9); }
    }
  `
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
  routeData = null,
  navigationMode = 'idle',
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const originMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const popupRef = useRef(null)
  const modeRef = useRef(mode)
  const selectedLocationRef = useRef(selectedLocation)
  const routeDataRef = useRef(routeData)
  const selectedGridGeometryRef = useRef(selectedGridGeometry)
  const selectedGridStatusRef = useRef(selectedGridStatus)
  const [mapReady, setMapReady] = useState(false)

  const viewportStore = useViewportStore()
  const cursorStore = useCursorStore()

  // Ref cache to keep stable callbacks without teardowns
  const callbacksRef = useRef({ onMapClick, onGridSelect, onEventSelect, onMapReady })
  useEffect(() => {
    callbacksRef.current = { onMapClick, onGridSelect, onEventSelect, onMapReady }
    selectedLocationRef.current = selectedLocation
    modeRef.current = mode
    routeDataRef.current = routeData
    selectedGridGeometryRef.current = selectedGridGeometry
    selectedGridStatusRef.current = selectedGridStatus
  })

  // Add all custom RESQ operational layers
  const addCustomLayers = useCallback((map) => {
    if (!map) return
    const beforeId = map.getLayer('resq-label-place-town')
      ? 'resq-label-place-town'
      : undefined

    // 1. Terrain DEM elevation raster source
    if (!map.getSource('resq-terrain-dem')) {
      map.addSource('resq-terrain-dem', {
        type: 'raster-dem',
        encoding: 'terrarium',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 15,
      })
    }

    // 2. Hillshade Layer for 3D Terrain mode
    if (!map.getLayer('resq-hillshade') && map.getSource('resq-terrain-dem')) {
      const beforeLand = map.getLayer('resq-landcover-glacier')
        ? 'resq-landcover-glacier'
        : map.getLayer('resq-water-area')
        ? 'resq-water-area'
        : undefined
      map.addLayer(
        {
          id: 'resq-hillshade',
          type: 'hillshade',
          source: 'resq-terrain-dem',
          layout: { visibility: mode === MAP_MODES.TERRAIN ? 'visible' : 'none' },
          paint: {
            'hillshade-exaggeration': 0.90,
            'hillshade-shadow-color': '#1e293b',
            'hillshade-highlight-color': '#ffffff',
            'hillshade-accent-color': '#0ea5e9',
            'hillshade-illumination-direction': 315,
          },
        },
        beforeLand
      )
    }

    // 3. 3D Building Extrusion Layer
    if (!map.getLayer('resq-3d-buildings') && map.getSource('openmaptiles')) {
      map.addLayer(
        {
          id: 'resq-3d-buildings',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 13,
          layout: { visibility: mode === MAP_MODES.D3 ? 'visible' : 'none' },
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'render_height'], 10],
              0,
              '#cbd5e1',
              20,
              '#94a3b8',
              50,
              '#64748b',
              100,
              '#475569',
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              0,
              14,
              ['coalesce', ['get', 'render_height'], ['*', ['coalesce', ['get', 'levels'], 2], 4], 14],
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              0,
              14,
              ['coalesce', ['get', 'render_min_height'], 0],
            ],
            'fill-extrusion-opacity': 0.92,
          },
        },
        beforeId
      )
    }

    // 4. Live 500m PostGIS Dynamic Risk Grid Hexagons
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
          paint: getRiskFillStyle(),
        },
        beforeId
      )

      map.addLayer(
        {
          id: 'risk-grid-line',
          type: 'line',
          source: 'risk-grid-source',
          paint: getRiskOutlineStyle(),
        },
        beforeId
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

    // 5. Selected Grid Cell Highlight Polygon
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
          paint: getSelectedGridFillStyle(),
        },
        beforeId
      )

      map.addLayer(
        {
          id: 'selected-grid-highlight-line',
          type: 'line',
          source: 'selected-grid-highlight-source',
          paint: getSelectedGridOutlineStyle(),
        },
        beforeId
      )
    }

    // 6. Safe & Risk Route Segments
    if (!map.getSource('resq-route-source')) {
      const routeStyles = getRouteLayerStyles()
      const currentRoute = routeDataRef.current
      const initialFeatures =
        currentRoute && currentRoute.geometry && currentRoute.geometry.length > 0
          ? [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: currentRoute.geometry,
                },
                properties: {},
              },
            ]
          : []

      map.addSource('resq-route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: initialFeatures },
      })

      map.addLayer(
        {
          id: 'resq-route-glow',
          type: 'line',
          source: 'resq-route-source',
          layout: routeStyles.layout,
          paint: routeStyles.glow,
        },
        beforeId
      )

      map.addLayer(
        {
          id: 'resq-route-casing',
          type: 'line',
          source: 'resq-route-source',
          layout: routeStyles.layout,
          paint: routeStyles.casing,
        },
        beforeId
      )

      map.addLayer(
        {
          id: 'resq-route-line',
          type: 'line',
          source: 'resq-route-source',
          layout: routeStyles.layout,
          paint: routeStyles.fill,
        },
        beforeId
      )
    }

    // 7. Active Disaster Events Circle Markers
    if (!map.getSource('active-events-source')) {
      map.addSource('active-events-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'active-events-circle',
        type: 'circle',
        source: 'active-events-source',
        paint: getEventCirclePaint(),
      })

      map.on('click', 'active-events-circle', (e) => {
        if (e.features && e.features.length > 0) {
          const feat = e.features[0]
          const props = feat.properties
          const coords = feat.geometry.coordinates

          if (popupRef.current) popupRef.current.remove()

          const popupHtml = `
            <div style="font-family: var(--font-sans, system-ui); padding: 6px 8px; min-width: 220px;">
              <div style="font-size: 10.5px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px;">
                ${props.event_type || 'DISASTER ALERT'}
              </div>
              <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.35; margin-bottom: 5px;">
                ${props.news_title || props.location_text || 'Reported Hazard'}
              </div>
              <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
                Severity: <b>${props.severity || 0}/100</b> · Confidence: <b>${Math.round((props.confidence || 0.9) * 100)}%</b>
              </div>
              <div style="font-size: 10px; color: #94a3b8;">
                Source: ${props.source_name || 'Regional Media'}
              </div>
            </div>
          `

          popupRef.current = new PopupClass({ offset: 12 })
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

    // 8. User Location WebGL Circle Layer
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
          'circle-radius': 24,
          'circle-color': '#2563eb',
          'circle-opacity': 0.22,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#2563eb',
          'circle-stroke-opacity': 0.6,
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
        Math.round(map.getZoom())
      )
      if (geoJson && map.getSource('risk-grid-source')) {
        source.setData(geoJson)
      }
    } catch (err) {
      console.error('Failed to load viewport grids:', err)
    }
  }, [])

  // Helper to fetch active disaster events
  const refreshActiveEvents = useCallback(async () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const source = map.getSource('active-events-source')
    if (!source) return

    try {
      const geoJson = await getActiveDisasterEvents()
      if (geoJson && map.getSource('active-events-source')) {
        source.setData(geoJson)
      }
    } catch (err) {
      console.error('Failed to load active events:', err)
    }
  }, [])

  // Helper to update or position the enlarged user location marker
  const updateLocationMarker = useCallback((loc, mapInstance = null) => {
    const map = mapInstance || mapRef.current
    if (!map) return

    if (loc && loc.lat && loc.lon) {
      const lat = parseFloat(loc.lat)
      const lon = parseFloat(loc.lon)

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

      // Create or reposition enlarged high-visibility DOM marker
      if (!markerRef.current) {
        const el = document.createElement('div')
        el.className = 'resq-user-location-marker'
        el.innerHTML = `
          <div style="position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
            <div style="position:absolute; width:52px; height:52px; border-radius:50%; background:rgba(37,99,235,0.18); animation:pulseRing1 2.4s infinite cubic-bezier(0.1, 0.8, 0.3, 1);"></div>
            <div style="position:absolute; width:38px; height:38px; border-radius:50%; background:rgba(37,99,235,0.25); animation:pulseRing2 2.4s infinite cubic-bezier(0.1, 0.8, 0.3, 1) 0.6s;"></div>
            <div style="position:relative; width:22px; height:22px; border-radius:50%; background:#2563eb; border:3px solid #ffffff; box-shadow:0 0 16px rgba(37,99,235,0.6), 0 3px 10px rgba(0,0,0,0.3); z-index:2; display:flex; align-items:center; justify-content:center; animation:beaconGlow 2s infinite ease-in-out;">
              <div style="width:6px; height:6px; border-radius:50%; background:#ffffff; box-shadow:0 0 4px #ffffff;"></div>
            </div>
          </div>
        `
        markerRef.current = new MarkerClass({ element: el, anchor: 'center' })
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
    if (!mapContainerRef.current) return
    if (mapRef.current) return

    const initialStyle = getMapStyle(modeRef.current)

    const map = new MapClass({
      container: mapContainerRef.current,
      style: initialStyle,
      center: GUWAHATI_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: ZOOM_RANGE.min,
      maxZoom: ZOOM_RANGE.max,
      attributionControl: false,
      maxPitch: 85,
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

  // Track current base style to avoid unnecessary style reloads
  const currentBaseStyleRef = useRef('vector')

  // 2. Handle Layer Style & 3D/Terrain Mode Changes dynamically
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const isRasterMode = mode === MAP_MODES.SATELLITE || mode === MAP_MODES.HYBRID
    const targetBaseStyle = isRasterMode ? mode : 'vector'

    if (targetBaseStyle !== currentBaseStyleRef.current) {
      currentBaseStyleRef.current = targetBaseStyle
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
        if (routeDataRef.current && routeDataRef.current.geometry && routeDataRef.current.geometry.length > 0) {
          const routeSource = map.getSource('resq-route-source')
          if (routeSource) {
            routeSource.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: routeDataRef.current.geometry,
                  },
                  properties: {},
                },
              ],
            })
          }
        }
        if (selectedGridGeometryRef.current) {
          const gridSource = map.getSource('selected-grid-highlight-source')
          if (gridSource) {
            gridSource.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: selectedGridGeometryRef.current,
                  properties: { risk_status: selectedGridStatusRef.current || 'CRITICAL' },
                },
              ],
            })
          }
        }
      })
      return
    }

    // Dynamic switching between Vector Modes (NORMAL, LIBERTY, 3D, TERRAIN, RESQ)
    if (mode === MAP_MODES.D3) {
      // 3D Mode: Urban extruded buildings, flat ground (NO DEM mesh), NO hillshade
      try {
        map.setTerrain(null)
      } catch {
        // Ignore
      }
      if (map.isStyleLoaded()) {
        if (map.getLayer('resq-3d-buildings')) {
          map.setLayoutProperty('resq-3d-buildings', 'visibility', 'visible')
        }
        if (map.getLayer('resq-building-fill')) {
          map.setLayoutProperty('resq-building-fill', 'visibility', 'none')
        }
        if (map.getLayer('resq-hillshade')) {
          map.setLayoutProperty('resq-hillshade', 'visibility', 'none')
        }
      }
      map.easeTo({ pitch: 60, bearing: -20, duration: 800 })
      return
    }

    if (mode === MAP_MODES.TERRAIN) {
      // Terrain Mode: Topographic DEM elevation mesh + shaded relief, flat 2D buildings (NO 3D extrusions)
      if (map.isStyleLoaded()) {
        if (map.getLayer('resq-hillshade')) {
          map.setLayoutProperty('resq-hillshade', 'visibility', 'visible')
        }
        if (map.getLayer('resq-3d-buildings')) {
          map.setLayoutProperty('resq-3d-buildings', 'visibility', 'none')
        }
        if (map.getLayer('resq-building-fill')) {
          map.setLayoutProperty('resq-building-fill', 'visibility', 'visible')
        }
      }
      try {
        map.setTerrain({ source: 'resq-terrain-dem', exaggeration: 1.5 })
      } catch {
        // DEM terrain fallback
      }
      map.easeTo({ pitch: 52, bearing: 15, duration: 800 })
      return
    }

    // Reset 2D vector modes (NORMAL, LIBERTY, RESQ)
    try {
      map.setTerrain(null)
    } catch {
      // Ignore
    }
    if (map.isStyleLoaded()) {
      if (map.getLayer('resq-3d-buildings')) {
        map.setLayoutProperty('resq-3d-buildings', 'visibility', 'none')
      }
      if (map.getLayer('resq-building-fill')) {
        map.setLayoutProperty('resq-building-fill', 'visibility', 'visible')
      }
      if (map.getLayer('resq-hillshade')) {
        map.setLayoutProperty('resq-hillshade', 'visibility', 'none')
      }
    }
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 })
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

  // 4. Update Marker Position When selectedLocation changes
  useEffect(() => {
    if (!mapReady) return
    updateLocationMarker(selectedLocation)
  }, [selectedLocation, mapReady, updateLocationMarker])

  // 5. Render Driving Route Line and Start/End Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const applyRoute = () => {
      const source = map.getSource('resq-route-source')
      if (!source) return

      if (routeData && routeData.geometry && routeData.geometry.length > 0) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeData.geometry,
              },
              properties: {},
            },
          ],
        })

        // Render Start (Origin A) Marker
        if (originMarkerRef.current) originMarkerRef.current.remove()
        if (destMarkerRef.current) destMarkerRef.current.remove()

        const startCoord = routeData.geometry[0]
        const endCoord = routeData.geometry[routeData.geometry.length - 1]

        const startEl = document.createElement('div')
        startEl.style.width = '30px'
        startEl.style.height = '30px'
        startEl.style.borderRadius = '50%'
        startEl.style.background = '#10b981'
        startEl.style.border = '3px solid #ffffff'
        startEl.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.45)'
        startEl.style.display = 'flex'
        startEl.style.alignItems = 'center'
        startEl.style.justifyContent = 'center'
        startEl.style.color = '#ffffff'
        startEl.style.fontWeight = '800'
        startEl.style.fontSize = '12.5px'
        startEl.style.fontFamily = 'system-ui, sans-serif'
        startEl.innerText = 'A'

        originMarkerRef.current = new MarkerClass({ element: startEl, anchor: 'center' })
          .setLngLat(startCoord)
          .addTo(map)

        const endEl = document.createElement('div')
        endEl.style.width = '30px'
        endEl.style.height = '30px'
        endEl.style.borderRadius = '50%'
        endEl.style.background = '#ef4444'
        endEl.style.border = '3px solid #ffffff'
        endEl.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.45)'
        endEl.style.display = 'flex'
        endEl.style.alignItems = 'center'
        endEl.style.justifyContent = 'center'
        endEl.style.color = '#ffffff'
        endEl.style.fontWeight = '800'
        endEl.style.fontSize = '12.5px'
        endEl.style.fontFamily = 'system-ui, sans-serif'
        endEl.innerText = 'B'

        destMarkerRef.current = new MarkerClass({ element: endEl, anchor: 'center' })
          .setLngLat(endCoord)
          .addTo(map)

        // Compute Bounding Box
        let minLon = Infinity
        let minLat = Infinity
        let maxLon = -Infinity
        let maxLat = -Infinity

        for (const [lon, lat] of routeData.geometry) {
          if (lon < minLon) minLon = lon
          if (lat < minLat) minLat = lat
          if (lon > maxLon) maxLon = lon
          if (lat > maxLat) maxLat = lat
        }

        const isMobile = window.innerWidth <= 768
        const padding = isMobile
          ? { top: 60, bottom: 260, left: 20, right: 20 }
          : { top: 80, bottom: 120, left: 340, right: 400 }

        if (navigationMode !== 'driving') {
          map.fitBounds(
            [
              [minLon, minLat],
              [maxLon, maxLat],
            ],
            {
              padding,
              maxZoom: 15,
              duration: 800,
            }
          )
        }
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        })
        if (originMarkerRef.current) {
          originMarkerRef.current.remove()
          originMarkerRef.current = null
        }
        if (destMarkerRef.current) {
          destMarkerRef.current.remove()
          destMarkerRef.current = null
        }
      }
    }

    if (map.isStyleLoaded()) {
      applyRoute()
    } else {
      map.once('style.load', applyRoute)
    }
  }, [routeData, mapReady, navigationMode])

  return (
    <div
      ref={mapContainerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {children}
    </div>
  )
}

export default MapSurface
