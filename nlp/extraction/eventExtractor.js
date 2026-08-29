// NLP Disaster Event Extractor
// Extracts structured disaster event attributes, hazard type, event type, asset impacts, severity, and confidence

import { createDisasterEventObject } from "../schemas/eventSchema.js";
import { cleanArticleText } from "../preprocessing/textCleaner.js";
import { filterDisasterNews } from "../classification/disasterFilter.js";
import { extractLocationEntities } from "../location/nerLocationExtractor.js";

// Extracts structured disaster event from article fields
export function extractDisasterEvent(rawTitle, rawDesc, rawContent = "", sourceMeta = {}) {
  const { title, description, fullText } = cleanArticleText(rawTitle, rawDesc, rawContent);
  const lowerText = fullText.toLowerCase();

  // 1. Initial Disaster Filter Check
  const filterResult = filterDisasterNews(title, description, rawContent);
  if (!filterResult.isRelevant) {
    return createDisasterEventObject({
      isDisasterEvent: false,
      confidence: 0.1,
      source: {
        sourceId: sourceMeta.sourceId || null,
        url: sourceMeta.url || null,
        title: title,
        publishedAt: sourceMeta.publishedAt || null,
      },
    });
  }

  // 2. Extract Location Entities (give high priority to title mentions)
  const titleLocation = extractLocationEntities(title);
  const fullLocation = extractLocationEntities(fullText);

  // If title has a specific locality, use it over broader body mentions
  const locationInfo = titleLocation.locality ? titleLocation : fullLocation;

  // 3. Detect Hazard Type
  let hazardType = "OTHER_HAZARD";
  if (/flash flood/i.test(lowerText)) {
    hazardType = "FLASH_FLOOD";
  } else if (/flood|floods|flooded|flooding|inundat|waterlog|submerg|deluge|marooned/i.test(lowerText)) {
    hazardType = "FLOOD";
  } else if (/landslide|mudslide|rockfall|debris flow/i.test(lowerText)) {
    hazardType = "LANDSLIDE";
  } else if (/earthquake|tremor|aftershock|seismic/i.test(lowerText)) {
    hazardType = "EARTHQUAKE";
  } else if (/cloudburst|torrential rain|heavy rainfall|cyclone|storm/i.test(lowerText)) {
    hazardType = "SEVERE_RAINFALL";
  } else if (/dam release|dam overflow|water discharge/i.test(lowerText)) {
    hazardType = "DAM_RELEASE";
  }

  // 4. Detect Asset Type & Specific Impact Flags
  let assetType = "UNKNOWN";
  let assetName = locationInfo.corridor || null;

  const isBridgeMentioned = /\bbridges?\b|\bsetu\b|\bculverts?\b/i.test(lowerText);
  const isRoadMentioned = /\broads?\b|\bhighways?\b|\broutes?\b|\bnh-\d+\b|\bcorridors?\b|\bpass\b/i.test(lowerText);
  const isEmbankmentMentioned = /\bembankments?\b|\bdykes?\b|\blevees?\b|\bbunds?\b/i.test(lowerText);
  const isDamMentioned = /\bdams?\b|\breservoirs?\b/i.test(lowerText);

  let roadBlocked = false;
  let bridgeDamaged = false;
  let bridgeClosed = false;
  let evacuationOrdered = false;

  if (isBridgeMentioned) {
    assetType = "BRIDGE";
    if (/washed away|collapsed|washed off/i.test(lowerText)) {
      bridgeDamaged = true;
      bridgeClosed = true;
    } else if (/damaged?|structural damage|cracked/i.test(lowerText)) {
      bridgeDamaged = true;
    }
    if (/closed|closure|traffic suspended|shut down|barred/i.test(lowerText)) {
      bridgeClosed = true;
    }
  } else if (isRoadMentioned) {
    assetType = "ROAD";
    if (/blocked|submerged|flooded|inundated|cut off|impassable|closed|washed away/i.test(lowerText)) {
      roadBlocked = true;
    }
  } else if (isEmbankmentMentioned) {
    assetType = "EMBANKMENT";
  } else if (isDamMentioned) {
    assetType = "DAM";
  }

  if (/evacuat|relief camp|shifted to safety|marooned families/i.test(lowerText)) {
    evacuationOrdered = true;
  }

  // 5. Determine Specific Event Type
  let eventType = hazardType;

  if (assetType === "BRIDGE") {
    if (/washed away|collapsed/i.test(lowerText)) {
      eventType = "BRIDGE_WASHOUT";
    } else if (bridgeClosed) {
      eventType = "BRIDGE_CLOSURE";
    } else if (bridgeDamaged) {
      eventType = "BRIDGE_DAMAGE";
    }
  } else if (assetType === "ROAD" || roadBlocked) {
    if (hazardType === "FLOOD" || /flooded|submerged/i.test(lowerText)) {
      eventType = "ROAD_FLOODING";
    } else if (/blocked|cut off|impassable/i.test(lowerText)) {
      eventType = "ROAD_BLOCKAGE";
    } else if (/cave in|collapsed|washed away/i.test(lowerText)) {
      eventType = "ROAD_COLLAPSE";
    }
  } else if (isEmbankmentMentioned && /breach|breached|damaged/i.test(lowerText)) {
    eventType = "EMBANKMENT_BREACH";
  } else if (evacuationOrdered && !roadBlocked && !bridgeDamaged) {
    eventType = "EVACUATION";
  }

  // 6. Calculate Severity Score (0-100)
  let severityScore = 40; // baseline moderate disaster mention

  if (eventType === "BRIDGE_WASHOUT" || eventType === "DAM_FAILURE") {
    severityScore = 95;
  } else if (eventType === "BRIDGE_CLOSURE" || eventType === "ROAD_COLLAPSE") {
    severityScore = 85;
  } else if (eventType === "BRIDGE_DAMAGE" || eventType === "EMBANKMENT_BREACH") {
    severityScore = 80;
  } else if (eventType === "ROAD_FLOODING" || eventType === "ROAD_BLOCKAGE") {
    severityScore = 78;
  } else if (eventType === "FLASH_FLOOD" || eventType === "LANDSLIDE") {
    severityScore = 70;
  } else if (eventType === "FLOOD") {
    severityScore = 60;
  }

  // Additional modifier based on casualty or extensive damage keywords
  if (/death|killed|fatal|submerged villages|massive landslide|major breach/i.test(lowerText)) {
    severityScore = Math.min(100, severityScore + 10);
  }

  // 7. Check for Historical Event Markers
  const isHistorical = /years ago|in 20\d\d|historical flood|past disaster|commemorate/i.test(lowerText) &&
                       !/today|yesterday|fresh flood|current flood|ongoing|alert/i.test(lowerText);

  // 8. Calculate NLP Extraction Confidence (0.0 - 1.0)
  let nlpConfidence = 0.55;

  // Base confidence boosted by number of distinct disaster keywords
  nlpConfidence += Math.min(0.20, filterResult.matchedKeywords.length * 0.05);

  // Location resolution boost
  if (locationInfo.coordinates) {
    nlpConfidence += 0.15;
  } else if (locationInfo.district) {
    nlpConfidence += 0.10;
  }

  // Impact explicitness boost
  if (roadBlocked || bridgeDamaged || bridgeClosed || evacuationOrdered) {
    nlpConfidence += 0.10;
  }

  // Clamp confidence to [0.2, 0.98]
  nlpConfidence = Math.min(0.98, Math.max(0.2, Math.round(nlpConfidence * 100) / 100));

  return createDisasterEventObject({
    isDisasterEvent: true,
    eventType,
    hazardType,
    severity: severityScore,
    confidence: nlpConfidence,
    location: {
      rawText: locationInfo.rawLocationString,
      placeNames: locationInfo.placeNames,
      locality: locationInfo.locality,
      district: locationInfo.district,
      state: locationInfo.state,
      corridor: locationInfo.corridor,
      river: locationInfo.river,
      coordinates: locationInfo.coordinates,
    },
    asset: {
      type: assetType,
      name: assetName,
    },
    impact: {
      roadBlocked,
      bridgeDamaged,
      bridgeClosed,
      peopleAffected: null,
      evacuationOrdered,
    },
    temporal: {
      eventTime: sourceMeta.publishedAt || null,
      isHistorical,
      validUntil: null,
    },
    source: {
      sourceId: sourceMeta.sourceId || null,
      url: sourceMeta.url || null,
      title: title,
      publishedAt: sourceMeta.publishedAt || null,
    },
  });
}

export default {
  extractDisasterEvent,
};
