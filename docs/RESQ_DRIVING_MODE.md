# RESQ Turn-by-Turn Driving Navigation Architecture

## Overview
RESQ features an integrated real-time Turn-by-Turn Driving Navigation mode powered by high-resolution regional Valhalla routing (`127.0.0.1:8002`), high-accuracy browser geolocation (`navigator.geolocation.watchPosition`), kinematics smoothing, MapLibre WebGL camera perspective, maneuver progression, off-route detection with automatic rerouting, and session recovery.

---

## 1. End-to-End System Architecture

```
 ┌────────────────────────┐
 │   User Searches Place  │
 └───────────┬────────────┘
             │
 ┌───────────▼────────────┐
 │  Destination Selected  │
 └───────────┬────────────┘
             │
 ┌───────────▼────────────┐
 │     Get Directions     │
 └───────────┬────────────┘
             │
 ┌───────────▼────────────┐
 │  SourceAddressModal    │
 │ (GPS or Search Origin) │
 └───────────┬────────────┘
             │
 ┌───────────▼────────────┐
 │    POST /api/route     │
 │    Valhalla Engine     │
 └───────────┬────────────┘
             │
 ┌───────────▼────────────┐
 │      Route Preview     │
 │  (Distance, ETA, Steps)│
 └───────────┬────────────┘
             │
 ┌───────────▼────────────┐
 │    START NAVIGATION    │
 └───────────┬────────────┘
             │
 ┌───────────▼──────────────────────────────────────────────────────┐
 │                      FULLSCREEN DRIVING MODE                     │
 │                                                                  │
 │  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
 │  │   Live GPS Watcher   │  │       Kinematics Engine          │  │
 │  │ (watchPosition 2000ms│  │ (Heading smoothing & Speed km/h) │  │
 │  └──────────┬───────────┘  └────────────────┬─────────────────┘  │
 │             │                               │                    │
 │             ▼                               ▼                    │
 │  ┌────────────────────────────────────────────────────────────┐  │
 │  │                   Sliding Route Matching                   │  │
 │  │      (findNearestRouteProgress: index, crossTrack)         │  │
 │  └──────────┬───────────────────────────────┬─────────────────┘  │
 │             │                               │                    │
 │             ▼                               ▼                    │
 │  ┌──────────────────────┐      ┌──────────────────────────────┐  │
 │  │ Maneuver Progression │      │     Off-Route Detection      │  │
 │  │ (Current & Next Step)│      │  (crossTrack > 35m for 4s)   │  │
 │  └──────────┬───────────┘      └────────────┬─────────────────┘  │
 │             │                               │                    │
 │             │                               ▼                    │
 │             │                  ┌──────────────────────────────┐  │
 │             │                  │     Auto-Reroute Handler     │  │
 │             │                  │  (Valhalla from current GPS) │  │
 │             │                  └──────────────────────────────┘  │
 │             │                                                    │
 │             ▼                                                    │
 │  ┌────────────────────────────────────────────────────────────┐  │
 │  │                  MapLibre Visual Canvas                    │  │
 │  │  - Vehicle Marker (Puck + Directional Chevron + Pulse)      │  │
 │  │  - 55° Navigation Camera with Speed-Adaptive Zoom          │  │
 │  │  - Camera Follow Mode & Recenter Floating Action Button    │  │
 │  └────────────────────────────────────────────────────────────┘  │
 │                                                                  │
 │  ┌────────────────────────────────────────────────────────────┐  │
 │  │                 ResqNavigationOverlay (HUD)                │  │
 │  │  - Top: Turn Maneuver Banner, Distance & Next Step Preview │  │
 │  │  - Bottom: ETA, Remaining Distance, Speed, Steps & Exit    │  │
 │  └────────────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Navigation Subsystems

### 1. Navigation State Store (`client/src/services/routeStore.js`)
- Single source of truth managing:
  - `navigationMode`: `'idle'` | `'preview'` | `'driving'`
  - `navigationStatus`: `'idle'` | `'navigating'` | `'off_route'` | `'recalculating'` | `'arrived'`
  - `currentPosition`: `{ lat, lon, accuracy, speedKmh, heading, timestamp }`
  - `currentManeuverIndex` & `nextManeuverIndex`
  - `distanceToNextManeuverKm` & `remainingDistanceKm` & `remainingDurationSeconds`
  - `cameraFollowing`: boolean

### 2. Spatial Mathematics & Progress Matching (`client/src/navigation/navigationMath.js`)
- **Haversine Distance**: High-precision spherical distance calculation in kilometers and meters.
- **Initial Bearing**: Angular direction ($0 - 360^\circ$) from point $A$ to point $B$.
- **Cross-Track Distance**: Planar-projected orthogonal distance (in meters) from a GPS fix to adjacent route line segments.
- **Sliding Window Search**: `findNearestRouteProgress(lat, lon, geometry, currentIndex, 15, 60)` bounds search complexity to $O(W)$ rather than scanning the full geometry ($O(N)$) every second.

### 3. Driving Mode Engine Hook (`client/src/navigation/useResqDrivingMode.js`)
- Starts `navigator.geolocation.watchPosition` with `{ enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }`.
- Derives heading with trajectory forward bearing fallback when stationary or raw sensor is unavailable.
- Computes vehicle speed ($m/s \rightarrow km/h$) with smoothing buffer.
- Advances maneuver index when vehicle passes turn transition vertex (`endShapeIndex`).
- Detects arrival when distance to destination $< 35\text{ m}$ and vehicle is near the final maneuver.

### 4. Off-Route Detection & Automatic Normal Rerouting
- **Trigger Condition**: Sustained cross-track distance $> 35\text{ m}$ for $\ge 4000\text{ ms}$ with GPS accuracy $\le 40\text{ m}$.
- **Protection Mechanics**:
  - Request lock (`isRerouteInFlightRef`) preventing concurrent requests.
  - Cooldown timer ($10\text{ seconds}$ minimum interval).
  - `AbortController` cancelling previous requests.
  - Automatically calculates new route from `[currentLon, currentLat]` to `destination` and seamlessly replaces active trajectory.

### 5. Vehicle Navigation Marker (`client/src/navigation/resqVehicleMarker.js`)
- Directional arrow puck with blue/indigo gradient, 3px white casing, and pulsing halo ring.
- Uses `marker.setLngLat([lon, lat])` and updates CSS `transform: rotate(${heading}deg)` smoothly without recreating DOM elements.

### 6. Navigation Camera Manager (`client/src/navigation/resqCameraManager.js`)
- **Perspective**: $55^\circ$ pitch with vehicle positioned in the lower third of the screen.
- **Speed-Adaptive Zoom**:
  - $\le 20\text{ km/h} \rightarrow 17.6$
  - $20 - 45\text{ km/h} \rightarrow 17.0$
  - $45 - 75\text{ km/h} \rightarrow 16.2$
  - $> 75\text{ km/h} \rightarrow 15.2$
- **User Interaction Detection**: Drag, zoom, rotate, and pitch gestures disable follow mode (`cameraFollowing = false`).
- **Recenter Control**: Floating action button restores follow mode and eases camera back to vehicle.

### 7. UI Overlay & HUD (`client/src/navigation/ResqNavigationOverlay.jsx`)
- **Top Maneuver Card**: Large turn icon, distance to turn (e.g. `180 m`), primary instruction, and secondary upcoming turn preview.
- **Bottom Navigation HUD**: High-contrast ETA (`14:32`), remaining distance (`8.4 km`), live speed (`52 km/h`), and action buttons (`Steps`, `Exit`).
- **Steps Drawer**: Complete scrollable list of all maneuvers with street names, distance, and active step highlighted.
- **Full Viewport Shell**: Hides normal dashboard sidebars and TopBar to provide a clean $100\text{vw} \times 100\text{dvh}$ experience.

### 8. Session Persistence & Cleanup
- Saved in `localStorage` under `resq_active_navigation_session`.
- Restores route on reload if session is $< 2\text{ hours}$ old.
- Complete teardown on Exit or Arrival: stops `watchPosition`, removes vehicle marker, restores map camera to overhead 2D overview, and clears session.

---

## 3. Status Summary & Next Phases

| Component | Status | Next Layer |
| :--- | :--- | :--- |
| **Normal Route Calculation** | ✅ Production Verified | Multi-vehicle profiles |
| **Route Preview & Stats** | ✅ Production Verified | Alternative route switching |
| **Live GPS Tracking** | ✅ Production Verified | High-frequency sensor fusion |
| **Vehicle Directional Marker** | ✅ Production Verified | Custom relief vehicle icons |
| **55° Navigation Camera** | ✅ Production Verified | 3D terrain mesh integration |
| **Turn-by-Turn Progression** | ✅ Production Verified | Audio voice guidance |
| **Off-Route Auto-Reroute** | ✅ Production Verified | Dynamic disaster risk rerouting |
| **Session Persistence & Cleanup** | ✅ Production Verified | Cloud route sync |
| **Risk-Aware Safe Routing** | 🟡 Next Phase | Real-time flood/landslide scoring |
