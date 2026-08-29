// Disaster Classification & Pre-Filtering Engine
// Performs fast lexical filtering to identify disaster-relevant news before detailed NLP extraction

// Positive disaster keyword dictionary with weights
export const DISASTER_KEYWORDS = Object.freeze([
  // Flood & Hydrology
  { word: "flood", weight: 3, category: "FLOOD" },
  { word: "floods", weight: 3, category: "FLOOD" },
  { word: "flooded", weight: 3, category: "FLOOD" },
  { word: "flooding", weight: 3, category: "FLOOD" },
  { word: "flash flood", weight: 4, category: "FLASH_FLOOD" },
  { word: "inundated", weight: 3, category: "FLOOD" },
  { word: "inundation", weight: 3, category: "FLOOD" },
  { word: "submerged", weight: 3, category: "FLOOD" },
  { word: "waterlogging", weight: 2, category: "FLOOD" },
  { word: "waterlogged", weight: 2, category: "FLOOD" },
  { word: "embankment breach", weight: 4, category: "FLOOD" },
  { word: "breached", weight: 2, category: "FLOOD" },
  { word: "overflowing", weight: 2, category: "FLOOD" },
  { word: "danger level", weight: 3, category: "FLOOD" },
  { word: "deluge", weight: 3, category: "FLOOD" },
  { word: "marooned", weight: 3, category: "FLOOD" },

  // Landslide & Geological
  { word: "landslide", weight: 4, category: "LANDSLIDE" },
  { word: "landslides", weight: 4, category: "LANDSLIDE" },
  { word: "mudslide", weight: 4, category: "LANDSLIDE" },
  { word: "rockfall", weight: 3, category: "LANDSLIDE" },
  { word: "debris", weight: 2, category: "LANDSLIDE" },
  { word: "cave-in", weight: 3, category: "LANDSLIDE" },
  { word: "earthquake", weight: 4, category: "EARTHQUAKE" },
  { word: "tremor", weight: 3, category: "EARTHQUAKE" },
  { word: "aftershock", weight: 3, category: "EARTHQUAKE" },

  // Infrastructure Impacts & Closures
  { word: "bridge collapse", weight: 5, category: "INFRASTRUCTURE" },
  { word: "bridge damaged", weight: 4, category: "INFRASTRUCTURE" },
  { word: "bridge damage", weight: 4, category: "INFRASTRUCTURE" },
  { word: "structural damage", weight: 3, category: "INFRASTRUCTURE" },
  { word: "bridge washed away", weight: 5, category: "INFRASTRUCTURE" },
  { word: "bridge closed", weight: 4, category: "INFRASTRUCTURE" },
  { word: "bridge closure", weight: 4, category: "INFRASTRUCTURE" },
  { word: "bridge", weight: 2, category: "INFRASTRUCTURE" },
  { word: "road blocked", weight: 4, category: "INFRASTRUCTURE" },
  { word: "routes blocked", weight: 4, category: "INFRASTRUCTURE" },
  { word: "highway blocked", weight: 4, category: "INFRASTRUCTURE" },
  { word: "traffic suspended", weight: 3, category: "INFRASTRUCTURE" },
  { word: "road washed away", weight: 4, category: "INFRASTRUCTURE" },
  { word: "road collapse", weight: 4, category: "INFRASTRUCTURE" },
  { word: "culvert damaged", weight: 3, category: "INFRASTRUCTURE" },
  { word: "dam overflow", weight: 4, category: "INFRASTRUCTURE" },
  { word: "dam release", weight: 3, category: "INFRASTRUCTURE" },

  // Extreme Weather & Operations
  { word: "cloudburst", weight: 4, category: "WEATHER" },
  { word: "heavy rainfall", weight: 3, category: "WEATHER" },
  { word: "torrential rain", weight: 3, category: "WEATHER" },
  { word: "cyclone", weight: 4, category: "WEATHER" },
  { word: "evacuation", weight: 3, category: "EMERGENCY" },
  { word: "evacuated", weight: 3, category: "EMERGENCY" },
  { word: "relief camp", weight: 2, category: "EMERGENCY" },
  { word: "ndrf", weight: 2, category: "EMERGENCY" },
  { word: "sdrf", weight: 2, category: "EMERGENCY" },
  { word: "rescue operation", weight: 2, category: "EMERGENCY" },
  { word: "asdma", weight: 2, category: "EMERGENCY" },
]);

// Non-disaster / noise blacklist keywords that indicate false positives
export const NOISE_KEYWORDS = Object.freeze([
  "traffic congestion due to peak hours",
  "commuters complain of routine traffic",
  "cricket match",
  "ipl",
  "bollywood",
  "box office",
  "election campaign",
  "political debate",
  "stock market",
  "gold price",
  "sensex",
  "nifty",
]);

// Filters whether text passes disaster relevance threshold
export function filterDisasterNews(title, description, content = "") {
  const combinedText = `${title || ""} ${description || ""} ${content || ""}`.toLowerCase();

  // Check for negative noise patterns using word boundaries
  for (const noise of NOISE_KEYWORDS) {
    const noiseRegex = new RegExp(`\\b${noise}\\b`, "i");
    if (noiseRegex.test(combinedText)) {
      return {
        isRelevant: false,
        score: 0,
        matchedKeywords: [],
        reason: `Filtered out by noise keyword: "${noise}"`,
      };
    }
  }

  let totalScore = 0;
  const matched = [];

  for (const item of DISASTER_KEYWORDS) {
    const regex = new RegExp(`\\b${item.word}\\b`, "i");
    if (regex.test(combinedText)) {
      totalScore += item.weight;
      matched.push(item.word);
    }
  }

  // Minimum threshold of 2 points to qualify for deep NLP extraction
  const isRelevant = totalScore >= 2;

  return {
    isRelevant,
    score: totalScore,
    matchedKeywords: [...new Set(matched)],
    reason: isRelevant ? "Passed disaster relevance threshold" : "Score below threshold",
  };
}

export default {
  DISASTER_KEYWORDS,
  NOISE_KEYWORDS,
  filterDisasterNews,
};
