# RESQ — RSS News Ingestion + NLP Disaster Event Extraction Pipeline

## 1. Architectural Overview

The RESQ disaster intelligence system fuses static geospatial baselines with live multi-source situational awareness. While the **500m × 500m Grid Single Source of Truth (SSOT)** provides static susceptibility across terrain, hydrology, and zonation, the **News & NLP Ingestion Pipeline** extracts, verifies, and geolocates real-time incident intelligence across Assam and Meghalaya.

```
RAW RSS FEEDS (Sentinel, EastMojo, NE Now, Shillong Times, PIB)
                            │
                            ▼
           news.rss_items (Content-Hashed Deduplication)
                            │
                            ▼
          Fast Lexical Pre-Filter (Noise / Whitelist)
                            │
                            ▼
          Rule-Based NLP & Linguistic Entity Extraction
                            │
                            ▼
        Spatial Geocoding & Coordinate Resolution (PostGIS)
                            │
                            ▼
           disaster.news_events & Multi-Source Clusters
                            │
                            ▼
       PostGIS Spatial Buffer & Distance Decay Attribution
                            │
                            ▼
          disaster.event_grid_links (500m Grid Association)
                            │
                            ▼
      grid_500m.assam / grid_500m.meghalaya (dynamic_risk)
```

---

## 2. Core Philosophy & Probabilistic Safety Contract

RESQ enforces strict epistemic bounds when processing unverified media and news intelligence:

> **Operational Contract**:
> News never directly declares an asset "definitely destroyed". Instead, news intelligence generates a **probabilistic disaster event** with an explicit **confidence score** and **corroboration multiplier**. This updates the cell's `news_risk` and flags the corridor for field verification and safe routing penalties.

---

## 3. Controlled Vocabularies & Schemas

### 3.1 Controlled Vocabularies

#### Hazard Categories (`HAZARD_TYPES`)
- `FLOOD`
- `FLASH_FLOOD`
- `LANDSLIDE`
- `EARTHQUAKE`
- `EROSION`
- `STORM`
- `CYCLONE`
- `DAM_RELEASE`
- `OTHER_HAZARD`

#### Specific Event Types (`EVENT_TYPES`)
- `ROAD_BLOCKAGE`
- `ROAD_FLOODING`
- `ROAD_COLLAPSE`
- `BRIDGE_DAMAGE`
- `BRIDGE_CLOSURE`
- `BRIDGE_WASHOUT`
- `EMBANKMENT_BREACH`
- `EVACUATION`
- `DAM_FAILURE`
- `DEBRIS_BLOCKAGE`
- `SEVERE_RAINFALL`
- `RIVER_OVERFLOW`

#### Infrastructure Asset Types (`ASSET_TYPES`)
- `ROAD`
- `HIGHWAY`
- `BRIDGE`
- `CULVERT`
- `EMBANKMENT`
- `DAM`
- `RELIEF_CAMP`
- `SETTLEMENT`
- `RIVER_BANK`

---

## 4. PostGIS Database Schemas

### 4.1 `news.rss_sources`
Tracks RSS endpoints, polling frequencies, regions, and reliability tiers:
- `reliability_tier = 1`: Official Government Bulletins (ASDMA, NDMA, PIB)
- `reliability_tier = 2`: Established Regional News Media (Sentinel Assam, Shillong Times, EastMojo, NE Now)
- `reliability_tier = 3`: Aggregators & Unofficial Feeds

### 4.2 `news.rss_items`
Stores raw ingested feed items with deterministic SHA-256 deduplication:
```sql
content_hash = SHA256(source_id || '|' || url || '|' || title || '|' || description)
```
Status lifecycle: `NEW` $\to$ `FILTERED` | `NLP_PROCESSED` | `GRID_LINKED` | `FAILED`.

### 4.3 `disaster.news_events`
Stores structured disaster events extracted by the NLP engine:
- `geom`: Point geometry in EPSG:4326 with PostGIS GiST index.
- `severity`: Standardized severity score ($0 \le S \le 100$).
- `confidence`: Calibrated extraction confidence ($0.0 \le C \le 1.0$).
- `road_blocked` / `bridge_damaged` / `bridge_closed`: Operational routing flags.
- `valid_until`: Automatic expiration timestamp (default $T_{now} + 48\text{h}$).

### 4.4 `disaster.event_grid_links`
Spatial link table connecting each disaster event to all affected 500m grid cells:
- `impact_score`: Distance-decayed hazard intensity ($0 \le I \le 100$).

### 4.5 `disaster.event_clusters`
Maintains spatio-temporal clusters of corroborated reports across multiple independent news sources.

---

## 5. NLP Extraction & Entity Resolution Engine

### 5.1 Pre-Filtering & Noise Rejection
- Evaluates weighted lexical markers for flood, landslide, earthquake, and infrastructure impacts.
- Applies strict word-boundary noise filters (`\bipl\b`, `\bcricket\b`, `\bpolitics\b`, `\btraffic congestion due to peak hours\b`).

### 5.2 Named Entity Recognition (NER) & Gazetteers
- **35 Assam Districts**: Instant in-memory centroid lookup.
- **12 Meghalaya Districts**: Instant in-memory centroid lookup.
- **150+ Key Towns & Localities**: Guwahati, Dispur, Boko, Lanka, Silchar, Tezpur, Jorhat, Dibrugarh, Tura, Shillong, Nongpoh, Cherrapunji, etc.
- **Major Regional Rivers**: Brahmaputra, Barak, Kopili, Subansiri, Jia Bharali, Simsang, Umngot, Umiam, etc.
- **Key Transport Corridors**: NH-27, NH-6 (GS Road), NH-37 (Assam Trunk Road), NH-17, NH-217.

### 5.3 Distance-Decay Impact Formulation

For a disaster event at $(x_e, y_e)$ with severity $S$, confidence $C$, and buffer radius $R_b$ ($2500\text{m}$ for roads, $1500\text{m}$ for point assets):

$$\text{Decay}(d) = \max\left(0.2, 1.0 - \frac{d}{R_b}\right)$$

$$\text{Impact Score} = S \times C \times \text{Decay}(d)$$

---

## 6. Multi-Source Corroboration Engine

When multiple news outlets report on the same event:
- **Spatial clustering**: Within $15\text{km}$ radius.
- **Temporal window**: Within $72\text{hours}$.
- **Confidence boost**:
  - $N=1$ report: $C = C_{base}$
  - $N=2$ independent reports: $C = \min(0.98, C_{base} + 0.15)$
  - $N \ge 3$ reports: $C = \min(0.98, C_{base} + 0.25)$
  - Tier 1 Government bulletin: $C = \min(0.98, \max(C, 0.90))$

---

## 7. REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/news/sources` | `GET` | List all configured RSS feeds with health and poll status |
| `/api/news/items` | `GET` | List raw ingested items (`?status=NEW/GRID_LINKED/FILTERED`) |
| `/api/news/events` | `GET` | List all extracted disaster events |
| `/api/news/events/active` | `GET` | List currently active disaster events |
| `/api/news/events/:id` | `GET` | Get single disaster event with all linked 500m grid cells |
| `/api/news/events/grid/:gridId` | `GET` | Get all active events impacting a specific 500m grid cell |
| `/api/news/poll` | `POST` | Trigger background polling of all enabled RSS feeds |
| `/api/news/process-pending` | `POST` | Trigger NLP extraction & grid linking on un-extracted items |

---

## 8. Verification & CLI Scripts

### 8.1 Run End-to-End Pipeline
```bash
cd server
node scripts/runNewsPipeline.js
```

### 8.2 Run NLP Unit Test Fixtures
```bash
cd server
node scripts/testNlpFixtures.js
```
