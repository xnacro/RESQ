// RSS Feed Source Registry & Configurations for Assam, Meghalaya, and Northeast India
// Supports multi-tier reliability classification and dynamic configuration

export const RSS_SOURCES = Object.freeze([
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
    id: "ndtv_northeast",
    name: "NDTV Northeast",
    url: "https://feeds.feedburner.com/ndtvnews-northeast",
    language: "en",
    region: "Northeast India",
    sourceType: "NATIONAL_NEWS",
    reliabilityTier: 2,
    enabled: true,
  },
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
