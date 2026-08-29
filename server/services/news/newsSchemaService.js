// Database Schema Initializer for RSS News & Disaster Events
// Creates and verifies tables in 'news' and 'disaster' schemas with spatial PostGIS indexing
import pool from "../../config/db.js";

export const initNewsAndEventSchemas = async () => {
  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");
    await client.query("BEGIN;");

    // 1. Create schemas
    await client.query("CREATE SCHEMA IF NOT EXISTS news;");
    await client.query("CREATE SCHEMA IF NOT EXISTS disaster;");

    // 2. RSS Sources Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS news.rss_sources (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        language VARCHAR(20) DEFAULT 'en',
        region VARCHAR(100) DEFAULT 'Northeast India',
        source_type VARCHAR(50) DEFAULT 'REGIONAL_NEWS',
        reliability_tier INTEGER DEFAULT 2,
        enabled BOOLEAN DEFAULT TRUE,
        last_polled_at TIMESTAMPTZ,
        last_status VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. RSS Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS news.rss_items (
        id BIGSERIAL PRIMARY KEY,
        source_id VARCHAR(50) REFERENCES news.rss_sources(id) ON DELETE SET NULL,
        guid VARCHAR(500),
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        url TEXT,
        published_at TIMESTAMPTZ,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        language VARCHAR(20) DEFAULT 'en',
        content_hash VARCHAR(64) NOT NULL UNIQUE,
        processing_status VARCHAR(50) DEFAULT 'NEW',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rss_items_status ON news.rss_items (processing_status);
      CREATE INDEX IF NOT EXISTS idx_rss_items_published ON news.rss_items (published_at);
    `);

    // 4. Disaster News Events Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disaster.news_events (
        id BIGSERIAL PRIMARY KEY,
        rss_item_id BIGINT REFERENCES news.rss_items(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL,
        hazard_type VARCHAR(50) NOT NULL,
        severity DOUBLE PRECISION NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        location_text TEXT,
        district VARCHAR(100),
        state VARCHAR(50),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        geom GEOMETRY(POINT, 4326),
        asset_type VARCHAR(50),
        asset_name VARCHAR(255),
        road_blocked BOOLEAN DEFAULT FALSE,
        bridge_damaged BOOLEAN DEFAULT FALSE,
        bridge_closed BOOLEAN DEFAULT FALSE,
        event_time TIMESTAMPTZ,
        reported_at TIMESTAMPTZ DEFAULT NOW(),
        valid_until TIMESTAMPTZ,
        event_status VARCHAR(30) DEFAULT 'ACTIVE',
        nlp_model VARCHAR(100),
        nlp_version VARCHAR(50),
        raw_extraction JSONB,
        cluster_id BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_news_events_geom ON disaster.news_events USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_news_events_status ON disaster.news_events (event_status);
      CREATE INDEX IF NOT EXISTS idx_news_events_type ON disaster.news_events (event_type);
      CREATE INDEX IF NOT EXISTS idx_news_events_state ON disaster.news_events (state);
    `);

    // 5. Event to 500m Grid Link Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disaster.event_grid_links (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT REFERENCES disaster.news_events(id) ON DELETE CASCADE,
        grid_id VARCHAR(50) NOT NULL,
        state VARCHAR(50) NOT NULL,
        impact_score DOUBLE PRECISION DEFAULT 0,
        linked_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_event_grid UNIQUE (event_id, grid_id)
      );
      CREATE INDEX IF NOT EXISTS idx_event_grid_grid_id ON disaster.event_grid_links (grid_id);
      CREATE INDEX IF NOT EXISTS idx_event_grid_event_id ON disaster.event_grid_links (event_id);
    `);

    // 6. Multi-Source Event Clusters Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disaster.event_clusters (
        id BIGSERIAL PRIMARY KEY,
        canonical_event_id BIGINT,
        event_type VARCHAR(50) NOT NULL,
        hazard_type VARCHAR(50) NOT NULL,
        source_count INTEGER DEFAULT 1,
        corroboration_score DOUBLE PRECISION DEFAULT 1.0,
        geom GEOMETRY(POINT, 4326),
        first_reported_at TIMESTAMPTZ,
        last_reported_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_event_clusters_geom ON disaster.event_clusters USING GIST (geom);
    `);

    await client.query("COMMIT;");
    console.log("✅ News & Disaster Event tables initialized successfully in PostGIS.");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
};

export default {
  initNewsAndEventSchemas,
};
