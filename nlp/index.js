// Main Entrypoint for RESQ NLP Disaster Extraction Engine
import { extractDisasterEvent } from "./extraction/eventExtractor.js";
import { filterDisasterNews } from "./classification/disasterFilter.js";
import { extractLocationEntities } from "./location/nerLocationExtractor.js";
import { cleanArticleText, stripHtml } from "./preprocessing/textCleaner.js";
import { HAZARD_TYPES, EVENT_TYPES, ASSET_TYPES, EVENT_STATUSES } from "./schemas/eventSchema.js";

export {
  extractDisasterEvent,
  filterDisasterNews,
  extractLocationEntities,
  cleanArticleText,
  stripHtml,
  HAZARD_TYPES,
  EVENT_TYPES,
  ASSET_TYPES,
  EVENT_STATUSES,
};

export default {
  extractDisasterEvent,
  filterDisasterNews,
  extractLocationEntities,
  cleanArticleText,
  stripHtml,
  HAZARD_TYPES,
  EVENT_TYPES,
  ASSET_TYPES,
  EVENT_STATUSES,
};
