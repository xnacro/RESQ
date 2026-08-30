# RESQ Geocoding Architecture & Location Resolution Subsystem

## 1. Overview & Purpose

The **RESQ Geocoding Subsystem** is an integrated geospatial resolution engine designed specifically for disaster-intelligence operations across Assam, Meghalaya, and national transit corridors. It provides high-speed forward location search, geographic coordinate resolution, and reverse geocoding directly to RESQ's authoritative 500m operational grid cells.

---

## 2. System Architecture

```
                      RESQ Web Client (TopBar / MapView)
                                      │
                     REST API Contract (HTTP JSON)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        GET /api/geocode?q={query}          GET /api/geocode/reverse?lat={lat}&lon={lon}
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
                        RESQ Geocoding Service Layer
                   (server/services/geocoding/resqGeocoderService.js)
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
       ▼                              ▼                              ▼
Priority 1: 500m Grid ID     Priority 2: Regional Gazetteer   Priority 3: Infrastructure Corridors
(PostGIS Indexed Lookup)     (35 Assam & 12 Meghalaya Dists)  (Highways, Bridges, River Basins)
       │                              │                              │
       └──────────────────────────────┼──────────────────────────────┘
                                      │
                                      ▼
                       Internal Geocoding Provider
                  (server/services/geocoding/providers/upstreamGeocoderProvider.js)
                                      │
                                      ▼
                   Confidence Scoring & Deduplication
                                      │
                                      ▼
                  PostGIS Point-in-Polygon Grid Mapper
                     (grid_500m.assam / meghalaya)
                                      │
                                      ▼
                   Normalized RESQ Geo-Candidate Payload
```

---

## 3. Public API Contract

The frontend and external API consumers interact strictly through two standardized endpoints:

### 3.1 Forward Geocoding: `GET /api/geocode`

Resolves place names, administrative boundaries, critical infrastructure, river systems, national locations, and direct 500m grid IDs.

#### Request
```http
GET /api/geocode?q=Guwahati HTTP/1.1
Host: api.resq.local
Accept: application/json
```

#### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `q` | `string` | **Yes** | Search term (place name, district, highway, bridge, river, or grid ID e.g., `AS_00210744`). |
| `limit` | `integer` | No | Maximum number of candidates to return (Default: `8`). |

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "query": "Guwahati",
  "count": 2,
  "candidates": [
    {
      "name": "Guwahati",
      "category": "TOWN_LOCALITY",
      "district": "Kamrup Metropolitan",
      "state": "Assam",
      "lat": 26.1445,
      "lon": 91.7362,
      "score": 0.98
    }
  ]
}
```

---

### 3.2 Reverse Geocoding: `GET /api/geocode/reverse`

Maps geographic coordinates (GPS or map click) to the nearest named locality and the exact containing 500m PostGIS grid cell.

#### Request
```http
GET /api/geocode/reverse?lat=26.1445&lon=91.7362 HTTP/1.1
Host: api.resq.local
Accept: application/json
```

#### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `lat` | `float` | **Yes** | WGS84 Latitude ($-90.0$ to $+90.0$). |
| `lon` | `float` | **Yes** | WGS84 Longitude ($-180.0$ to $+180.0$). |

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "data": {
    "name": "Guwahati",
    "locality": "Guwahati",
    "district": "Kamrup Metropolitan",
    "state": "Assam",
    "gridId": "AS_00210744",
    "distanceToLocalityKm": 0.0,
    "lat": 26.1445,
    "lon": 91.7362
  }
}
```

---

## 4. Multi-Tier Resolution Pipeline

To guarantee sub-10ms response times and 100% operational availability during network disruptions, queries are evaluated across prioritized tiers:

1. **Direct Grid Identifier (`/^(AS|ML)_\d{8}$/i`)**:
   - Queries `grid_500m.assam` or `grid_500m.meghalaya` directly by primary key.
   - Assigned maximum confidence score (`1.0`).
2. **Regional Locality Gazetteer**:
   - High-precision gazetteer indexing all major cities, towns, and revenue circles across Assam and Meghalaya.
   - Exact matches scored at `0.98`, prefix matches at `0.92`, substring matches at `0.86`.
3. **District Centroid Registry**:
   - Covers all 35 Assam districts and 12 Meghalaya districts (scored at `0.95` / `0.85`).
4. **Strategic Transport & Hydro Infrastructure**:
   - Critical arterial highways (NH-27, NH-6, NH-37, NH-17, NH-217).
   - Major river bridges (Saraighat, Kolia Bhomora, Bogibeel, Naranarayan Setu, Dhola-Sadiya).
   - Major river drainage systems (Brahmaputra, Barak, Kopili, Manas, Subansiri, Umngot).
5. **Internal Geocoding Provider**:
   - Connects to an upstream provider adapter protected by configurable timeouts (default `4000ms`) and error boundary isolation.
   - Normalized results are merged and ranked alongside local intelligence assets.

---

## 5. Candidate Ranking & Spatial Deduplication

1. **Relevance Scoring**: Candidates are scored between `0.0` and `1.0` based on exact match, prefix match, entity tier, and provider confidence.
2. **Spatial Proximity Deduplication**: Candidates within 500m of each other with identical names are collapsed into a single authoritative entry.
3. **Cross-Border Disambiguation**: Ensures queries near state borders accurately resolve to their correct administrative district and state grid.

---

## 6. In-Memory LRU Caching

- **Forward Search Cache**: Caches normalized query keys (`query.trim().toLowerCase()`) with a 10-minute TTL and 500-entry capacity.
- **Reverse Geocode Cache**: Caches rounded coordinate keys (`${lat.toFixed(4)}_${lon.toFixed(4)}`) with a 10-minute TTL.
- **Performance**: Cached queries resolve in $< 1\text{ ms}$.

---

## 7. Fault Tolerance & Fallback Strategy

If the upstream provider is unreachable, times out, or returns a non-200 status:
- The error is isolated entirely within the provider adapter.
- The request falls back transparently to RESQ's local gazetteers and PostGIS grid resolvers.
- The end-user experiences zero interruption in search functionality.
