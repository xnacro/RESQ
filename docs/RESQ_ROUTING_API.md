# RESQ Production Routing API Reference

This document specifies the RESQ routing API architecture, HTTP endpoints, request and response contracts, vehicle costing profiles, error handling, and performance characteristics.

---

## 1. Architectural Overview

RESQ decouples physical road graph calculation from application-level risk intelligence:

```
+-------------------------------------------------------------+
|                      RESQ Client / UI                       |
+-------------------------------------------------------------+
                              │
                    POST /api/route
                              │
                              ▼
+-------------------------------------------------------------+
|                     RESQ Routing API                        |
|   • Coordinate & Bounds Validation (Assam & Meghalaya)      |
|   • Vehicle Costing & Mode Resolver                         |
|   • Upstream Error Mapping & Resilience                     |
+-------------------------------------------------------------+
                              │
               POST http://127.0.0.1:8002/route
                              │
                              ▼
+-------------------------------------------------------------+
|                 Valhalla Engine (Docker)                    |
|   • Regional Graph (513 Northeast India OSM Tiles)          |
|   • Automotive Shortest / Fastest Graph Search              |
|   • Turn Maneuver Generation & Multi-Route Alternates       |
+-------------------------------------------------------------+
                              │
                              ▼
+-------------------------------------------------------------+
|              RESQ Response Normalizer (Service)             |
|   • Polyline6 -> GeoJSON [[lon, lat], ...]                  |
|   • Maneuver Typing & Step Index Preservation               |
|   • Summary & Bounding Box Extraction                       |
+-------------------------------------------------------------+
```

---

## 2. API Endpoints

### 2.1 Calculate Route
- **Method**: `POST`
- **Path**: `/api/route` (or `/api/routes`)
- **Content-Type**: `application/json`

#### Request Headers
| Header | Value | Description |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Required |

#### Request Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `origin` | `Object` | Yes | - | `{ "lat": Number, "lon": Number }` start location |
| `destination` | `Object` | Yes | - | `{ "lat": Number, "lon": Number }` end location |
| `mode` | `String` | No | `"fastest"` | Routing strategy: `"fastest"` (active), `"balanced"`, `"safe"` (Stage 3) |
| `vehicle` | `String` | No | `"car"` | Vehicle profile: `"car"`, `"ambulance"`, `"relief_truck"`, `"4x4"`, `"water_tanker"` |
| `alternatives` | `Number` | No | `2` | Number of alternative paths to request (0 to 4) |

#### Example Request
```json
{
  "origin": {
    "lat": 26.1445,
    "lon": 91.7898
  },
  "destination": {
    "lat": 25.5788,
    "lon": 91.8933
  },
  "mode": "fastest",
  "vehicle": "relief_truck",
  "alternatives": 2
}
```

---

## 3. Response Contract

#### Example Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "routingEngine": "resq",
  "routeId": "resq_route_1788074000000_a1b2c3",
  "mode": "fastest",
  "vehicle": {
    "type": "relief_truck",
    "costingProfile": "auto"
  },
  "latencyMs": 47,
  "route": {
    "distanceKm": 90.82,
    "durationSeconds": 6100,
    "durationMinutes": 102,
    "geometry": [
      [91.789893, 26.144291],
      [91.790012, 26.144155],
      [91.893301, 25.578812]
    ],
    "summary": {
      "hasTolls": false,
      "hasHighway": true,
      "hasFerry": false,
      "hasTimeRestrictions": false
    },
    "boundingBox": {
      "minLat": 25.578812,
      "minLon": 91.789893,
      "maxLat": 26.144291,
      "maxLon": 91.893301
    },
    "instructions": [
      {
        "type": 1,
        "typeName": "Start",
        "instruction": "Drive east.",
        "verbalInstruction": "Drive east.",
        "streetNames": ["GS Road"],
        "distanceKm": 0.35,
        "durationSeconds": 45,
        "beginShapeIndex": 0,
        "endShapeIndex": 5
      }
    ]
  },
  "alternatives": [
    {
      "alternativeIndex": 1,
      "distanceKm": 98.4,
      "durationSeconds": 6620,
      "durationMinutes": 110,
      "geometry": [ ... ],
      "summary": { ... },
      "boundingBox": { ... },
      "instructions": [ ... ]
    }
  ]
}
```

---

## 4. Supported Vehicles & Costing Mapping

| RESQ Vehicle Type | Mapped Costing Profile | Note |
| :--- | :--- | :--- |
| `car` | `auto` | Standard motor vehicle physical graph routing |
| `ambulance` | `auto` | Emergency medical transport; mapped to automotive costing in foundation phase |
| `relief_truck` | `auto` | Heavy disaster relief vehicle; restriction weights added in Stage 3 |
| `4x4` | `auto` | High-clearance tactical response vehicle |
| `water_tanker` | `auto` | Heavy water supply logistics vehicle |

---

## 5. Regional Coverage Bounds

Coordinates must fall within the regional bounding box covering Assam and Meghalaya:

- **Latitude**: `24.0° N` to `28.5° N`
- **Longitude**: `89.0° E` to `97.5° E`

Requests containing coordinates outside these bounds are rejected immediately with `ROUTING_OUTSIDE_COVERAGE` (HTTP 422) without burdening the upstream Valhalla daemon.

---

## 6. Standardized Error Codes

All errors return a structured JSON response:

```json
{
  "success": false,
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<Human-readable description>",
    "details": "<Optional metadata>"
  }
}
```

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400 Bad Request` | Missing required coordinates, non-numeric values, or out of lat/lon range |
| `ROUTE_NOT_FOUND` | `404 Not Found` | No navigable road connection found between origin and destination |
| `ROUTING_OUTSIDE_COVERAGE` | `422 Unprocessable Entity` | Coordinates lie outside active Assam-Meghalaya routing bounds |
| `MODE_NOT_IMPLEMENTED` | `501 Not Implemented` | Requested `mode="safe"` or `"balanced"` before Stage 3 risk layer deployment |
| `ROUTING_ENGINE_UNAVAILABLE`| `503 Service Unavailable` | Local Valhalla container is stopped or unreachable on port 8002 |
| `ROUTING_TIMEOUT` | `504 Gateway Timeout` | Routing calculation exceeded 5000ms threshold |

---

## 7. Performance Benchmarks

Measured on local WSL2 Docker environment with 4 worker threads:

- **Local Routes (Assam)**: 15–35 ms
- **Regional Routes (Meghalaya)**: 25–45 ms
- **Cross-State Corridor (Guwahati $\leftrightarrow$ Shillong)**: 35–65 ms
- **Normalization Overhead**: < 2 ms (Polyline6 decoding and GeoJSON array formatting)
