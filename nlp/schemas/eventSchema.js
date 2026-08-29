// NLP Event Schema Definition & Controlled Vocabularies
// Defines structured disaster event taxonomy, hazard categories, asset types, and validation rules

// Controlled vocabulary for hazard categories
export const HAZARD_TYPES = Object.freeze([
  "FLOOD",
  "FLASH_FLOOD",
  "LANDSLIDE",
  "EARTHQUAKE",
  "EROSION",
  "STORM",
  "CYCLONE",
  "DAM_RELEASE",
  "OTHER_HAZARD",
]);

// Controlled vocabulary for specific disaster events
export const EVENT_TYPES = Object.freeze([
  "FLOOD",
  "FLASH_FLOOD",
  "LANDSLIDE",
  "EARTHQUAKE",
  "ROAD_BLOCKAGE",
  "ROAD_FLOODING",
  "ROAD_COLLAPSE",
  "BRIDGE_DAMAGE",
  "BRIDGE_CLOSURE",
  "BRIDGE_WASHOUT",
  "EMBANKMENT_BREACH",
  "EVACUATION",
  "DAM_FAILURE",
  "DEBRIS_BLOCKAGE",
  "SEVERE_RAINFALL",
  "RIVER_OVERFLOW",
  "OTHER_DISASTER",
]);

// Controlled vocabulary for affected infrastructure asset types
export const ASSET_TYPES = Object.freeze([
  "ROAD",
  "HIGHWAY",
  "BRIDGE",
  "CULVERT",
  "EMBANKMENT",
  "DAM",
  "RELIEF_CAMP",
  "SETTLEMENT",
  "RIVER_BANK",
  "UNKNOWN",
]);

// Controlled vocabulary for event lifecycle status
export const EVENT_STATUSES = Object.freeze([
  "ACTIVE",
  "RESOLVED",
  "EXPIRED",
  "UNCERTAIN",
]);

// Creates a standardized empty or populated disaster event object
export function createDisasterEventObject(overrides = {}) {
  return {
    isDisasterEvent: false,
    eventType: "OTHER_DISASTER",
    hazardType: "OTHER_HAZARD",
    severity: 0,
    confidence: 0.0,
    location: {
      rawText: null,
      placeNames: [],
      locality: null,
      district: null,
      state: null,
      corridor: null,
      river: null,
      coordinates: null,
    },
    asset: {
      type: "UNKNOWN",
      name: null,
    },
    impact: {
      roadBlocked: false,
      bridgeDamaged: false,
      bridgeClosed: false,
      peopleAffected: null,
      evacuationOrdered: false,
    },
    temporal: {
      eventTime: null,
      isHistorical: false,
      validUntil: null,
    },
    source: {
      sourceId: null,
      url: null,
      title: null,
      publishedAt: null,
    },
    nlpMeta: {
      model: "resq-nlp-rule-extractor",
      version: "1.0.0",
      extractedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

export default {
  HAZARD_TYPES,
  EVENT_TYPES,
  ASSET_TYPES,
  EVENT_STATUSES,
  createDisasterEventObject,
};
