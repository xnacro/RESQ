# RESQ — RSS News Ingestion + NLP Disaster Event Extraction Pipeline

## 1. Architectural Overview

The RESQ disaster intelligence system fuses static geospatial baselines with live multi-source situational awareness. While the **500m × 500m Grid Single Source of Truth (SSOT)** provides static susceptibility across terrain, hydrology, and zonation, the **News & NLP Ingestion Pipeline** extracts, verifies, and geolocates real-time incident intelligence across Assam and Meghalaya.

```
RAW RSS FEEDS (Sentinel, Shillong Times, Hub News, EastMojo, NE Now, Google News, PIB)
                                        │
                                        ▼
                       news.rss_items (Chunked Bulk Deduplication)
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

## 3. Configured RSS Feeds & Regional Coverage

The RSS feeds are centrally configured in [server/services/news/rssConfig.js](file:///f:/RESQ/server/services/news/rssConfig.js) and synced with table `news.rss_sources`:

### 3.1 Assam State Feeds
- **The Sentinel Assam**: `https://www.sentinelassam.com/feed` (Regional News - Tier 2)
- **Google News Assam Flood Monitor**: `https://news.google.com/rss/search?q=Assam+flood+OR+landslide+OR+disaster&hl=en-IN&gl=IN&ceid=IN:en` (Aggregator - Tier 2)
- **Google News Guwahati Urban Alert**: `https://news.google.com/rss/search?q=Guwahati+flood+OR+waterlogging+OR+submerged&hl=en-IN&gl=IN&ceid=IN:en` (Aggregator - Tier 2)
- **Google News Barak Valley & Silchar Flood Monitor**: `https://news.google.com/rss/search?q=Barak+valley+flood+OR+Silchar+flood+OR+Cachar&hl=en-IN&gl=IN&ceid=IN:en` (Aggregator - Tier 2)
- **Press Information Bureau (PIB) Guwahati**: `https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=11` (Official Bulletin - Tier 1)

### 3.2 Meghalaya State Feeds
- **The Shillong Times**: `https://theshillongtimes.com/feed/` (Regional News - Tier 2)
- **Hub News Meghalaya**: `https://hubnetwork.in/feed/` (Regional News - Tier 2)
- **Google News Meghalaya Landslide & Road Closure**: `https://news.google.com/rss/search?q=Meghalaya+landslide+OR+flood+OR+road+blockage+OR+Shillong&hl=en-IN&gl=IN&ceid=IN:en` (Aggregator - Tier 2)

### 3.3 Northeast Regional Multi-Hazard Feeds
- **Northeast Now**: `https://nenow.in/feed` (Regional News - Tier 2)
- **EastMojo**: `https://www.eastmojo.com/feed/` (Regional News - Tier 2)
- **Google News Northeast Highway & Corridor Disruptions**: `https://news.google.com/rss/search?q=Guwahati+Shillong+highway+OR+NH-27+blocked+OR+bridge+collapsed+Assam&hl=en-IN&gl=IN&ceid=IN:en` (Aggregator - Tier 2)

---

## 4. Controlled Vocabularies & Schemas

### 4.1 Controlled Vocabularies

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

## 5. PostGIS Database Schemas

### 5.1 `news.rss_sources`
Tracks RSS endpoints, polling frequencies, regions, and reliability tiers:
- `reliability_tier = 1`: Official Government Bulletins (ASDMA, NDMA, PIB)
- `reliability_tier = 2`: Established Regional News Media & Topic Feeds
- `reliability_tier = 3`: Aggregators & Unofficial Feeds

### 5.2 `news.rss_items`
Stores raw ingested feed items with deterministic SHA-256 deduplication:
```sql
content_hash = SHA256(source_id || '|' || url || '|' || title || '|' || description)
```
Status lifecycle: `NEW` $\to$ `FILTERED` | `NLP_PROCESSED` | `GRID_LINKED` | `FAILED`.

### 5.3 `disaster.news_events`
Stores structured disaster events extracted by the NLP engine:
- `geom`: Point geometry in EPSG:4326 with PostGIS GiST index.
- `severity`: Standardized severity score ($0 \le S \le 100$).
- `confidence`: Calibrated extraction confidence ($0.0 \le C \le 1.0$).
- `road_blocked` / `bridge_damaged` / `bridge_closed`: Operational routing flags.
- `valid_until`: Automatic expiration timestamp (default $T_{now} + 48\text{h}$).

### 5.4 `disaster.event_grid_links`
Spatial link table connecting each disaster event to all affected 500m grid cells:
- `impact_score`: Distance-decayed hazard intensity ($0 \le I \le 100$).

### 5.5 `disaster.event_clusters`
Maintains spatio-temporal clusters of corroborated reports across multiple independent news sources.

---

## 6. Automated Background Cron Scheduler

The system includes a dedicated cron scheduler in [server/services/news/newsSchedulerService.js](file:///f:/RESQ/server/services/news/newsSchedulerService.js):

- **Automatic Startup**: Controlled via `ENABLE_NEWS_CRON=true` and `NEWS_CRON_INTERVAL_MINUTES=15` in `server/.env`.
- **Pipeline Execution**:
  1. Polls all active RSS feeds with chunked bulk insertion.
  2. Runs NLP disaster extraction, classification, and coordinate resolution on pending items.
  3. Links affected 500m grid cells and updates dynamic factors (`news_risk`, `nlp_event_risk`, `road_closure_risk`).
  4. Maintains real-time execution statistics (`totalRuns`, `lastRunAt`, `nextRunAt`, `metrics`).

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
| `/api/news/poll` | `POST` | Trigger manual polling of all enabled RSS feeds |
| `/api/news/process-pending` | `POST` | Trigger NLP extraction & grid linking on un-extracted items |
| `/api/news/cron/status` | `GET` | Get background cron scheduler status and metrics |
| `/api/news/cron/start` | `POST` | Start automated background cron scheduler |
| `/api/news/cron/stop` | `POST` | Stop automated background cron scheduler |
| `/api/news/cron/run-now` | `POST` | Trigger an immediate end-to-end cron pipeline cycle |

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
