// RSS Feed Source Registry & Configurations for Assam, Meghalaya, and Northeast India
// Supports multi-tier reliability classification, topic filtering, and dynamic regional sources

export const RSS_SOURCES = Object.freeze([
  // 1. Assam Regional Direct News Feeds
  {
    id: "sentinel_assam",
    name: "The Sentinel Assam",
    url: "https://www.sentinelassam.com/feed",
    language: "en",
    region: "Assam",
    sourceType: "REGIONAL_NEWS",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "google_news_assam_disaster",
    name: "Google News - Assam Flood & Disaster Monitor",
    url: "https://news.google.com/rss/search?q=Assam+flood+OR+landslide+OR+disaster&hl=en-IN&gl=IN&ceid=IN:en",
    language: "en",
    region: "Assam",
    sourceType: "NEWS_AGGREGATOR",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "google_news_guwahati_urban",
    name: "Google News - Guwahati & Kamrup Flood Alert",
    url: "https://news.google.com/rss/search?q=Guwahati+flood+OR+waterlogging+OR+submerged&hl=en-IN&gl=IN&ceid=IN:en",
    language: "en",
    region: "Assam",
    sourceType: "NEWS_AGGREGATOR",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "google_news_barak_valley",
    name: "Google News - Barak Valley & Silchar Flood Monitor",
    url: "https://news.google.com/rss/search?q=Barak+valley+flood+OR+Silchar+flood+OR+Cachar&hl=en-IN&gl=IN&ceid=IN:en",
    language: "en",
    region: "Assam",
    sourceType: "NEWS_AGGREGATOR",
    reliabilityTier: 2,
    enabled: true,
  },

  // 2. Meghalaya Regional Direct News Feeds
  {
    id: "shillong_times",
    name: "The Shillong Times",
    url: "https://theshillongtimes.com/feed/",
    language: "en",
    region: "Meghalaya",
    sourceType: "REGIONAL_NEWS",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "hub_news_meghalaya",
    name: "Hub News Meghalaya",
    url: "https://hubnetwork.in/feed/",
    language: "en",
    region: "Meghalaya",
    sourceType: "REGIONAL_NEWS",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "google_news_meghalaya_landslide",
    name: "Google News - Meghalaya Landslide & Road Closure",
    url: "https://news.google.com/rss/search?q=Meghalaya+landslide+OR+flood+OR+road+blockage+OR+Shillong&hl=en-IN&gl=IN&ceid=IN:en",
    language: "en",
    region: "Meghalaya",
    sourceType: "NEWS_AGGREGATOR",
    reliabilityTier: 2,
    enabled: true,
  },

  // 3. Northeast Regional Multi-Hazard News Feeds
  {
    id: "northeast_now",
    name: "Northeast Now",
    url: "https://nenow.in/feed",
    language: "en",
    region: "Northeast India",
    sourceType: "REGIONAL_NEWS",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "eastmojo",
    name: "EastMojo",
    url: "https://www.eastmojo.com/feed/",
    language: "en",
    region: "Northeast India",
    sourceType: "REGIONAL_NEWS",
    reliabilityTier: 2,
    enabled: true,
  },
  {
    id: "google_news_ne_corridors",
    name: "Google News - Northeast Highway & Infrastructure Disruption",
    url: "https://news.google.com/rss/search?q=Guwahati+Shillong+highway+OR+NH-27+blocked+OR+bridge+collapsed+Assam&hl=en-IN&gl=IN&ceid=IN:en",
    language: "en",
    region: "Northeast India",
    sourceType: "NEWS_AGGREGATOR",
    reliabilityTier: 2,
    enabled: true,
  },

  // 4. Official Government Bulletins
  {
    id: "pib_guwahati",
    name: "Press Information Bureau (PIB) Guwahati",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=11",
    language: "en",
    region: "Assam",
    sourceType: "GOVERNMENT_BULLETIN",
    reliabilityTier: 1,
    enabled: true,
  },
]);

export default {
  RSS_SOURCES,
};
