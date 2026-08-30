# RESQ Risk-Aware Routing & Live Dynamic Navigation Engine

## 1. Architecture Overview

RESQ decouples physical road network calculation from regional disaster intelligence:
- **Valhalla Engine (`resq-valhalla` Docker, Port 8002)**: Physical road network routing engine running 513 regional OSM tiles across Assam and Meghalaya.
- **RESQ PostGIS Spatial Intelligence (PostGIS 500m SSOT)**: 408,986 cells across Assam (`grid_500m.assam`) and Meghalaya (`grid_500m.meghalaya`) maintaining static and dynamic multi-hazard risk scores.
- **Route Risk Evaluation Engine (`routeRiskService.js`)**: Intersects physical trajectories with 500m grid polygons using `ST_Intersects` and trajectory ordering with `ST_LineLocatePoint`.
- **Safe Candidate Ranking Service (`riskAwareRoutingService.js`)**: Evaluates multi-alternative Valhalla trajectories, enforces hard block exclusions, and balances risk exposure against detour duration.
- **Active Navigation Monitor (`routeMonitorService.js`)**: Tracks vehicle GPS progress, isolates remaining route grids, detects live risk escalations, and executes dynamic reroutes.

```
+-------------------------------------------------------------------------------+
|                             RESQ CLIENT (React)                               |
|  Search Place -> Fast / Safe Mode -> Turn Preview -> Start Turn-by-Turn Drive |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                             RESQ ROUTING API                                  |
|                 POST /api/route (mode: 'fastest' | 'safe')                    |
+-------------------------------------------------------------------------------+
         |                                                 |
         v                                                 v
+------------------------+                     +-------------------------------+
|    VALHALLA DOCKER     |                     |     POSTGIS 500m SSOT         |
|  Physical Trajectories |                     |  408,986 Grid Cells           |
|  Alternatives 1..3     |                     |  Active Disaster Hazards      |
+------------------------+                     +-------------------------------+
         |                                                 |
         +------------------------+------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------------+
|                        SAFE ROUTE CANDIDATE RANKING                           |
|  1. Hard Block Exclusion (isBlocked / road_closure >= 80)                     |
|  2. Critical Hazard Penalization (criticalCount, maxRisk)                     |
|  3. Safe Score Optimization: 0.55 * Risk + 0.25 * Detour + 0.20 * Critical    |
+-------------------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------------+
|                       ACTIVE ROUTE MONITORING & HUD                           |
|  GPS Progress Tracking -> Trim Passed Grids -> Live Hazard Alert -> Reroute   |
+-------------------------------------------------------------------------------+
```

---

## 2. Fast Route vs. Safe Route

| Metric / Behavior | Fast Route (`mode: 'fastest'`) | Safe Route (`mode: 'safe'`) |
| :--- | :--- | :--- |
| **Primary Objective** | Minimum travel time (Valhalla default auto costing) | Minimum disaster exposure with reasonable travel time |
| **Grid Evaluation** | Evaluates and presents risk snapshot transparently | Actively rejects dangerous paths and ranks alternatives |
| **Hard Block Enforcement** | Flags route if blocked; does not alter trajectory | Automatically detours around confirmed closures |
| **Candidate Count** | Primary physical route + up to 2 alternatives | Requests 3+ candidates and ranks across safety metrics |
| **User Output** | Duration, distance, and corridor risk profile | Safe route, comparison against fastest, avoided hazards, reason |

---

## 3. 500m Grid Extraction Pipeline

When a route is calculated:
1. Coordinates are extracted into a GeoJSON `LineString`.
2. PostGIS spatial index query intersects the line geometry with `grid_500m.assam` and `grid_500m.meghalaya`.
3. `ST_LineLocatePoint(r.geom, ST_ClosestPoint(g.geom, r.geom))` mathematically orders every crossed cell from `0.0` (origin) to `1.0` (destination).
4. `ST_DWithin(r.geom::geography, e.geom::geography, 250)` identifies active disaster events and infrastructure closures along the 250m corridor.

---

## 4. Route Risk Model & Metrics

For every evaluated trajectory, RESQ computes:
- **`meanRisk`**: Average `risk_score` across all crossed 500m cells.
- **`maxRisk`**: Highest single grid risk on the route.
- **`highRiskGridCount`**: Cells with `risk_score >= 45.0` (`HIGH`).
- **`criticalGridCount`**: Cells with `risk_score >= 70.0` (`CRITICAL`).
- **`activeHazardCount`**: Total active events within the 250m corridor.
- **`blockedSegmentCount`**: Confirmed closures (`road_blocked`, `bridge_closed`, `road_closure_risk >= 80`).
- **`isBlocked`**: `true` if `blockedSegmentCount > 0`.
- **`routeStatus`**:
  - `BLOCKED`: If `isBlocked === true`
  - `CRITICAL`: If `criticalGridCount > 0` or `maxRisk >= 70.0`
  - `HIGH_RISK`: If `highRiskGridCount > 0` or `meanRisk >= 45.0`
  - `CAUTION`: If `meanRisk >= 25.0`
  - `SAFE`: Default low baseline risk

---

## 5. Hard Block Conditions

A route is classified as `BLOCKED` when it intersects:
- Confirmed bridge collapse, closure, or washout.
- Confirmed road collapse or structural barrier.
- Grid cells with dynamic `road_closure_risk >= 80.0`.

A blocked route is never designated as safe, even if 99% of its trajectory traverses low-risk terrain.

---

## 6. Safe Route Candidate Ranking

Safe route ranking applies a multi-objective cost function:

$$\text{SafeScore} = 0.55 \cdot \left(\frac{\text{meanRisk}}{100}\right) + 0.25 \cdot \min\left(2.5, \frac{\text{durationSec}}{\text{minDurationSec}}\right) + 0.20 \cdot \min\left(1.0, \frac{\text{criticalCount}}{5}\right)$$

### Candidate Selection Rules:
1. **Blocked Exclusion**: Candidates with `isBlocked === true` are excluded if at least one open alternative exists.
2. **Safe Score Minimization**: The lowest composite safe score candidate is selected.
3. **Comparative Explanation**: Compares selected route with fastest candidate to isolate `avoidedHazards`, `riskReduction` points, and `extraTimeMinutes`.

---

## 7. Active Navigation Monitoring & Dynamic Rerouting

When driving mode is initiated (`startDriving`):
1. **Session Registration (`POST /api/route/monitor/register`)**:
   - Stores session state: `sessionId`, `routeGeometry`, `orderedGrids`, `remainingGridIds`.
2. **GPS Progress Tracking (`POST /api/route/monitor/progress`)**:
   - Vehicle location updates calculate progress fraction along the route.
   - Cells passed behind the vehicle are trimmed from `remainingGridIds`.
3. **Hazard Ahead Isolation**:
   - Risk events occurring behind the vehicle do not trigger reroutes.
   - Only hazards on remaining cells ahead are evaluated.
4. **Hysteresis & Cooldown**:
   - `MIN_RISK_DELTA_FOR_REROUTE`: 12.0 points.
   - `REROUTE_COOLDOWN_MS`: 10,000 ms (bypassed if route becomes physically `BLOCKED`).
5. **Dynamic Reroute Execution (`POST /api/route/reroute`)**:
   - Origin is set to vehicle's current GPS position.
   - Valhalla queries new bypass candidates.
   - PostGIS risk-evaluates new candidates.
   - Map smoothly transitions to new trajectory without resetting user location.
   - Route version increments (`v1` $\rightarrow$ `v2`), and monitoring continues.

---

## 8. Frontend Navigation Overlay & HUD

- **Top Maneuver Banner**: Turn icon, distance countdown, primary instruction, next turn preview (`THEN`), and active hazard alert strip.
- **Dynamic Notice Banner**:
  - `⚠ ROUTE RISK CHANGED`: Hazard detected ahead; finding safer route.
  - `✓ SAFER ROUTE FOUND`: Safer bypass selected; navigation seamlessly updated.
- **Bottom Navigation Dock**:
  - Triad metrics: Remaining Time (ETA), Remaining Distance (km), Live Speed (km/h).
  - Risk Monitor Pill: Pulsing green/amber/red status badge with live mean risk score.
  - Action Controls: Steps Drawer toggle and Exit button.
- **Frosted Glassmorphism**: Complete UI styled using RESQ translucent white glassmorphic tokens (`backdrop-filter: blur(28px) saturate(190%)`).

---

## 9. Verification & API Reference

### Endpoints
- `POST /api/route`: Compute fast or safe route with 500m risk evaluation.
- `GET /api/route/health`: Check Valhalla service health and tile status.
- `POST /api/route/monitor/register`: Register navigation session.
- `POST /api/route/monitor/progress`: Report vehicle progress along route.
- `GET /api/route/monitor/:sessionId`: Query session risk snapshot.
- `POST /api/route/monitor/simulate-risk`: Development test endpoint to trigger controlled risk changes.
- `POST /api/route/reroute`: Execute dynamic reroute from current location.
- `DELETE /api/route/monitor/:sessionId`: Destroy active navigation session.
