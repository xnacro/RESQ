// RSS Ingestion & Parsing Engine
// Fetches, parses, deduplicates, and stores raw news items from configured RSS sources
import https from "https";
import http from "http";
import url from "url";
import crypto from "crypto";
import pool from "../../config/db.js";
import { RSS_SOURCES } from "./rssConfig.js";
import { stripHtml } from "../../../nlp/preprocessing/textCleaner.js";

// Computes deterministic SHA-256 hash for deduplicating news items
export function computeItemHash(sourceId, itemUrl, title, description) {
  const payload = `${sourceId}|${(itemUrl || "").trim()}|${(title || "").trim()}|${(description || "").trim()}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// Synchronizes configured RSS sources into database
export const syncRssSources = async () => {
  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");
    for (const src of RSS_SOURCES) {
      await client.query(
        `
        INSERT INTO news.rss_sources (id, name, url, language, region, source_type, reliability_tier, enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          url = EXCLUDED.url,
          region = EXCLUDED.region,
          reliability_tier = EXCLUDED.reliability_tier,
          enabled = EXCLUDED.enabled;
      `,
        [src.id, src.name, src.url, src.language, src.region, src.sourceType, src.reliabilityTier, src.enabled]
      );
    }
  } finally {
    client.release();
  }
};

// Performs robust HTTP/HTTPS GET request with redirects and timeout handling
export function fetchFeedXml(feedUrl, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error("Too many redirects"));
    }

    const parsed = url.parse(feedUrl);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.get(
      feedUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RESQ-Disaster-Intelligence/1.0",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        timeout: 12000,
        rejectUnauthorized: false,
      },
      (res) => {
        // Handle HTTP redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = url.resolve(feedUrl, res.headers.location);
          return resolve(fetchFeedXml(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP status ${res.statusCode}`));
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve(body);
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Feed request timed out after 12 seconds"));
    });
  });
}

// Extracts tag content from XML snippet
function getTagContent(xmlSnippet, tagName) {
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, "i");
  const cdataMatch = xmlSnippet.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const standardRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xmlSnippet.match(standardRegex);
  return match ? match[1].trim() : null;
}

// Parses raw RSS 2.0 and Atom XML feed into structured items
export function parseRssXml(xmlText) {
  const items = [];
  if (!xmlText) return items;

  // Split into RSS <item> or Atom <entry> blocks
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || xmlText.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const snippet of itemMatches) {
    const rawTitle = getTagContent(snippet, "title") || "";
    const rawLink = getTagContent(snippet, "link") || "";
    const rawGuid = getTagContent(snippet, "guid") || getTagContent(snippet, "id") || rawLink;
    const rawDesc = getTagContent(snippet, "description") || getTagContent(snippet, "summary") || "";
    const rawContent = getTagContent(snippet, "content:encoded") || getTagContent(snippet, "content") || "";
    const rawPubDate = getTagContent(snippet, "pubDate") || getTagContent(snippet, "published") || getTagContent(snippet, "updated") || "";

    // Clean text fields
    const title = stripHtml(rawTitle);
    const description = stripHtml(rawDesc);
    const content = stripHtml(rawContent);

    // Parse date safely
    let publishedAt = null;
    if (rawPubDate) {
      const parsedDate = new Date(rawPubDate);
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate;
      }
    }

    if (title.length > 5) {
      items.push({
        guid: rawGuid,
        title,
        description,
        content,
        url: rawLink,
        publishedAt,
      });
    }
  }

  return items;
}

// Ingests an individual RSS source feed and persists new items
export const ingestSingleFeed = async (sourceConfig) => {
  const result = {
    sourceId: sourceConfig.id,
    fetched: 0,
    newItems: 0,
    status: "SUCCESS",
    error: null,
  };

  const client = await pool.connect();
  try {
    await client.query("SET default_transaction_read_only = off;");
    const xml = await fetchFeedXml(sourceConfig.url);
    const parsedItems = parseRssXml(xml);
    result.fetched = parsedItems.length;

    for (const item of parsedItems) {
      const hash = computeItemHash(sourceConfig.id, item.url, item.title, item.description);

      const insertRes = await client.query(
        `
        INSERT INTO news.rss_items (
          source_id, guid, title, description, content, url, published_at, language, content_hash, processing_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'NEW')
        ON CONFLICT (content_hash) DO NOTHING
        RETURNING id;
      `,
        [
          sourceConfig.id,
          item.guid,
          item.title,
          item.description,
          item.content,
          item.url,
          item.publishedAt,
          sourceConfig.language || "en",
          hash,
        ]
      );

      if (insertRes.rows.length > 0) {
        result.newItems++;
      }
    }

    // Update source poll status
    await client.query(
      `
      UPDATE news.rss_sources
      SET last_polled_at = NOW(), last_status = 'SUCCESS'
      WHERE id = $1;
    `,
      [sourceConfig.id]
    );
  } catch (err) {
    result.status = "FAILED";
    result.error = err.message;

    await client.query(
      `
      UPDATE news.rss_sources
      SET last_polled_at = NOW(), last_status = $2
      WHERE id = $1;
    `,
      [sourceConfig.id, `FAILED: ${err.message}`]
    );
  } finally {
    client.release();
  }

  return result;
};

// Polls all enabled RSS sources concurrently
export const pollAllRssSources = async () => {
  await syncRssSources();
  const results = [];

  for (const src of RSS_SOURCES) {
    if (!src.enabled) continue;
    console.log(`📡 Polling RSS feed: ${src.name} (${src.url})...`);
    const res = await ingestSingleFeed(src);
    results.push(res);
    console.log(`   ↳ [${res.status}] Fetched ${res.fetched} items, ${res.newItems} new items stored.`);
  }

  return results;
};

export default {
  computeItemHash,
  syncRssSources,
  fetchFeedXml,
  parseRssXml,
  ingestSingleFeed,
  pollAllRssSources,
};
