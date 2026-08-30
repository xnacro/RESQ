<h1 align="center">RESQ</h1>

<p align="center">
  <strong>Damage-aware relief supply chain routing for Assam and Meghalaya</strong>
</p>

<p align="center">
  Conventional navigation optimises for distance and time. During a disaster those are the wrong
  objectives. RESQ adds a third dimension: live hazard.
</p>

<p align="center">
  <code>PostGIS</code> · <code>Node.js</code> · <code>Valhalla</code> · <code>MapLibre GL</code> ·
  <code>React</code> · <code>Socket.IO</code>
</p>

---

## Overview

A GPS that does not know a bridge is gone will keep routing a convoy toward it. That is the failure
mode RESQ exists to fix.

RESQ maintains a continuously updated risk surface across **408,986 cells at 500m resolution**
(Assam 317,842, Meghalaya 91,144), fuses that surface onto the road network, and routes relief convoys
on cost that accounts for hazard as well as travel time. When conditions change mid-journey it detects
the change on the remaining route corridor, alerts the operator, and reroutes from the vehicle's current
position.

```
disaster evidence → risk surface → road edge cost → route selection → live monitoring → reroute
```

**Problem Statement #3**, IIT Guwahati Hackathon: relief convoys carrying infant nutrition, insulin,
blood bags and potable water become stranded on damaged or submerged roads after an earthquake triggers
debris flows and river overflow.

---

## Table of contents

- [Quick start](#quick-start)
- [Repository structure](#repository-structure)
- [The problem, decomposed](#the-problem-decomposed)
- [Architecture](#architecture)
- [Data sources](#data-sources)
- [Tier 1 — raw domain tables](#tier-1--raw-domain-tables)
- [Tier 2 — the 500m grid SSOT](#tier-2--the-500m-grid-ssot)
- [Dynamic intelligence pipeline](#dynamic-intelligence-pipeline)
- [Tier 3 — routing](#tier-3--routing)
- [Live monitoring and rerouting](#live-monitoring-and-rerouting)
- [Geocoding](#geocoding)
- [Worked scenario](#worked-scenario)
- [API reference](#api-reference)
- [Client](#client)
- [Operations](#operations)
- [Documented constraints](#documented-constraints)
- [Documentation index](#documentation-index)

---

## Quick start

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| PostgreSQL | 14+ with **PostGIS 3+** |
| Docker | For the Valhalla routing engine |
| GDAL | For raster ingestion (`gdalwarp`, `gdaldem`) |
| osmium-tool | For OSM extract filtering |

### 1. Clone and install

```bash
git clone https://github.com/xnacro/RESQ.git
cd RESQ

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

```ini
PORT=5000
DATABASE_URL=postgresql://username:password@host:5432/resq
VALHALLA_URL=http://127.0.0.1:8002
```

### 3. Build the grid

```bash
cd server
npm run generate:grid                          # 500m grid from map/state.json boundaries
node scripts/validateGrid.js                   # verify cell counts and geometry
```

### 4. Ingest data and compute risk

```bash
node scripts/registerAllStaticDatasets.js      # seed datasets.registry provenance
node scripts/runFloodPipeline.js               # NDEM/NRSC inundation → flood_susceptibility
node scripts/runStaticFactorsPipeline.js       # terrain, hydrology, exposure factors
node scripts/runCompositeRisk.js               # static_risk composite
node scripts/validateAllStaticGrids.js         # known-truth assertions
```

### 5. Start the routing engine

```bash
# One regional extract, not stitched state files
wget https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf \
  -P data/valhalla/osm/

docker compose up -d valhalla                  # builds tiles, binds 127.0.0.1:8002
curl http://127.0.0.1:8002/status
```

### 6. Run

```bash
cd server && npm run dev                       # http://localhost:5000
cd client && npm run dev                       # http://localhost:5173
```

### 7. Start live intelligence

```bash
node scripts/runNewsPipeline.js                # RSS → NLP → grid attribution
```

---

## Repository structure

```
RESQ/
├── client/                  Vite + React 19 + MapLibre GL frontend
│   └── src/
│       ├── app/             Shell, top bar, routing
│       ├── map/             MapSurface, viewport, cartography, layers
│       ├── panels/          Intelligence panel, bottom sheet, RESQ mode
│       ├── services/        API clients
│       ├── ui/              Primitive component set
│       └── styles/          Design tokens
├── server/                  Express 5 API (ESM)
│   ├── config/              Database pool
│   ├── controllers/         Request handlers
│   ├── routes/              /api/grid, /api/risk, /api/news, /api/geocode, /api/route
│   ├── scripts/             Pipeline runners and validators
│   └── services/
│       ├── datasets/        Registry, flood, static factors
│       ├── geocoding/       RESQ geocoder + provider adapters
│       ├── news/            RSS, NLP, clustering, scheduling
│       ├── risk/            Composite and dynamic risk engines
│       └── routing/         Valhalla adapter, route risk, monitoring
├── nlp/                     Location extraction, gazetteers
├── routing/                 Routing configuration
├── ml/                      Model workspace
├── map/                     Boundary GeoJSON
└── docs/                    Architecture and audit documentation
```

---

## The problem, decomposed

Every clause of PS#3 maps to a system capability:

| Problem clause | RESQ capability | Data behind it |
|---|---|---|
| "following an earthquake" | Seismic baseline + live shake ingestion | BIS IS 1893, USGS feeds, Vs30 |
| "triggers hillside debris flows" | Landslide susceptibility surface | GSI NLSM, DEM-derived slope |
| "overflowing river tributaries" | Full drainage proximity, trunk and tributary | HydroRIVERS, OSM waterways |
| "arterial highways and rural feeder roads" | Complete routable graph | OSM North-Eastern Zone |
| "bridges suffer structural damage" | Bridge inventory + closure overrides | OSM bridges, derived crossings |
| "key intersections submerged" | Flood inundation history + live SAR | NDEM/NRSC, Sentinel-1 |
| "insulin, blood bags" | Cold-chain, time-critical vehicle profiles | healthsites.io, OSM |
| "potable water" | Weight-constrained routing | OSM maxweight, bridge capacity |
| "routing them onto damaged roads" | Per-edge hazard cost, hard closure vetoes | Grid-to-edge sampling |
| "isolated relief shelters" | Destination inventory | ASDMA, OSM, GHS-POP |

---

## Architecture

Four tiers. Data flows upward; decisions flow downward.

```mermaid
flowchart TD
    subgraph T0["TIER 0 — EXTERNAL SOURCES"]
        S1["Satellite & Raster<br/>FABDEM, JRC GSW, GHS-POP"]
        S2["Vector & Survey<br/>OSM, HydroRIVERS, GSI NLSM"]
        S3["Live Feeds<br/>RSS, USGS, GPM, Sentinel-1"]
    end
    subgraph T1["TIER 1 — RAW DOMAIN TABLES"]
        F["disaster.flood_events"]
        L["disaster.landslide_events"]
        R["infrastructure.roads"]
        B["infrastructure.bridges"]
        W["environment.waterbodies"]
        N["news.rss_items / disaster.news_events"]
        REG["datasets.registry"]
    end
    subgraph T2["TIER 2 — 500m GRID SSOT"]
        GRID["grid_500m.assam + meghalaya<br/>408,986 cells<br/>static_risk · dynamic_risk · risk_score"]
    end
    subgraph T3["TIER 3 — ROUTING GRAPH"]
        VAL["Valhalla tiles<br/>North-Eastern Zone"]
        EDGE["Edge risk index<br/>road ↔ grid join"]
        EVAL["Route risk evaluator"]
    end
    subgraph T4["TIER 4 — DELIVERY"]
        API["REST + Socket.IO"]
        UI["MapLibre client"]
    end
    S1 --> T1
    S2 --> T1
    S3 --> N
    T1 --> GRID
    R --> VAL
    B --> VAL
    GRID --> EDGE
    VAL --> EVAL
    EDGE --> EVAL
    EVAL --> API --> UI
    GRID -.->|risk:grid-updated| API
```

### Why both a grid and a graph

A 500m cell answers *how dangerous is this area*. A router needs *what does this segment cost to
traverse*. Those are different questions.

A cell can read MODERATE while the single bridge crossing it is destroyed. A road on a raised embankment
stays passable through a cell that is 80% inundated. Valhalla costs **edges** keyed by OSM way ID and
has no concept of a grid cell.

RESQ therefore keeps the grid as the hazard surface and maintains a **road-to-grid edge index**:

```sql
SELECT r.osm_way_id,
       MAX(g.risk_score)                    AS worst_cell_risk,
       AVG(g.risk_score)                    AS mean_cell_risk,
       BOOL_OR(g.risk_status = 'CRITICAL')  AS touches_critical,
       BOOL_OR(g.road_closure_risk >= 80)   AS touches_closure
FROM infrastructure.roads r
JOIN grid_500m.assam g ON ST_Intersects(r.geom, g.geom)
GROUP BY r.osm_way_id;
```

`MAX` governs the safety veto, `AVG` governs preference. Averaging away a single critical cell is the
wrong failure direction when the cargo is blood bags.

---

## Data sources

### Static

| # | Source | Provider | Feeds | Format | Resolution | Licence |
|---|---|---|---|---|---|---|
| 1 | **FABDEM V1-2** | University of Bristol | `elevation_mean/min/max` | GeoTIFF | 30m | CC BY-NC-SA 4.0 |
| 2 | **Copernicus DEM GLO-30** | ESA, via AWS Open Data | Elevation, commercial-safe fallback | COG | 30m | Copernicus free |
| 3 | *Derived terrain* | RESQ GDAL pipeline | `slope_mean`, aspect, curvature, HAND, TWI | GeoTIFF | 30m | Derived |
| 4 | **NDEM / NRSC flood inundation** | NRSC, mirrored by `ramSeraph/india_natural_disasters` | `flood_susceptibility` | GeoJSONL | 30-50m SAR | CC0 |
| 5 | **GSI NLSM** | Geological Survey of India, Bhukosh / Bhusanket WFS | `landslide_susceptibility` | WFS GeoJSON | 1:50,000 | Government |
| 6 | **BIS IS 1893:2016** | Bureau of Indian Standards / NDMA | Seismic zone baseline | Standard polygons | State scale | Published standard |
| 7 | **USGS Vs30** | USGS | Seismic site amplification | GeoTIFF | 30 arc-sec | Public domain |
| 8 | **HydroRIVERS v1.0** | WWF HydroSHEDS | `distance_to_river`, stream order, discharge | Shapefile | 15 arc-sec | Free, attribution |
| 9 | **RiverATLAS** | WWF HydroSHEDS | 281 hydro-environmental attributes | GeoPackage | Reach level | Free, attribution |
| 10 | **JRC Global Surface Water** | EC Joint Research Centre | `waterbody_percentage`, permanent-water mask | GeoTIFF | 30m | Free, attribution |
| 11 | **ISRO SAC Wetland Atlas** | Space Applications Centre | Wetland typology, beels | Shapefile | 1:50,000 | Government |
| 12 | **GHS-POP R2023A** | EC Copernicus GHSL | `population_density` | GeoTIFF | 100m | Free, attribution |
| 13 | **Census of India 2011** | Registrar General of India | Population validation | Tabular | Village | Government |
| 14 | **OSM North-Eastern Zone** | Geofabrik | Roads, bridges, waterways, POIs, routing graph | `.osm.pbf`, 104 MB | Vector | **ODbL** |
| 15 | **healthsites.io** | Global Healthsites Mapping Project | Hospitals, blood banks, cold chain | GeoJSON | Point | ODbL |
| 16 | **HOTOSM exports** | Humanitarian OpenStreetMap Team, HDX | Critical facilities | Shapefile | Point | ODbL |
| 17 | **ASDMA relief camps** | Assam State Disaster Management Authority | Shelters, capacity | Parsed reports | Point | Government |
| 18 | **India Flood Inventory** | HydroSense Lab IIT Delhi + IMD, Zenodo | Historical event catalogue | GeoPackage | Event | Open |
| 19 | **DesInventar / EM-DAT** | UNDRR / CRED | Disaster frequency baseline | Tabular | District | Open |

### Dynamic

| # | Source | Feeds grid column | Cadence | Format |
|---|---|---|---|---|
| 1 | **12 regional RSS feeds** (Sentinel Assam, Shillong Times, NE Now, Google News district queries, PIB, ASDMA) | `news_risk`, `nlp_event_risk`, `road_closure_risk` | Cron polling | RSS/XML → NLP |
| 2 | **USGS earthquake GeoJSON feed** | `earthquake_event_risk` | Near real-time | GeoJSON |
| 3 | **USGS ShakeMap** | `earthquake_event_risk` intensity refinement | Per event | Grid product |
| 4 | **IMD gridded rainfall / NASA GPM IMERG** | `rainfall_risk` | 30 min | NetCDF / GeoTIFF |
| 5 | **Sentinel-1 SAR** via Earth Engine | `flood_event_risk` | Per pass, ~6 days | Raster |
| 6 | **GSI rainfall-triggered landslide warnings** | `landslide_event_risk` | Advisory | Bulletin |
| 7 | **Citizen incident reports** | `citizen_report_risk` | On submission | RESQ API |

### Provenance

`datasets.registry` records for every dataset: `dataset_name`, `factor`, `source_name`, `provider`,
`official_url`, `implementation_url`, `source_type`, `format`, `resolution`, `temporal_coverage`,
`geographic_coverage`, `version`, `source_hash` (SHA-256 of the ingested artifact),
`processing_status`, `total_records`, `processed_at`.

Every number in the grid traces back to a specific artifact hash. Derived and inferred fields are
flagged so the UI never presents modelled values as survey data.

---

## Tier 1 — raw domain tables

| Table | Contents | Geometry | Source |
|---|---|---|---|
| `disaster.flood_events` | Multi-year satellite inundation polygons | `GEOMETRY(4326)`, GiST | NDEM / NRSC |
| `disaster.landslide_events` | NLSM susceptibility zones + incident records | `GEOMETRY(4326)`, GiST | GSI |
| `infrastructure.roads` | Road centrelines with class, surface, restrictions | `LINESTRING(4326)`, GiST | OSM + PMGSY |
| `infrastructure.bridges` | Crossings, structure, load capacity where known | `GEOMETRY(4326)`, GiST | OSM + derived |
| `environment.waterbodies` | Perennial water, wetlands, beels | `GEOMETRY(4326)`, GiST | JRC GSW + SAC |
| `news.rss_sources` | Feed registry with reliability tier | — | Curated |
| `news.rss_items` | SHA-256 deduplicated articles | — | RSS ingestion |
| `disaster.news_events` | Extracted geolocated events | `POINT(4326)`, GiST | NLP pipeline |
| `disaster.event_clusters` | Spatio-temporal corroboration, 15km / 72h | `POINT(4326)`, GiST | Clustering |
| `disaster.event_grid_links` | Event-to-cell links with distance decay | — | Spatial attribution |
| `datasets.registry` | Provenance for every dataset | — | Pipeline |

### Road attribution for convoy routing

`infrastructure.roads` carries the tags that determine passability, not just prestige:

| Tag | Routing meaning |
|---|---|
| `highway` | Class hierarchy and default speed |
| `surface` | Unpaved becomes impassable long before a paved trunk road |
| `tracktype` | `grade4`/`grade5` unusable for a loaded truck in monsoon |
| `embankment` | Raised roads survive inundation that drowns surrounding land |
| `maxweight` | Gross vehicle limit. Unknown is treated as risk, never as permission |
| `maxheight`, `width` | Convoy clearance |
| `ford` | Seasonal crossing, dry-season-only edge |
| `bridge`, `tunnel`, `layer` | Vertical relationships, so flooding does not close a flyover |

### Bridge inference

OSM bridge coverage in the region is real but uneven; major crossings are mapped, rural culverts often
are not. RESQ closes the gap by intersecting the road network with the drainage network. Every
road-over-river crossing becomes a structure record flagged `is_inferred`, so the router treats it as a
chokepoint even when its condition is unknown.

---

## Tier 2 — the 500m grid SSOT

### Schema

| Group | Columns |
|---|---|
| **Identity** | `id`, `grid_id`, `state`, `district`, `block`, `center_lat`, `center_lon`, `geom` |
| **Terrain** | `elevation_mean`, `elevation_min`, `elevation_max`, `slope_mean` |
| **Hydrology** | `distance_to_river`, `waterbody_percentage`, `flood_susceptibility` |
| **Geohazard** | `landslide_susceptibility`, `seismic_risk` |
| **Exposure** | `population_density`, `infrastructure_exposure` |
| **Static composite** | `static_risk` |
| **Dynamic channels** | `rainfall_risk`, `flood_event_risk`, `earthquake_event_risk`, `landslide_event_risk`, `news_risk`, `nlp_event_risk`, `citizen_report_risk`, `road_closure_risk` |
| **Dynamic composite** | `dynamic_risk`, `last_dynamic_update` |
| **Decision** | `risk_score`, `risk_confidence`, `risk_status` |

Grid geometry is `POLYGON` in EPSG:4326 with GiST indexes. All metric computation projects to
**EPSG:32646** (UTM 46N). Radius queries use `geography` casts for true geodesic metres rather than a
flat degree divisor, which matters because at 26°N one degree of longitude is 100.1 km, not 111.32 km.

### Factor derivation

| Factor | Derivation |
|---|---|
| `elevation_*` | Zonal mean/min/max of FABDEM, reprojected to UTM 46N |
| `slope_mean` | Mean of 30m Horn-algorithm slopes per cell, computed on the projected raster |
| `flood_susceptibility` | Distinct flood years per cell from `ST_Intersects` against NDEM polygons |
| `landslide_susceptibility` | `MAX` of intersecting GSI NLSM tier, so one very-high sliver is not averaged away |
| `seismic_risk` | BIS Zone V baseline modulated by Vs30 site amplification |
| `distance_to_river` | KNN lateral join to HydroRIVERS filtered by stream order, plus OSM local channels |
| `waterbody_percentage` | Zonal mean of JRC GSW occurrence band |
| `population_density` | GHS-POP persons summed per cell, divided by 0.25 km² |
| `infrastructure_exposure` | Class-weighted road length per cell, normalised against regional maximum |

### Static risk model

$$
\text{static\_risk} = \text{ROUND}\left(\min\left(100, \max\left(0, \sum_{i=1}^{7} w_i F_i\right)\right), 1\right)
$$

| Factor | Weight | Max contribution |
|---|---|---|
| `flood_susceptibility` | 0.25 | +25.0 |
| `landslide_susceptibility` | 0.20 | +20.0 |
| `seismic_risk` × 0.4 | 0.15 | +6.0 |
| `RiverRisk(distance_to_river)` | 0.10 | +9.0 |
| `waterbody_percentage` | 0.10 | +10.0 |
| Population, normalised | 0.10 | +10.0 |
| `infrastructure_exposure` | 0.10 | +10.0 |

**River proximity** is a four-tier inverted step: `<500m → 90`, `<2km → 55`, `<5km → 25`, `≥5km → 5`.

**Population normalisation** divides by 50.0 rather than 25.0, so the scale saturates near 5,000
persons/km² instead of 2,500. This preserves discrimination inside dense Guwahati wards, which exceed
4,000/km² and would otherwise flatten into a uniform plateau exactly where the product needs detail.

**Flood binning** is harmonised across both states on distinct flood years, so scores are comparable
across the border: `≥8 → 95`, `5-7 → 75`, `3-4 → 55`, `2 → 35`, `1 → 20`, `0 → 0`. Cells with
`waterbody_percentage ≥ 80` are masked so perennial river channels are not scored as flood hazard.

**Elevation and slope are deliberately excluded** from the additive sum. High ground is not inherently
safe in this region, and GSI NLSM already uses slope angle as its primary parameter, so adding slope
separately would double-count terrain steepness. Both remain in the schema for routing gradability
checks and flood-depth context.

### Dynamic risk

Each channel is populated by its own ingestion pipeline. Aggregation takes the maximum rather than a
sum, because hazards do not additively compound into certainty:

$$
\text{dynamic\_risk} = \min\left(100, \max(F_{\text{closure}}, F_{\text{news}}, F_{\text{nlp}}, F_{\text{rain}}, F_{\text{flood}}, F_{\text{quake}}, F_{\text{slide}}, F_{\text{citizen}})\right)
$$

**Safety escalation**: if `road_closure_risk ≥ 80` then `dynamic_risk = max(dynamic_risk, 90)`.

**Event impact** decays with distance from the event centroid:

$$
I(d) = S \times C \times \max\left(0.2,\ 1 - \frac{d}{R_b}\right)
$$

where $S$ is severity, $C$ is confidence, $d$ is distance and $R_b$ is the buffer radius.

### Fusion

$$
\text{risk\_score} = \begin{cases}
\text{static\_risk} & \text{if } \text{dynamic\_risk} = 0 \\
0.40 \times \text{static\_risk} + 0.60 \times \text{dynamic\_risk} & \text{otherwise}
\end{cases}
$$

$$
\text{risk\_status} = \begin{cases}
\text{CRITICAL} & \text{if } \text{risk\_score} \ge 70 \ \lor\ \text{road\_closure\_risk} \ge 80 \\
\text{HIGH} & \text{if } \text{risk\_score} \ge 45 \\
\text{MODERATE} & \text{if } \text{risk\_score} \ge 25 \\
\text{LOW} & \text{otherwise}
\end{cases}
$$

Live evidence dominates the baseline 60/40, because a bridge that is gone today matters more than a
century of favourable terrain statistics.

---

## Dynamic intelligence pipeline

### News and NLP

```
RSS feeds → SHA-256 dedup → relevance filter → hazard lexicon → NER geolocation
    → severity + confidence scoring → disaster.news_events → spatio-temporal clustering
    → ST_DWithin grid attribution with distance decay → dynamic channels → fusion
```

**Source reliability** adjusts extraction confidence:

$$
C = \text{clamp}\left(C_{\text{extract}} + \Delta_{\text{tier}} + \Delta_{\text{corroboration}},\ 0.10,\ 0.98\right)
$$

- Tier 1, official bulletins (ASDMA, NDMA, PIB): $\Delta = +0.15$, floor $C \ge 0.90$
- Tier 2, established regional media: $\Delta = 0$
- Tier 3, aggregators and social: $\Delta = -0.10$

Two independent reports within 15 km and 72 hours form a cluster and boost confidence. Severity,
extraction confidence and source reliability stay separate throughout, so a lurid headline from a weak
source cannot masquerade as a verified emergency.

### Temporal lifecycle

Every event carries `reported_at`, `valid_until` and `event_status`. Meteorological events default to
48-hour validity, structural bridge failures to 120 hours. A scheduled decay worker rebuilds each
affected cell's factors **strictly from currently active events**, so risk recedes as evidence expires:

```
Event A (news 50) + Event B (news 80) both active  →  news_risk = 80
Event B expires                                    →  news_risk decays to 50
Event A expires                                    →  news_risk = 0, risk_score = static_risk
```

Structural events of type `BRIDGE_CLOSURE`, `BRIDGE_WASHOUT`, `BRIDGE_COLLAPSE` and `ROAD_COLLAPSE` are
protected from premature automatic expiry, because a collapsed bridge does not repair itself in 48 hours.

### Other channels

| Channel | Method |
|---|---|
| Earthquake | USGS GeoJSON feed polled continuously; magnitude, depth and epicentre converted to a shaking footprint via ShakeMap intensity where available, modulated by Vs30 |
| Rainfall | Gridded accumulation over 24h and 72h windows, thresholded against antecedent moisture |
| Live flood | Sentinel-1 SAR water classification differenced against the JRC permanent-water mask |
| Citizen reports | Submitted with GPS and photo, spatially clustered, requiring corroboration before elevating risk |

---

## Tier 3 — routing

### Valhalla foundation

The routing graph is built from the Geofabrik **North-Eastern Zone** extract, a single 104 MB regional
`.osm.pbf` covering Assam and Meghalaya together. A single regional extract is used rather than
stitching separate state files, which Valhalla handles poorly. Tiles are built into a persistent volume
and the service is bound to `127.0.0.1:8002`, reachable only by the RESQ backend. Neither the extract
nor the generated tiles are committed to version control.

Valhalla answers exactly one question: **which roads physically connect these two points**. It does not
carry the RESQ risk model. That separation keeps the routing engine replaceable and the risk logic
testable.

### The routing decision

```mermaid
flowchart TD
    REQ["POST /api/route<br/>origin · destination · vehicle · mode"] --> VAL["Valhalla<br/>3-5 candidate routes"]
    VAL --> DEC["Polyline6 decode → GeoJSON"]
    DEC --> SAMP["ST_Intersects against 500m grid<br/>+ edge risk index"]
    SAMP --> PROF["Route risk profile per candidate"]
    PROF --> VETO{"Hard veto?"}
    VETO -->|"blocked"| REJ["Reject candidate"]
    VETO -->|"passable"| RANK["Multi-objective ranking"]
    RANK --> SEL["Selected route + alternatives + explanation"]
    SEL --> MON["Register with route monitor"]
```

### Route risk profile

Each candidate is evaluated across every cell it traverses:

```json
{
  "distanceKm": 44.2,
  "durationMinutes": 56,
  "meanRisk": 24.3,
  "maxRisk": 61.0,
  "highGridCount": 4,
  "criticalGridCount": 0,
  "blockedSegmentCount": 0,
  "affectedBridgeCount": 0,
  "activeHazardCount": 2,
  "routeStatus": "SAFE",
  "routeConfidence": 0.94
}
```

**Mean risk alone is never sufficient.** A route that is 95% low-risk road plus one collapsed bridge is
not a low-risk route, it is impassable. Route status therefore derives from hard conditions first and
aggregate risk second.

### Cost model and vetoes

$$
\text{RoutingCost}(e) = \text{Length}(e) \times \left(1 + \alpha \frac{\text{static\_risk}}{100} + \beta \frac{\text{dynamic\_risk}}{100}\right)
$$

On top of continuous cost sits a veto layer, because some conditions are not expensive but impossible:

| Condition | Action |
|---|---|
| Bridge washout or collapse, confidence ≥ 0.70 | Edge removed from the graph |
| `maxweight` below convoy gross weight | Edge removed for that vehicle class |
| Flood depth exceeds vehicle fording depth | Edge removed for that vehicle class |
| `road_closure_risk ≥ 80` | Cost × 10, retained as last resort |
| Cell `risk_status = CRITICAL` | Cost × 5 |

The distinction matters. A penalty means the router will still choose the road if the detour is long
enough, which for a washed-out bridge is exactly wrong.

### Routing modes

| Mode | Objective |
|---|---|
| `fastest` | Minimum travel time, still rejecting physically blocked routes |
| `safe` | Minimum operational risk, subject to a reasonable time ceiling |
| `balanced` | Multi-objective compromise |

Safe mode does not simply minimise risk at any cost. A route three hours longer to shave negligible risk
is not operationally useful, so selection uses a weighted score over normalised risk and normalised
duration.

### Vehicle profiles

| Profile | Binding constraints | Data used |
|---|---|---|
| `ambulance` | Time-critical, moderate weight, needs hospitals | healthsites.io, road class |
| `relief_truck` | 12 t typical, weight and width limits | `maxweight`, `width`, bridge capacity |
| `water_tanker` | 25-40 t, heaviest, most bridge-constrained | `maxweight`, inferred capacity class |
| `4x4` | Can ford shallow water, handles unpaved | `surface`, `tracktype`, `ford` |
| `car` | Baseline reference | Standard costing |

Where `maxweight` is untagged, capacity is inferred from road class and the field is marked inferred. A
`highway=track` crossing is assumed to carry no more than a light vehicle. Unknown capacity is treated
as a constraint, never as permission.

### Cargo-aware selection

| Cargo | Constraint | Effect on routing |
|---|---|---|
| Insulin | Cold chain 2-8°C, time-critical | Hard ceiling on transit duration |
| Blood bags | Cold chain, shelf life in hours | Shortest *safe* time, not shortest distance |
| Infant nutrition | Destination-driven | Prioritise shelters with under-5 population |
| Potable water | Heavy bulk | Weight limits dominate; many rural crossings excluded |

---

## Live monitoring and rerouting

### The loop

```
grid risk changes → Socket.IO risk:grid-updated → route monitor checks active corridors
    → is the cell on a remaining route? → recompute that route's profile
    → threshold evaluation → alert operator → request new candidates from current position
    → evaluate → switch route → route:risk-updated
```

Monitoring covers the **remaining route corridor only**. A hazard behind the vehicle does not trigger a
reroute. Corridor membership is precomputed as a set of `grid_id` values when the route is selected, so
a risk update is an O(1) set membership test rather than a scan of 408,986 cells.

### Reroute triggers

1. A segment becomes BLOCKED
2. A bridge becomes CLOSED
3. A road closure event activates
4. Dynamic risk crosses the critical threshold
5. A severe new event intersects the remaining corridor
6. An alternative becomes materially better

### Oscillation protection

Without damping, a route flips between two options every time a score wobbles. RESQ applies:

- **Minimum improvement threshold** — a new route must be meaningfully safer, not marginally
- **Hysteresis** — the switching threshold is higher than the reverting threshold
- **Minimum reroute interval** — a floor on how often a route may change
- **Route stickiness** — the current route holds unless displaced
- **Blocked override** — all damping is bypassed when the current route becomes impassable

So `42 → 44` does not reroute. `42 → 78` triggers evaluation. A bridge closure ahead reroutes immediately.

### Route statuses

`SAFE` · `CAUTION` · `HIGH_RISK` · `BLOCKED` · `REROUTING`

When every candidate is blocked, the system returns `NO_SAFE_ROUTE` and escalates to the operator rather
than silently returning the least-bad option.

### Explanation

Every selection is explainable, and cites actual event evidence:

```
SAFE ROUTE
52 min · 38.2 km · Risk 24/100

Avoided
  High-risk flood corridor near Boko
  Bridge closure on NH-27

Alternative
  Fastest route was 7 min quicker but crossed a critical-risk bridge
```

---

## Geocoding

RESQ exposes its own geocoding service. The frontend knows two endpoints and nothing else:

```
GET /api/geocode?q=<query>
GET /api/geocode/reverse?lat=<lat>&lon=<lon>
```

**Forward resolution** runs a priority pipeline:

1. Grid ID pattern match, `^(AS|ML)_\d{8}$`, resolved directly against PostGIS
2. Local locality gazetteer for Assam and Meghalaya
3. District centroids, all Assam and Meghalaya districts
4. Strategic corridors and bridges — NH-27, NH-6, NH-37, Saraighat, Bogibeel, Kolia Bhomora
5. Regional river systems — Brahmaputra, Barak, Kopili, Manas, Subansiri, Umngot
6. Upstream geocoding provider for anything local sources cannot resolve

Candidates from all sources merge into a single ranking over exact match, prefix match, token match,
place type, geographic relevance and confidence. Results are cached on normalised query keys.

**Reverse resolution** runs gazetteer proximity, then PostGIS point-in-polygon against the grid, which
returns the authoritative `grid_id`. Grid identity always comes from RESQ's own database, never from an
upstream provider.

The upstream provider sits behind a server-side adapter with a bounded timeout. If it is unavailable the
service degrades to local sources rather than failing. Provider details, credentials and request formats
exist only server-side; responses are normalised into the RESQ schema before they reach the client.

---

## Worked scenario

**Convoy**: relief truck, 12 t, carrying insulin and blood bags
**Origin**: Guwahati relief hub → **Destination**: shelter in Morigaon district

**T+0 · Request.** Valhalla returns four candidates. RESQ evaluates each against the grid.

| Candidate | Distance | Duration | Mean risk | Max risk | Status |
|---|---|---|---|---|---|
| Fastest, via NH-27 | 74 km | 96 min | 58.4 | 81.0 | HIGH_RISK |
| Alternative A | 82 km | 108 min | 41.2 | 63.0 | CAUTION |
| **RESQ recommended** | **89 km** | **112 min** | **27.3** | **38.0** | **SAFE** |
| Alternative C | 104 km | 141 min | 24.1 | 33.0 | SAFE but slow |

RESQ selects the 89 km route. Alternative C is marginally safer but 29 minutes slower for a 3-point risk
improvement, which the multi-objective score rejects. The fastest route crosses a cell at 81 risk driven
by flood susceptibility 75 plus active rainfall.

**T+34 min · Evidence arrives.** An article from The Sentinel Assam reports a bridge closure after
structural damage. The NLP pipeline extracts `hazard=FLOOD`, `event=BRIDGE_CLOSURE`, severity 85. A
second report from a district feed corroborates within the 15 km / 72 h window, lifting confidence to
0.95. The event geolocates and links to 25 cells with distance decay.

**T+34 min · Fusion.** On cell `AS_00239973`: `news_risk 0 → 80.8`, `road_closure_risk 0 → 90`. The
safety escalation applies, `dynamic_risk = 90`. Fusion gives
`risk_score = 0.40 × 12.6 + 0.60 × 90 = 59.0`, and `risk_status` becomes CRITICAL because closure
exceeds 80.

**T+34 min · Detection.** `risk:grid-updated` fires. The monitor finds `AS_00239973` in the active
route's remaining corridor, 14 km ahead. Blocked override bypasses all damping.

**T+34 min · Alert.**

```
⚠ ROUTE RISK CHANGED
Bridge closure detected 14 km ahead on your route.
Finding a safer route...
```

**T+35 min · Reroute.** New candidates are requested **from the vehicle's current position**, not the
original origin. The affected edge is removed from the graph. A replacement is selected at 71 km
remaining, 94 minutes, risk 29.1, SAFE.

```
SAFE ROUTE UPDATED
Rerouted · +8 min
Avoided: bridge closure near Boko (NH-27)
Source: 2 corroborated reports, confidence 0.95
```

Conventional GPS would have driven the convoy to a closed bridge, then required a manual 14 km reversal.

---

## API reference

| Endpoint | Purpose |
|---|---|
| `POST /api/route` | Route request with mode and vehicle, returns selection + alternatives + explanation |
| `POST /api/route/reroute` | Reroute from current position |
| `GET /api/route/:routeId` | Route state, remaining distance, upcoming hazards, alerts |
| `GET /api/risk/point?lat=&lon=` | Point risk lookup with grid resolution |
| `GET /api/risk/grid/:gridId` | Full risk decomposition with active events |
| `GET /api/risk/bbox` | Viewport grid query for map rendering |
| `GET /api/geocode` | Forward geocoding |
| `GET /api/geocode/reverse` | Reverse geocoding with grid resolution |
| `GET /api/news/events` | Active disaster events |
| `GET /api/grid` | Grid cell queries |
| `GET /api/datasets` | Provenance registry |

**Socket.IO**: `risk:grid-updated`, `route:risk-updated`, `route:rerouted`, `event:created`.

Risk decomposition is explainable per cell:

```
GUWAHATI URBAN CORE (AS_00202999) — 25.3/100 MODERATE
  +9.5  Infrastructure exposure (95/100, highway and bridge junction)
  +9.3  Population density (2,321/km², dense urban core)
  +6.0  Seismic baseline (BIS IS 1893 Zone V)
  +0.5  River proximity (>5 km from main channel)
  +0.0  Flood susceptibility (elevated urban embankment)
  +0.0  Landslide susceptibility (flat alluvial valley)
```

---

## Client

MapLibre GL JS renders vector tiles with a custom RESQ cartography system. The basemap is deliberately
quiet in cool blue-white and slate so that risk colour carries all the semantic weight.

**Two separate colour systems, never mixed.** Cartography tokens cover land, water, forest, buildings,
boundaries, road hierarchy and typography. Risk tokens cover LOW, MODERATE, HIGH and CRITICAL, and are
reserved exclusively for risk, events, route segments and legend.

The risk grid renders as GPU fill layers with data-driven opacity, transparent enough that roads and
labels stay readable underneath. Only the selected cell and CRITICAL cells carry visible outlines, so
the surface never reads as a chessboard.

Layout is map-dominant: a full-bleed map with a docked intelligence panel, collapsing to a bottom sheet
on mobile. Route comparison presents fastest, safe and balanced side by side with distance, duration and
risk, plus the reason the recommendation differs.

---

## Operations

### Refresh cadences

| Dataset | Refresh |
|---|---|
| DEM, terrain derivatives | Static, rebuild on DEM version change |
| Flood inundation history | Annual, on NDEM publication |
| Landslide susceptibility | On GSI NLSM revision |
| Population | On GHSL release |
| Road network and bridges | Monthly from Geofabrik, triggers tile rebuild |
| River network | On HydroSHEDS release |
| RSS and NLP | Continuous cron |
| Earthquake | Continuous poll |
| Rainfall | 30 minutes |
| Sentinel-1 flood | Per satellite pass |
| Event expiry and decay | Hourly |

### Licensing

| Source | Licence | Commercial |
|---|---|---|
| Copernicus GLO-30 | Copernicus free | Yes |
| FABDEM | CC BY-NC-SA 4.0 | **No** |
| NDEM mirror | CC0 + attribution | Yes |
| HydroRIVERS, JRC GSW, GHS-POP | Free + attribution | Yes |
| OpenStreetMap | **ODbL, share-alike** | With obligations |
| USGS | Public domain | Yes |

FABDEM is non-commercial, so a commercial deployment substitutes Copernicus GLO-30. ODbL share-alike
obligations apply to publicly distributed derived databases.

### Validation

Ingestion is gated on known-truth assertions:

```
elevation   Guwahati 50-55 m · Shillong 1,450-1,540 m
slope       floodplain 0-2° · Cherrapunji escarpment >35°
population  Guwahati core >3,000/km² · rural Garo Hills <200/km²
flood       Majuli high multi-year · Shillong plateau 0
bridges     Saraighat, Bogibeel, Kolia Bhomora present
routing     Guwahati→Shillong crosses the state boundary correctly
nulls       zero across all static columns, 408,986 cells
```

---

## Documented constraints

Two datasets are unavailable at any price. RESQ handles both explicitly rather than pretending otherwise.

**Bridge structural condition.** MoRTH's Indian Bridge Management System holds 172,000+ structures with
age, material, design and condition rating. It is an internal asset system, not open data, and covers
only National Highways. RESQ infers a capacity class from road class, span length at river crossings and
available OSM tags, and marks every such value `is_inferred` so the UI never implies survey data.

**Brahmaputra discharge.** CWC classifies hydrological data for basins crossing international borders,
which covers the Brahmaputra, Ganga and Indus. RESQ substitutes HydroRIVERS modelled long-term average
discharge as a static attribute and uses satellite-observed inundation extent as the dynamic signal in
place of gauge height.

A third limit is inherent: RESQ is **risk-aware emergency routing, not a safety certification**. It
reduces exposure using the best available evidence. It does not guarantee that a road is passable, and
the interface states this. Operator judgement remains authoritative.

---

## Documentation index

| Document | Contents |
|---|---|
| [`STATIC_DATA_SOURCES.md`](STATIC_DATA_SOURCES.md) | Per-source acquisition and ingestion recipes |
| [`STATIC_RISK_FORMULA_AUDIT.md`](STATIC_RISK_FORMULA_AUDIT.md) | Static formula verification and calibration |
| [`DYNAMIC_RISK_ENGINE.md`](DYNAMIC_RISK_ENGINE.md) | Reactive fusion and expiration specification |
| [`DYNAMIC_RISK_READINESS_AUDIT.md`](DYNAMIC_RISK_READINESS_AUDIT.md) | System readiness and gap analysis |
| [`NEWS_NLP_PIPELINE.md`](NEWS_NLP_PIPELINE.md) | RSS ingestion and event extraction |
| [`GEOCODING_ARCHITECTURE.md`](GEOCODING_ARCHITECTURE.md) | Geocoding service contract |
| [`FRONTEND_IMPLEMENTATION_PLAN.md`](FRONTEND_IMPLEMENTATION_PLAN.md) | Client architecture and roadmap |

---

<p align="center">
  <sub>RESQ · Assam &amp; Meghalaya · 408,986 cells at 500m resolution</sub>
</p>
