# RESQ — Frontend Implementation Plan (Map-First Disaster Intelligence UI)

**Project**: RESQ (Disaster-Aware Relief Routing System for Assam & Meghalaya)  
**Document**: Frontend Architecture, Open Geospatial Engine & Implementation Roadmap  
**Version**: 2.0.0 (Phase 0 Audit Complete)  
**Date**: August 30, 2026  

---

## 1. Executive Summary & Core Principle

The RESQ frontend delivers a **map-first, high-performance operational disaster intelligence platform** tailored for emergency responders, district disaster management authorities (DDMA), and relief dispatchers across Assam and Meghalaya.

```
       OPEN / FREE MAP RENDERING (MapLibre GL JS)
                           +
    INDIAN SOVEREIGN GEOSPATIAL LAYERS (ISRO / NRSC Bhuvan)
                           +
  RESQ 500M POSTGIS RISK GRID SSOT (408,986 Grid Single Source of Truth)
                           +
          REAL-TIME DEVICE GEOLOCATION (Browser GPS)
                           +
           SURAKSHA GEOCODER (Server-Side Proxy)
                           =
  RESQ SOVEREIGN-READY DISASTER INTELLIGENCE INTERFACE
```

---

## 2. Existing Frontend Code & Teammate Audit

An inspection of `client/`, git history, and teammate commits shows an established React 19 + Vite 8 modular architecture that will be preserved and extended:

### 2.1 Preserved Foundation
- **Framework**: React 19.2 + Vite 8.2 + React Router 7.1.
- **Typography**: `@fontsource-variable/inter` and `@fontsource/jetbrains-mono`.
- **UI Primitives in `client/src/ui/`**: 14 modular components (`Badge`, `Button`, `Divider`, `KeyValueRow`, `MeterBar`, `Panel`, `ScoreReadout`, `Skeleton`, `Spinner`, `StateBlock`, `Tabs`, `TextField`, `Toggle`, `Tooltip`).
- **Map Substrate & Math**: `projection.js` (Web Mercator projection and meter-per-pixel calculations), `viewport.jsx` (camera state context), `constants.js` (Guwahati framing and bounds).
- **Design Tokens**: `client/src/styles/tokens.css` with CSS custom properties.

---

## 3. Map Technology & Sovereign Geospatial Architecture

### 3.1 Primary Map Engine: MapLibre GL JS
- **Technology**: `maplibre-gl` (Open-source, WebGL/WebGL2-based vector and raster rendering).
- **Rationale**:
  - Zero proprietary vendor lock-in or recurring commercial tile tokens.
  - Native hardware-accelerated 3D terrain and pitch/bearing camera controls.
  - Dynamic GeoJSON/Vector tile rendering for 500m risk polygons and incident markers.
  - High performance on both desktop workstations and mobile touch devices.

### 3.2 Abstract Map Provider Pattern
The map substrate abstracts basemap and layer sources to guarantee uninterrupted operation:

```
MapProvider (Abstraction)
  ├── OpenMapProvider       ──► OpenStreetMap / Carto Light / OpenTopoMap
  ├── BhuvanProvider        ──► ISRO / NRSC Bhuvan WMS & Thematic Hazard Layers
  ├── SovereignTerrainDEM   ──► Bhuvan Terrain / MapLibre Raster-DEM Elevation
  └── SatelliteProvider     ──► Bhuvan Satellite / Open Satellite Imagery
```

### 3.3 Map Modes & Capabilities

| Map Mode | Visual Layer Stack | Disaster Operational Purpose |
|---|---|---|
| **Normal** (Default) | Light vector/raster basemap + 500m risk grid + active incidents + road/bridge status | High-contrast operational clarity without visual clutter |
| **3D** | WebGL 3D terrain elevation (pitch $45^\circ-60^\circ$) + risk overlay + incidents | Visualizing escarpments, valleys, and slope-triggered hazards (e.g. landslides) |
| **Terrain** | DEM-derived hillshade + contour relief + river floodplains | Analyzing elevation-driven flood inundation and valley accessibility |
| **Satellite** | Official ISRO/Bhuvan high-res imagery (or graceful fallback) | Ground-truth visual context of land cover, river courses, and terrain |
| **Hybrid** | Satellite imagery + road transport network + risk grid + bridge status | Comprehensive operational situational awareness |

---

## 4. 500m Risk Grid Viewport Query & Rendering Architecture

The database contains **408,986 grid cells** (Assam: 317,842, Meghalaya: 91,144). To guarantee 60 FPS performance without browser DOM bottlenecks:

```
Map Camera Viewport Moves / Zooms
               │
               ▼
Extract Viewport Bounding Box [minLon, minLat, maxLon, maxLat]
               │
               ▼ (Only if Zoom >= 11.0)
GET /api/grid/viewport?bbox=minLon,minLat,maxLon,maxLat
               │
               ▼
PostGIS: ST_Intersects(geom, ST_MakeEnvelope(minLon, minLat, maxLon, maxLat, 4326))
               │
               ▼
Lightweight GeoJSON Response (grid_id, risk_score, dynamic_risk, risk_status, geom)
               │
               ▼
MapLibre Vector Source Update (Fill Layer with Dynamic Expression Styling)
```

### 4.1 Harmonized Risk Colors & Semantic Statuses

| Risk Status | Score Threshold | Road Closure Safety Floor | Map Fill Hex | Operational Meaning |
|---|---|---|---|---|
| 🟢 **LOW** | $0.0 - 24.9$ | None | `#16a34a` (Alpha 0.35) | Safe transit corridor |
| 🟡 **MODERATE** | $25.0 - 44.9$ | None | `#d97706` (Alpha 0.45) | Heightened caution required |
| 🟠 **HIGH** | $45.0 - 69.9$ | None | `#ea580c` (Alpha 0.55) | Impending hazard / heavy flood |
| 🔴 **CRITICAL** | $70.0 - 100.0$ | $\ge 80.0$ | `#dc2626` (Alpha 0.70) | Severe disruption / road/bridge closed |

---

## 5. Real-Time Geolocation & Geocoding Pipeline

### 5.1 Device Geolocation Flow
```
User clicks [📍 Locate Me] / Allows Browser Permission
               │
               ▼
navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true })
               │
               ▼
Display Pulsing "You Are Here" Radar Pin on Map
               │
               ▼
GET /api/grid/point?lat={lat}&lon={lon}
               │
               ▼
PostGIS ST_Contains(geom, ST_Point(lon, lat)) ──► Returns Current Cell (e.g. AS_00210744)
               │
               ▼
GET /api/risk/grid/AS_00210744 ──► Populate Right Intelligence Panel with Live Risk
```

### 5.2 Location Search & Suraksha Geocoder Proxy
```
User Types "Guwahati" / "Boko Bridge" / "Nongpoh" in TopBar Search
               │
               ▼
Debounced Query (300ms) ──► GET /api/geocode?q={query}
               │
               ▼
RESQ Backend Geocoder Service
  ├── 1. Query Suraksha / Regional Gazetteer
  └── 2. Fallback to Local Assam & Meghalaya District & Landmark Gazetteers
               │
               ▼
Normalized Place Candidates (Name, District, State, Lat, Lon, Category)
               │
               ▼
User Selects Candidate ──► Fly camera to coordinates + Resolve 500m Grid + Open Intelligence
```

---

## 6. Screen Architecture: Desktop vs. Mobile (SurakshaAI Alignment)

### 6.1 Desktop Layout (~72% Map / ~28% Right Intelligence Panel)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  RESQ ● LIVE      [  🔍 Search any place, district, bridge, or grid ID in Assam & Meghalaya  ]  [🔔]  │  [🗺️ Map] [🚨 RESQ Mode] [📡 Feeds] [👤 Officer]
├──────────────────────────────────────────────────────────────────────────┬─────────────────────────────┤
│                                                                          │  📍 DISASTER INTELLIGENCE   │
│  [ℹ️ RESQ Map - Assam & Meghalaya]                                       │  Guwahati, Kamrup Metro     │
│                                                                          │  ─────────────────────────  │
│                                                                          │  [ 🚨 GET RELIEF DIRECTIONS]│
│                                                      [ ⌖ Recenter ]      │  ─────────────────────────  │
│                                                      [ 🧭 North   ]      │  [ Overview | Hazards | Ev ]│
│                                                      [ ＋ Zoom In ]      │                             │
│                  📍 Active Landslide Marker          [ － Zoom Out]      │  CURRENT RISK               │
│                     (NH-6 Blockage)                  [ ⛶ Fullscr  ]      │     64.5 / 100   CRITICAL   │
│                                                                          │  Static: 26.2  Dynamic: 90  │
│                                                                          │  ─────────────────────────  │
│                                                                          │  WHY THIS RISK?             │
│                                                                          │  • Bridge Closure      +80.8│
│                                                                          │  • Flash Flood Alert   +56.0│
│                                                                          │  • Historical Sero     +0.0 │
│                                                                          │  ─────────────────────────  │
│                                                                          │  Confidence: 97% (Verified) │
│  ┌───────────────────────────────────────────────────────────────┐       │  Source: Shillong Times     │
│  │ [Normal]  [3D Terrain]  [Satellite]  [Hybrid]  [Risk Grid]    │       │  Updated: 2 mins ago        │
│  └───────────────────────────────────────────────────────────────┘       │                             │
├──────────────────────────────────────────────────────────────────────────┴─────────────────────────────┤
│  Scale: 5 km ─── | Coordinates: 26.1440°N, 91.7369°E | Zoom: z12.4 | Active Hazards: 15 | Grids: 408k │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Mobile Layout (Map-First + Bottom Sheet UX)
- **Top Header**: Compact 54px header with brand mark, search pill, and location trigger.
- **Center Canvas**: 100% full-viewport interactive map.
- **Bottom Intelligence Sheet**:
  - **Peek State (80px)**: Large risk score badge (`64.5 CRITICAL`), primary hazard summary (`Bridge closure detected`), and swipe handle.
  - **Expanded State (Swipe Up / Tap)**: Complete explainability breakdown, active hazard list, verified source citations, and RESQ Mode emergency routing button.

---

## 7. RESQ Mode: Emergency Relief Routing UX Contract

A dedicated relief routing panel allows operators to select logistics parameters:
- **Relief Vehicles**:
  - 🚑 **Ambulance**: High speed, sensitive to flood depth ($> 15\text{cm}$).
  - 🚛 **Relief Truck**: Heavy payload, requires bridge clearance and stability.
  - 🚰 **Water Tanker**: Heavy liquid axle load, avoids steep terrain ($> 15\%$).
  - 🚙 **4x4 Off-Road**: Specialized high-clearance rough terrain vehicle.
- **Relief Cargo**:
  - 💊 **Critical Medical / Oxygen** (Priority: Critical)
  - 🍞 **Emergency Rations & Food** (Priority: High)
  - 💧 **Drinking Water** (Priority: High)
  - ⛺ **Shelter Kits & Blankets** (Priority: Standard)
- **Route Safety Status Preview**:
  - 🟢 `SAFE`: Risk score $< 25$, all bridges open.
  - 🟡 `CAUTION`: Minor waterlogging reported, passable with care.
  - 🟠 `AVOID`: Active high dynamic risk ($> 45$), alternate route advised.
  - 🔴 `BLOCKED`: Physical bridge washout or road collapse ahead.

---

## 8. Real-Time Risk Updates via Socket.IO

When backend event processing or cron recalculation modifies dynamic grid risks:
- Server emits `risk:grid-updated` to connected clients.
- Frontend receives payload:
  ```json
  {
    "gridId": "AS_00210744",
    "riskScore": 64.5,
    "dynamicRisk": 90.0,
    "riskStatus": "CRITICAL",
    "riskConfidence": 0.97,
    "timestamp": "2026-08-30T01:33:54.270Z"
  }
  ```
- MapLibre instantly re-colors the targeted polygon without a full map reload.
- Intelligence panel updates reactively if the cell is currently selected.

---

## 9. Phase-by-Phase Implementation Roadmap (Phases 0 to 13)

```
Phase 0: Architecture & Teammate Audit (COMPLETE)
   │
   ▼
Phase 1: RESQ Dashboard Shell & Theme Refinement
   │ ↳ Clean white surfaces, emergency accents, TopBar search pill, live status badge
   │
   ▼
Phase 2: MapLibre Map Engine Integration
   │ ↳ Install maplibre-gl, mount WebGL canvas, coordinate controls, scale bar
   │
   ▼
Phase 3: Real-Time Browser Geolocation
   │ ↳ Geolocation API, pulsing radar marker, permission states, reverse grid lookup
   │
   ▼
Phase 4: Suraksha Geocoder & Server Gazetteers
   │ ↳ Backend `/api/geocode` proxy, auto-complete search dropdown, camera fly-to
   │
   ▼
Phase 5: 500m Risk Grid Viewport Rendering
   │ ↳ Backend `/api/grid/viewport` BBox query, MapLibre vector polygon fill styling
   │
   ▼
Phase 6: Explainable Risk Intelligence Panel
   │ ↳ Connect `/api/risk/grid/:gridId`, Circular Risk Meter, Static/Dynamic split
   │
   ▼
Phase 7: Active Disaster Event Overlays & Marker Cards
   │ ↳ Fetch `/api/news/events/active`, render distinct hazard pins with popup cards
   │
   ▼
Phase 8: 3D WebGL Terrain Mode
   │ ↳ MapLibre 3D terrain elevation, pitch/bearing controls, escarpment visualization
   │
   ▼
Phase 9: Terrain Hillshade Mode
   │ ↳ DEM-derived slope/relief and river floodplain visualization
   │
   ▼
Phase 10: Bhuvan / Indian Sovereign Geospatial Layers
   │ ↳ ISRO/NRSC Bhuvan WMS thematic hazard layers with abstract provider fallback
   │
   ▼
Phase 11: RESQ Mode Emergency Relief Routing Shell
   │ ↳ Vehicle, cargo, and priority selection modal and state store
   │
   ▼
Phase 12: Real-Time Live Risk Updates (Socket.IO)
   │ ↳ Backend socket broadcast and client polygon live re-coloring
   │
   ▼
Phase 13: Valhalla Routing Contract Preparation
   │ ↳ Route intelligence UI shell and safety state badges (SAFE, CAUTION, AVOID, BLOCKED)
```

---

## 10. Verification & Quality Assurance Strategy

- **Build Validation**: Every phase verified with `npm run build` and `oxlint`.
- **Performance Budget**: Initial map load $< 1.5\text{s}$, 60 FPS viewport panning, $< 500$ DOM elements total.
- **Strict Git Rule**: Small, focused commits pushed incrementally after automated testing; zero temporary test artifacts committed.
