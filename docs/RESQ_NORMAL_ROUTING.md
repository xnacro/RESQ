# RESQ Normal Physical Routing & Navigation

## Overview
RESQ integrates a local Valhalla routing engine (`127.0.0.1:8002`) built with high-resolution OpenStreetMap (OSM) regional data covering Assam and Meghalaya.

This document covers the end-to-end normal physical routing pipeline:
**Search Destination $\rightarrow$ Select Destination $\rightarrow$ Get Directions $\rightarrow$ Source Selection $\rightarrow$ POST /api/route $\rightarrow$ Valhalla $\rightarrow$ Normalization $\rightarrow$ Route Preview $\rightarrow$ Turn-by-Turn Maneuvers**.

---

## 1. Flow Architecture

```
                                  [ User Action ]
                                         │
                                ┌────────▼────────┐
                                │ Search Location │
                                └────────┬────────┘
                                         │
                             ┌───────────▼───────────┐
                             │ Destination Selected  │
                             └───────────┬───────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   Get Directions    │
                              └──────────┬──────────┘
                                         │
                             ┌───────────▼───────────┐
                             │  SourceAddressModal   │
                             │                       │
                             │ [Use Current Location]│
                             │ [Search Start Address]│
                             └───────────┬───────────┘
                                         │ Origin Resolved
                                         ▼
                            POST /api/route (Client)
                                         │
                             ┌───────────▼───────────┐
                             │ Express Route API     │
                             │ (server/routes)       │
                             └───────────┬───────────┘
                                         │
                             ┌───────────▼───────────┐
                             │ Valhalla Service      │
                             │ (server/services)     │
                             └───────────┬───────────┘
                                         │
                             ┌───────────▼───────────┐
                             │ Valhalla Engine       │
                             │ (:8002/route)         │
                             └───────────┬───────────┘
                                         │ Polyline6 Shape & Raw Legs
                                         ▼
                             ┌───────────────────────┐
                             │ GeoJSON & Maneuver    │
                             │ Normalizer            │
                             └───────────┬───────────┘
                                         │ Clean GeoJSON + Maneuver List
                                         ▼
                             ┌───────────────────────┐
                             │ MapLibre Route Layer  │
                             │ & RouteSummaryPanel   │
                             └───────────────────────┘
```

---

## 2. API Endpoints

### 1. Health Check
- **Endpoint**: `GET /api/route/health`
- **Response**:
```json
{
  "success": true,
  "status": "healthy",
  "valhallaVersion": "3.8.3-1a53e4e5c",
  "coverage": "Assam + Meghalaya",
  "timestamp": "2026-08-30T07:35:00.000Z"
}
```

### 2. Route Calculation
- **Endpoint**: `POST /api/route`
- **Request Body**:
```json
{
  "origin": [91.7362, 26.1445],
  "destination": [91.8933, 25.5788],
  "mode": "car",
  "units": "kilometers",
  "alternatives": 2
}
```
- **Response**:
```json
{
  "success": true,
  "route": {
    "distanceKm": 98.65,
    "durationSeconds": 6840,
    "durationMinutes": 114,
    "geometry": [
      [91.7362, 26.1445],
      [91.7363, 26.1448]
    ],
    "instructions": [
      {
        "type": 1,
        "typeName": "start",
        "icon": "start",
        "instruction": "Drive south.",
        "verbalInstruction": "Drive south.",
        "streetNames": ["GS Road"],
        "distanceKm": 1.2,
        "durationSeconds": 140,
        "beginShapeIndex": 0,
        "endShapeIndex": 24
      }
    ],
    "boundingBox": {
      "minLat": 25.5788,
      "minLon": 91.7362,
      "maxLat": 26.1445,
      "maxLon": 91.8933
    },
    "summary": {
      "hasTolls": false,
      "hasHighways": true,
      "hasFerries": false
    }
  }
}
```

---

## 3. Frontend Architecture

### 1. State Store (`client/src/services/routeStore.js`)
- Stores active route data, origin, destination, routing states (`isRouting`, `routingError`), and modal states.
- Implements `AbortController` cancellation and request ID sequencing to prevent race conditions.

### 2. Origin Modal (`client/src/panels/SourceAddressModal.jsx`)
- **Option A (GPS)**: Uses `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`.
- **Option B (Manual Search)**: Uses `/api/geocode?q=...` with debouncing for localities, towns, bridges, and grid cells across Assam and Meghalaya.

### 3. MapLibre WebGL Layer (`client/src/map/MapSurface.jsx`)
- Layer IDs:
  - `resq-route-source`: GeoJSON feature source
  - `resq-route-casing`: 8px casing stroke (`#1d4ed8`)
  - `resq-route-line`: 5px main route stroke (`#3b82f6`)
- Origin marker (`A`, green dot) and Destination marker (`B`, red dot) rendered at start and end coordinates.
- Dynamic `fitBounds` with screen-aware padding to ensure routes are never obscured by UI sidebars.

### 4. Route Summary Panel (`client/src/panels/RouteSummaryPanel.jsx`)
- Shows route origin/destination path strip, distance, ETA duration, Fast Route badge (Safe Route marked for future risk engine), and turn-by-turn maneuvers with directional icons.

---

## 4. Current Scope & Next Phases

| Feature | Current State | Next Phase |
| :--- | :--- | :--- |
| **Valhalla Routing API** | ✅ Active (`POST /api/route`) | Vehicle-specific profiles |
| **Search & Geocoding** | ✅ Active (Regional gazetteer + upstream) | Offline geocoding cache |
| **Origin Selection Modal** | ✅ Active (GPS & manual address) | Saved depot presets |
| **Map Route Rendering** | ✅ Active (`resq-route-line` on MapLibre) | Animated route pulse |
| **Turn-by-Turn Preview** | ✅ Active (Maneuver cards & icons) | Audio voice guidance |
| **Safe / Risk-Aware Routing** | 🟡 Disabled placeholder in UI | Dynamic flood/landslide risk penalty |
| **Live Driving Navigation** | 🟡 Next (Commit 3 & 4) | 55° pitch GPS follow & off-route reroute |
