# RESQ — Frontend Implementation Plan (Phase 0 Audit & Blueprint)

**Project**: RESQ (Disaster-Aware Relief Routing System for Assam & Meghalaya)  
**Document**: Frontend Architecture, Teammate Audit & Implementation Roadmap  
**Version**: 1.0.0 (Phase 0 Complete)  
**Date**: August 30, 2026  

---

## 1. Existing Frontend Architecture & Teammate Work Audit

An extensive inspection of `client/`, git history, and existing commits reveals a well-structured, modular React 19 + Vite 8 frontend foundation built by teammates:

### 1.1 Technology Stack
- **Framework**: React 19.2 + Vite 8.2 + React Router 7.1.
- **Typography**: `@fontsource-variable/inter` (UI & Body) and `@fontsource/jetbrains-mono` (Coordinates, Metrics, Grid IDs).
- **Icons**: `lucide-react`.
- **Styling Architecture**: Pure CSS Modules + Centralized Design Token System (`client/src/styles/tokens.css`, `base.css`, `fonts.css`). Zero Tailwind dependency.

### 1.2 Existing Modules & Reusable Components

| Category | Component / Module | Path | Status & Reusability |
|---|---|---|---|
| **UI Primitives** | `Badge` | `client/src/ui/Badge.jsx` | Fully reusable (tones: neutral, quiet, accent, risk bands) |
| | `Button` | `client/src/ui/Button.jsx` | Fully reusable (variants: primary, secondary, quiet, emergency) |
| | `Panel`, `PanelHeader`, `PanelBody` | `client/src/ui/Panel.jsx` | Fully reusable modular panel surface |
| | `Tabs`, `TabPanel` | `client/src/ui/Tabs.jsx` | Fully reusable for panel navigation |
| | `TextField` | `client/src/ui/TextField.jsx` | Fully reusable with leading/trailing icons |
| | `MeterBar` | `client/src/ui/MeterBar.jsx` | Fully reusable for risk factor breakdown bars |
| | `ScoreReadout` | `client/src/ui/ScoreReadout.jsx` | Fully reusable for large numerical risk display |
| | `KeyValueRow` | `client/src/ui/KeyValueRow.jsx` | Fully reusable for metadata display |
| | `Tooltip`, `Toggle`, `Spinner`, `Skeleton` | `client/src/ui/` | Complete utility set |
| **App Shell** | `AppShell` | `client/src/app/AppShell.jsx` | TopBar wrapper and view container |
| | `TopBar` | `client/src/app/TopBar.jsx` | Brand mark, search field, navigation, SOS button |
| | `BrandMark` | `client/src/app/BrandMark.jsx` | Vector logo icon |
| **Map Engine** | `MapSurface` | `client/src/map/MapSurface.jsx` | Viewport container, wheel zoom, drag/pan, pointer capture |
| | `MapChrome` | `client/src/map/MapChrome.jsx` | Zoom controls, coordinate readout, dynamic scale bar |
| | `viewportContext.js`, `viewport.jsx` | `client/src/map/` | React context for camera position `[lon, lat]`, zoom, bounds |
| | `projection.js` | `client/src/map/projection.js` | Web Mercator projection and meter-per-pixel calculations |
| | `constants.js` | `client/src/map/constants.js` | Guwahati center, bounds, zoom constraints |
| **Panels** | `ContextPanel` | `client/src/panels/ContextPanel.jsx` | Right-side intelligence dock with analysis & route tabs |

### 1.3 Teammate Work to Preserve
- **Design Token Structure**: Maintain token nomenclature and CSS module encapsulation.
- **Map Viewport Context**: Retain camera state management (`center`, `zoom`, `panBy`, `zoomBy`) and Web Mercator unprojection math.
- **UI Primitives**: All components in `client/src/ui/` will be directly consumed without breaking changes.

---

## 2. Design Inspiration & Information Architecture (SurakshaAI Alignment)

Following the visual hierarchy of the reference interface with emergency disaster response branding:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  RESQ ● LIVE      [  🔍 Search any place, district, bridge, or grid ID in Assam & Meghalaya  ]  [🔔]  │  [🗺️ Map] [🚨 RESQ Mode] [📡 Feeds] [👤 Officer]
├──────────────────────────────────────────────────────────────────────────┬─────────────────────────────┤
│                                                                          │  📍 DISASTER INTELLIGENCE   │
│  [ℹ️ RESQ Map - Assam & Meghalaya]                                       │  Search a place or click map│
│                                                                          │  ─────────────────────────  │
│                                                                          │  [ 🚨 GET RELIEF DIRECTIONS]│
│                                                      [ ⌖ Recenter ]      │  ─────────────────────────  │
│                                                      [ 🧭 North   ]      │  [ Overview | Hazards | Ev ]│
│                                                      [ ＋ Zoom In ]      │                             │
│                  📍 Active Landslide Marker          [ － Zoom Out]      │  CURRENT RISK               │
│                     (NH-6 Blockage)                  [ ⛶ Fullscr  ]      │     64 / 100    HIGH        │
│                                                                          │  Static: 22   Dynamic: 78   │
│                                                                          │  ─────────────────────────  │
│                                                                          │  ACTIVE HAZARDS             │
│                                                                          │  • Road Flooding       +32  │
│                                                                          │  • Bridge Closure      +30  │
│                                                                          │  • Heavy Rainfall      +14  │
│                                                                          │  ─────────────────────────  │
│                                                                          │  Confidence: 94% (Verified) │
│  ┌───────────────────────────────────────────────────────────────┐       │  Source: Shillong Times     │
│  │ [Normal]  [3D Terrain]  [Satellite]  [Hybrid]  [Risk Grid]    │       │  Updated: 2 mins ago        │
│  └───────────────────────────────────────────────────────────────┘       │                             │
├──────────────────────────────────────────────────────────────────────────┴─────────────────────────────┤
│  Scale: 5 km ─── | Coordinates: 26.1445°N, 91.7362°E | Zoom: z12.4 | Active Hazards: 15 | Grids: 408k │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Visual Palette & Styling Direction
- **Background & Card Surfaces**: Clean white (`#ffffff`), slate tinted borders (`#e2e8f0`), soft elevated card shadows (`0 4px 20px rgba(0,0,0,0.06)`).
- **Primary Accent**: Operational Cobalt Blue (`#2563eb` / `#1d4ed8`).
- **Emergency Accent**: Crimson Red (`#dc2626` / `#ef4444`).
- **Risk Colors (Harmonized Semantics)**:
  - 🟢 **LOW**: `#16a34a` (Green)
  - 🟡 **MODERATE**: `#d97706` (Amber)
  - 🟠 **HIGH**: `#ea580c` (Orange)
  - 🔴 **CRITICAL**: `#dc2626` (Red)

---

## 3. Screen Architecture: Desktop vs. Mobile

### 3.1 Desktop Layout (~72% Map / ~28% Intelligence Panel)
- **Top Navigation**: Fixed 64px header with brand mark, search pill, live indicator, and navigation items.
- **Main Map Workspace**: Full viewport height minus header, rendering base tile maps, 500m risk grid overlay, active hazard pins, and floating layer switcher.
- **Right Intelligence Panel**: 380px–420px floating/docked card with smooth collapse/expand, live gauge, multi-tab breakdown, and relief routing trigger.

### 3.2 Mobile Layout (Map-First + Bottom Sheet UX)
- **Header**: Compact 52px top bar with search trigger and quick status.
- **Map**: Occupies 100% of mobile screen.
- **Bottom Intelligence Sheet**:
  - **Collapsed (Peek State - 80px)**: Displays Current Risk Score, Status Badge, and Primary Hazard snippet.
  - **Expanded State (Swipe up / Tap)**: Opens complete explainability panel, static/dynamic breakdown, active news links, and RESQ Mode action button.

---

## 4. API Integration Plan

A centralized client API module `client/src/services/api.js` will encapsulate all server communications:

```
CLIENT (React 19)
    │
    ├── 1. Geocoding & Place Search ────────► GET /api/geocode?q={query}
    │
    ├── 2. Point-to-Grid Lookup     ────────► GET /api/grid/point?lat={lat}&lon={lon}
    │
    ├── 3. Grid Risk Explainability ────────► GET /api/risk/grid/{gridId}
    │
    ├── 4. Bounded Grid Query       ────────► POST /api/grid/intersect (bbox)
    │
    └── 5. Live Disaster Events     ────────► GET /api/news/events/active
```

---

## 5. Phase-by-Phase Implementation Roadmap

```
Phase 0: Audit & Architecture Blueprint (COMPLETE)
   │
   ▼
Phase 1: RESQ Dashboard Shell & Theme Refinement
   │ ↳ Refine TopBar with search pill, live status badge, and navigation tabs
   │ ↳ Update tokens.css with clean white & slate surfaces and risk colors
   │
   ▼
Phase 2: Base Map Tile Integration & Layer Switcher
   │ ↳ Integrate high-performance OpenStreetMap / Carto raster tile substrate
   │ ↳ Floating bottom layer switcher (Normal, 3D Terrain, Satellite, Hybrid, Risk Grid)
   │
   ▼
Phase 3: Location Search & Server Geocoder Integration
   │ ↳ Server-side gazetteer route `/api/geocode` (Districts, towns, highways, bridges)
   │ ↳ Frontend auto-complete search dropdown with instant fly-to animation
   │
   ▼
Phase 4: Grid Risk API Client & State Store
   │ ↳ `client/src/services/api.js` client layer
   │ ↳ Reactive selection state store for active grid cell / coordinates
   │
   ▼
Phase 5: 500m Risk Grid Bounded Rendering
   │ ↳ BBox-driven grid cell loading for visible viewport (preventing heavy DOM)
   │ ↳ Risk-band colorized polygon fills (LOW, MODERATE, HIGH, CRITICAL)
   │
   ▼
Phase 6: Active Disaster Event Overlays & Markers
   │ ↳ Fetch live events from `/api/news/events/active`
   │ ↳ Render distinct pins for Floods, Landslides, Bridge Closures, Road Blockages
   │ ↳ Interactive event popup card on marker click
   │
   ▼
Phase 7: Explainable Right Intelligence Panel
   │ ↳ Live Risk Circular Gauge / Meter Bar
   │ ↳ Static vs. Dynamic Risk Breakdown
   │ ↳ Active Hazards list with additive risk weights (+32, +30, etc.)
   │ ↳ Confidence & Media Evidence links
   │
   ▼
Phase 8: Responsive Mobile Bottom-Sheet UX
   │ ↳ Touch-friendly expandable bottom sheet
   │ ↳ Responsive layouts across 375px (mobile) to 1920px (ultrawide)
   │
   ▼
Phase 9: RESQ Mode Relief Routing UX Shell
   │ ↳ Vehicle selector (Ambulance, Relief Truck, 4x4, Water Tanker)
   │ ↳ Cargo type selector (Medical, Food, Water, Relief Goods)
   │
   ▼
Phase 10: Route Safety Preview & Future Valhalla Contract
   │ ↳ Route intelligence placeholder & safety status contract (SAFE, CAUTION, AVOID, BLOCKED)
```

---

## 6. Files to be Created / Modified

### Files to be Modified
- `client/src/styles/tokens.css` (Update surfaces to clean white/slate theme + brand accents)
- `client/src/app/TopBar.jsx` (Search input, suggestions, live status, RESQ branding)
- `client/src/app/AppShell.jsx` (Responsive mobile & desktop shell)
- `client/src/panels/ContextPanel.jsx` (Connect real `/api/risk/grid/:gridId` data & explainability breakdown)
- `client/src/map/MapSurface.jsx` (Mount raster base tiles & vector risk grid canvas)
- `client/src/map/MapChrome.jsx` (Layer switcher, vertical map controls)
- `client/src/lib/riskBands.js` (Harmonize thresholds with backend `DYNAMIC_RISK_CONFIG`)
- `server/app.js` & `server/routes/` (Add `/api/geocode` gazetteer search endpoint)

### Files to be Created
- `client/src/services/api.js` (Centralized API client for geocoding, risk, grid, and events)
- `client/src/map/BaseTiles.jsx` (Raster tile layer renderer for OSM/Carto/Satellite)
- `client/src/map/RiskGridLayer.jsx` (Efficient viewport grid renderer)
- `client/src/map/EventMarkersLayer.jsx` (Disaster event pins and popup tooltips)
- `client/src/map/LayerSwitcher.jsx` (Bottom floating layer control pill)
- `client/src/panels/RiskOverviewTab.jsx` (Live risk score, status, static/dynamic split)
- `client/src/panels/HazardBreakdownTab.jsx` (Explainability list, active evidence, confidence)
- `client/src/panels/ResqModeTab.jsx` (Emergency relief routing UX structure)
- `server/routes/geocodeRoutes.js` (Gazetteer and district geocoding server route)

---

## 7. Risks & Mitigation Strategies

1. **DOM Overload from 408,986 Grid Cells**:
   - *Mitigation*: Never render full-state polygon sets at once. Render grid cells only when zoom level is $\ge 12.0$ and restrict spatial queries strictly to the active viewport BBox.
2. **Offline / Network Latency for Geocoding**:
   - *Mitigation*: Built-in local fallback gazetteer for all 47 districts and 150+ regional towns in Assam & Meghalaya.
3. **Preserving Teammate Contributions**:
   - *Mitigation*: Zero deletions of existing UI components; reuse and extend `client/src/ui/` primitives and map viewport context.
