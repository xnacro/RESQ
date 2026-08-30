# RESQ Valhalla Regional Routing Engine Setup

This document outlines the architecture, installation, configuration, operational performance metrics, and validation procedures for the RESQ Valhalla routing engine covering Northeast India (Assam & Meghalaya).

---

## 1. Target Geographic Scope

- **Primary States**: Assam + Meghalaya
- **OSM Source Extract**: Geofabrik North-Eastern Zone
- **PBF URL**: `https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf`
- **PBF Size**: 109,199,879 bytes (104.1 MB)
- **PBF MD5 Checksum**: `1f3194cb3eafc45326017f7f091aeade`
- **PBF Snapshot Timestamp**: Sat, 29 Aug 2026 22:37:49 GMT

---

## 2. Docker & Valhalla Engine Specifications

- **Valhalla Version**: `3.8.3-1a53e4e5c`
- **Docker Base Image**: `ghcr.io/valhalla/valhalla-scripted:latest` (Ubuntu 24.04 runtime)
- **Container Name**: `resq-valhalla`
- **Host Binding**: `127.0.0.1:8002:8002` (strictly bound to localhost)
- **Costing Profiles**: `auto` (standard motor vehicle routing)
- **Environment Flags**:
  - `build_admins=True`
  - `build_time_zones=True`
  - `build_elevation=False`
  - `build_transit=False`
  - `build_tar=True`
  - `use_tiles_ignore_pbf=True`
  - `use_default_speeds_config=True`
  - `server_threads=4`

---

## 3. Directory Structure & Volume Layout

All raw PBF files and generated routing tile hierarchies reside locally in `data/valhalla/` and are explicitly excluded from Git version control via `.gitignore`:

```
f:\RESQ/
├── routing/
│   ├── docker-compose.yml       # Valhalla container service definition
│   └── scripts/
│       └── verify_routing.js     # Regional multi-state test suite
├── data/
│   └── valhalla/
│       ├── osm/                 # Downloaded regional .osm.pbf extracts
│       ├── tiles/               # Uncompressed / intermediate tile sets
│       ├── config/              # Configuration artifacts
│       ├── logs/                # Container build and runtime logs
│       └── custom_files/        # Docker bind mount root (/custom_files)
│           ├── north-eastern-zone-latest.osm.pbf
│           ├── valhalla.json
│           ├── admins.sqlite
│           ├── timezones.sqlite
│           ├── default_speeds.json
│           ├── valhalla_tiles/
│           └── valhalla_tiles.tar
```

---

## 4. Build Performance Metrics (Measured)

| Metric | Measured Value |
| :--- | :--- |
| **Input PBF File Size** | 104.1 MB (109,199,879 bytes) |
| **PBF MD5 Hash** | `1f3194cb3eafc45326017f7f091aeade` |
| **Docker Host Memory** | 5.79 GiB total (WSL2 engine) |
| **Peak RSS During Tile Build** | ~1.56 GB |
| **Routable Ways Parsed** | 303,601 ways (7,702,896 nodes) |
| **Graph Nodes & Edges** | 531,785 nodes / 1,244,372 directed edges |
| **Shortcuts Generated** | Level 1: 13,866 shortcuts; Level 0: 4,836 shortcuts |
| **Generated Tiles Count** | 513 tiles (spanning local, level 1, and level 0 hierarchies) |
| **Output Tile Tar Extract Size** | 135.08 MB (`valhalla_tiles.tar`) |
| **Admin Database Size** | 8.34 MB (`admins.sqlite`) |
| **Timezone Database Size** | 121.56 MB (`timezones.sqlite`) |
| **Total Build Pipeline Duration** | ~5.8 minutes (Admin DB + TZ DB + Ways + Build + Enhance + Tar) |

---

## 5. Quick Start & Operational Commands

### 5.1 Starting the Container
```bash
# From repository root
docker compose -f routing/docker-compose.yml up -d
```

### 5.2 Stopping the Container
```bash
docker compose -f routing/docker-compose.yml down
```

### 5.3 Viewing Logs
```bash
docker logs -f resq-valhalla
```

### 5.4 Running Routing Verification Suite
```bash
node routing/scripts/verify_routing.js
```

---

## 6. Endpoints and Contracts

### 6.1 Health Check Endpoint
- **URL**: `GET http://127.0.0.1:8002/status`
- **Response**:
```json
{
  "version": "3.8.3-1a53e4e5c",
  "tileset_last_modified": 1788073337,
  "available_actions": [
    "tile",
    "status",
    "centroid",
    "expansion",
    "transit_available",
    "trace_attributes",
    "trace_route",
    "isochrone",
    "optimized_route",
    "sources_to_targets",
    "height",
    "route",
    "locate"
  ]
}
```

### 6.2 Route Endpoint
- **URL**: `POST http://127.0.0.1:8002/route`
- **Request Format**:
```json
{
  "locations": [
    { "lat": 26.1445, "lon": 91.7898, "type": "break" },
    { "lat": 25.5788, "lon": 91.8933, "type": "break" }
  ],
  "costing": "auto",
  "directions_options": {
    "units": "kilometers",
    "language": "en-US"
  }
}
```
- **Response Contract**:
  - `trip.status`: `0` for successful route computation
  - `trip.summary.length`: total road distance in requested units (km)
  - `trip.summary.time`: estimated duration in seconds
  - `trip.legs[0].shape`: high-precision `Polyline6` encoded coordinate string
  - `trip.legs[0].maneuvers`: ordered list of step-by-step driving instructions with street names and turn codes

---

## 7. Verified Route Test Scenarios

### Test 1: Assam Intra-State (Guwahati Dispur -> Guwahati Jalukbari)
- **Origin**: Dispur (`26.1445, 91.7898`)
- **Destination**: Jalukbari (`26.1550, 91.6660`)
- **Distance**: 16.58 km
- **Duration**: 2,090.78s (~34.8 minutes)
- **Maneuvers**: 18 turn steps
- **Geometry**: 1,286 character Polyline6 string

### Test 2: Meghalaya Intra-State (Shillong -> Nongpoh)
- **Origin**: Shillong (`25.5788, 91.8933`)
- **Destination**: Nongpoh (`25.9038, 91.8805`)
- **Distance**: 51.42 km
- **Duration**: 3,370.34s (~56.2 minutes)
- **Maneuvers**: 11 turn steps
- **Geometry**: 10,091 character Polyline6 string

### Test 3: Cross-State Corridor (Guwahati, Assam -> Shillong, Meghalaya)
- **Origin**: Guwahati Dispur (`26.1445, 91.7898`)
- **Destination**: Shillong (`25.5788, 91.8933`)
- **Distance**: 90.82 km
- **Duration**: 6,100.49s (~101.7 minutes)
- **Maneuvers**: 18 turn steps
- **Geometry**: 16,529 character Polyline6 string
- **Cross-State Road Connectivity**: Fully seamless across Assam-Meghalaya state boundary via NH 6 / GS Road corridor.

---

## 8. RESQ Backend Integration

- **Environment Variable**: `VALHALLA_URL=http://localhost:8002` configured in `server/.env` and `server/.env.example`.
- **Health Service**: [valhallaHealthService.js](file:///f:/RESQ/server/services/routing/valhallaHealthService.js) provides lightweight connectivity testing without exposing full routing API surfaces prematurely.

---

## 9. Data Update Strategy

When OSM road network data updates are required:
1. Download fresh `north-eastern-zone-latest.osm.pbf` from Geofabrik into `data/valhalla/osm/`.
2. Copy the new extract to `data/valhalla/custom_files/`.
3. Set `force_rebuild=True` in `routing/docker-compose.yml` or remove `data/valhalla/custom_files/file_hashes.txt`.
4. Restart the container:
   ```bash
   docker compose -f routing/docker-compose.yml down
   docker compose -f routing/docker-compose.yml up -d
   ```
5. Valhalla automatically detects updated PBF hash, executes `valhalla_build_tiles` pipeline, packs `valhalla_tiles.tar`, and reloads the live routing service.
