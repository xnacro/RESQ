// Named Entity Location & Corridor Extractor for Assam & Meghalaya
// Identifies districts, towns, localities, rivers, corridors, highways, and infrastructure assets from news text

// Complete registry of all 35 Assam Districts
export const ASSAM_DISTRICTS = Object.freeze([
  "Kamrup", "Kamrup Metropolitan", "Kamrup Metro", "Cachar", "Dibrugarh", "Jorhat",
  "Nagaon", "Sonitpur", "Barpeta", "Dhubri", "Goalpara", "Golaghat", "Dima Hasao",
  "Karbi Anglong", "West Karbi Anglong", "Lakhimpur", "North Lakhimpur", "Dhemaji",
  "Tinsukia", "Sivasagar", "Charaideo", "Morigaon", "Nalbari", "Bongaigaon", "Chirang",
  "Kokrajhar", "Baksa", "Udalguri", "Tamulpur", "Bajali", "Hojai", "Biswanath", "Majuli",
  "South Salmara", "Karimganj", "Hailakandi", "Darrang"
]);

// Complete registry of all 12 Meghalaya Districts
export const MEGHALAYA_DISTRICTS = Object.freeze([
  "East Khasi Hills", "West Khasi Hills", "South West Khasi Hills", "Ri-Bhoi", "Ri Bhoi",
  "West Jaintia Hills", "East Jaintia Hills", "East Garo Hills", "West Garo Hills",
  "South Garo Hills", "North Garo Hills", "South West Garo Hills", "Eastern West Khasi Hills"
]);

// Pre-computed district centroid coordinate dictionary (0ms in-memory lookup)
export const DISTRICT_CENTROIDS = Object.freeze({
  "Kamrup": { lat: 26.3100, lon: 91.5400, state: "Assam" },
  "Kamrup Metropolitan": { lat: 26.1445, lon: 91.7362, state: "Assam" },
  "Kamrup Metro": { lat: 26.1445, lon: 91.7362, state: "Assam" },
  "Cachar": { lat: 24.8266, lon: 92.7976, state: "Assam" },
  "Dibrugarh": { lat: 27.4728, lon: 94.9120, state: "Assam" },
  "Jorhat": { lat: 26.7509, lon: 94.2037, state: "Assam" },
  "Nagaon": { lat: 26.3452, lon: 92.6839, state: "Assam" },
  "Sonitpur": { lat: 26.6500, lon: 92.8000, state: "Assam" },
  "Barpeta": { lat: 26.3200, lon: 91.0067, state: "Assam" },
  "Dhubri": { lat: 26.0200, lon: 89.9800, state: "Assam" },
  "Goalpara": { lat: 26.1700, lon: 90.6200, state: "Assam" },
  "Golaghat": { lat: 26.5200, lon: 93.9700, state: "Assam" },
  "Dima Hasao": { lat: 25.1800, lon: 93.0200, state: "Assam" },
  "Karbi Anglong": { lat: 25.8400, lon: 93.4300, state: "Assam" },
  "West Karbi Anglong": { lat: 25.9600, lon: 92.6200, state: "Assam" },
  "Lakhimpur": { lat: 27.2300, lon: 94.1000, state: "Assam" },
  "North Lakhimpur": { lat: 27.2300, lon: 94.1000, state: "Assam" },
  "Dhemaji": { lat: 27.4800, lon: 94.5800, state: "Assam" },
  "Tinsukia": { lat: 27.5000, lon: 95.3667, state: "Assam" },
  "Sivasagar": { lat: 26.9800, lon: 94.6300, state: "Assam" },
  "Charaideo": { lat: 26.9500, lon: 94.9200, state: "Assam" },
  "Morigaon": { lat: 26.2500, lon: 92.3400, state: "Assam" },
  "Nalbari": { lat: 26.4400, lon: 91.4400, state: "Assam" },
  "Bongaigaon": { lat: 26.5000, lon: 90.5333, state: "Assam" },
  "Chirang": { lat: 26.6000, lon: 90.5000, state: "Assam" },
  "Kokrajhar": { lat: 26.4000, lon: 90.2667, state: "Assam" },
  "Baksa": { lat: 26.6900, lon: 91.4200, state: "Assam" },
  "Udalguri": { lat: 26.7500, lon: 92.1000, state: "Assam" },
  "Tamulpur": { lat: 26.6300, lon: 91.5700, state: "Assam" },
  "Bajali": { lat: 26.5100, lon: 91.1700, state: "Assam" },
  "Hojai": { lat: 26.0000, lon: 92.8667, state: "Assam" },
  "Biswanath": { lat: 26.7400, lon: 93.1500, state: "Assam" },
  "Majuli": { lat: 26.9500, lon: 94.2200, state: "Assam" },
  "South Salmara": { lat: 25.8500, lon: 89.9200, state: "Assam" },
  "Karimganj": { lat: 24.8700, lon: 92.3600, state: "Assam" },
  "Hailakandi": { lat: 24.6800, lon: 92.5600, state: "Assam" },
  "Darrang": { lat: 26.4300, lon: 92.0300, state: "Assam" },

  "East Khasi Hills": { lat: 25.5788, lon: 91.8933, state: "Meghalaya" },
  "West Khasi Hills": { lat: 25.5200, lon: 91.2700, state: "Meghalaya" },
  "South West Khasi Hills": { lat: 25.3300, lon: 91.2400, state: "Meghalaya" },
  "Ri-Bhoi": { lat: 25.9000, lon: 91.8800, state: "Meghalaya" },
  "Ri Bhoi": { lat: 25.9000, lon: 91.8800, state: "Meghalaya" },
  "West Jaintia Hills": { lat: 25.4500, lon: 92.2000, state: "Meghalaya" },
  "East Jaintia Hills": { lat: 25.3500, lon: 92.3700, state: "Meghalaya" },
  "East Garo Hills": { lat: 25.6000, lon: 90.6200, state: "Meghalaya" },
  "West Garo Hills": { lat: 25.5150, lon: 90.2200, state: "Meghalaya" },
  "South Garo Hills": { lat: 25.2000, lon: 90.6300, state: "Meghalaya" },
  "North Garo Hills": { lat: 25.9000, lon: 90.6000, state: "Meghalaya" },
  "South West Garo Hills": { lat: 25.4700, lon: 89.9300, state: "Meghalaya" },
  "Eastern West Khasi Hills": { lat: 25.5500, lon: 91.5000, state: "Meghalaya" },
});

// Key regional towns, subdivisions, and localities mapped to state and district
export const LOCALITY_GAZETTEER = Object.freeze([
  // Assam Localities
  { name: "Guwahati", state: "Assam", district: "Kamrup Metropolitan", lat: 26.1445, lon: 91.7362 },
  { name: "Dispur", state: "Assam", district: "Kamrup Metropolitan", lat: 26.1415, lon: 91.7898 },
  { name: "Boko", state: "Assam", district: "Kamrup", lat: 25.9754, lon: 91.2298 },
  { name: "Lanka", state: "Assam", district: "Hojai", lat: 25.9333, lon: 92.9500 },
  { name: "Hojai", state: "Assam", district: "Hojai", lat: 26.0000, lon: 92.8667 },
  { name: "Silchar", state: "Assam", district: "Cachar", lat: 24.8266, lon: 92.7976 },
  { name: "Tezpur", state: "Assam", district: "Sonitpur", lat: 26.6338, lon: 92.8000 },
  { name: "Jorhat", state: "Assam", district: "Jorhat", lat: 26.7509, lon: 94.2037 },
  { name: "Dibrugarh", state: "Assam", district: "Dibrugarh", lat: 27.4728, lon: 94.9120 },
  { name: "Tinsukia", state: "Assam", district: "Tinsukia", lat: 27.5000, lon: 95.3667 },
  { name: "Nagaon", state: "Assam", district: "Nagaon", lat: 26.3452, lon: 92.6839 },
  { name: "Barpeta", state: "Assam", district: "Barpeta", lat: 26.3200, lon: 91.0067 },
  { name: "Bongaigaon", state: "Assam", district: "Bongaigaon", lat: 26.5000, lon: 90.5333 },
  { name: "Kokrajhar", state: "Assam", district: "Kokrajhar", lat: 26.4000, lon: 90.2667 },
  { name: "Dhubri", state: "Assam", district: "Dhubri", lat: 26.0200, lon: 89.9800 },
  { name: "Goalpara", state: "Assam", district: "Goalpara", lat: 26.1700, lon: 90.6200 },
  { name: "Haflong", state: "Assam", district: "Dima Hasao", lat: 25.1800, lon: 93.0200 },
  { name: "Diphu", state: "Assam", district: "Karbi Anglong", lat: 25.8400, lon: 93.4300 },
  { name: "North Lakhimpur", state: "Assam", district: "Lakhimpur", lat: 27.2300, lon: 94.1000 },
  { name: "Dhemaji", state: "Assam", district: "Dhemaji", lat: 27.4800, lon: 94.5800 },
  { name: "Sivasagar", state: "Assam", district: "Sivasagar", lat: 26.9800, lon: 94.6300 },
  { name: "Golaghat", state: "Assam", district: "Golaghat", lat: 26.5200, lon: 93.9700 },
  { name: "Nalbari", state: "Assam", district: "Nalbari", lat: 26.4400, lon: 91.4400 },
  { name: "Mangaldoi", state: "Assam", district: "Darrang", lat: 26.4300, lon: 92.0300 },
  { name: "Morigaon", state: "Assam", district: "Morigaon", lat: 26.2500, lon: 92.3400 },
  { name: "Rangia", state: "Assam", district: "Kamrup", lat: 26.4700, lon: 91.6300 },
  { name: "Mirza", state: "Assam", district: "Kamrup", lat: 26.0800, lon: 91.5300 },
  { name: "Sonapur", state: "Assam", district: "Kamrup Metropolitan", lat: 26.1200, lon: 91.9700 },
  { name: "Jagiroad", state: "Assam", district: "Morigaon", lat: 26.1900, lon: 92.2100 },
  { name: "Kaziranga", state: "Assam", district: "Golaghat", lat: 26.5800, lon: 93.3500 },

  // Meghalaya Localities
  { name: "Shillong", state: "Meghalaya", district: "East Khasi Hills", lat: 25.5788, lon: 91.8933 },
  { name: "Nongpoh", state: "Meghalaya", district: "Ri-Bhoi", lat: 25.9000, lon: 91.8800 },
  { name: "Byrnihat", state: "Meghalaya", district: "Ri-Bhoi", lat: 26.0500, lon: 91.8700 },
  { name: "Cherrapunji", state: "Meghalaya", district: "East Khasi Hills", lat: 25.2800, lon: 91.7300 },
  { name: "Sohra", state: "Meghalaya", district: "East Khasi Hills", lat: 25.2800, lon: 91.7300 },
  { name: "Mawsynram", state: "Meghalaya", district: "East Khasi Hills", lat: 25.3000, lon: 91.5800 },
  { name: "Tura", state: "Meghalaya", district: "West Garo Hills", lat: 25.5150, lon: 90.2200 },
  { name: "Jowai", state: "Meghalaya", district: "West Jaintia Hills", lat: 25.4500, lon: 92.2000 },
  { name: "Khliehriat", state: "Meghalaya", district: "East Jaintia Hills", lat: 25.3500, lon: 92.3700 },
  { name: "Nongstoin", state: "Meghalaya", district: "West Khasi Hills", lat: 25.5200, lon: 91.2700 },
  { name: "Williamnagar", state: "Meghalaya", district: "East Garo Hills", lat: 25.6000, lon: 90.6200 },
  { name: "Baghmara", state: "Meghalaya", district: "South Garo Hills", lat: 25.2000, lon: 90.6300 },
  { name: "Resubelpara", state: "Meghalaya", district: "North Garo Hills", lat: 25.9000, lon: 90.6000 },
  { name: "Ampati", state: "Meghalaya", district: "South West Garo Hills", lat: 25.4700, lon: 89.9300 },
  { name: "Dawki", state: "Meghalaya", district: "West Jaintia Hills", lat: 25.1800, lon: 92.0200 },
  { name: "Umiam", state: "Meghalaya", district: "Ri-Bhoi", lat: 25.6600, lon: 91.9000 },
  { name: "Mawphlang", state: "Meghalaya", district: "East Khasi Hills", lat: 25.4500, lon: 91.7500 },
]);

// Key regional rivers in Northeast India
export const REGIONAL_RIVERS = Object.freeze([
  "Brahmaputra", "Barak", "Kopili", "Subansiri", "Jia Bharali", "Manas", "Beki",
  "Pagladiya", "Puthimari", "Dhansiri", "Burhidehing", "Kushiyara", "Surma",
  "Simsang", "Umngot", "Umiam", "Myntdu", "Ganol", "Bugi", "Dudhnoi", "Krishnai"
]);

// Key transport corridors and highways
export const REGIONAL_CORRIDORS = Object.freeze([
  { name: "NH-27", aliases: ["NH 27", "National Highway 27", "East-West Corridor"] },
  { name: "NH-6", aliases: ["NH 6", "National Highway 6", "Guwahati-Shillong Road", "GS Road"] },
  { name: "NH-37", aliases: ["NH 37", "National Highway 37", "Assam Trunk Road"] },
  { name: "NH-17", aliases: ["NH 17", "National Highway 17"] },
  { name: "NH-217", aliases: ["NH 217", "National Highway 217"] },
  { name: "Saraighat Bridge", aliases: ["Saraighat"] },
  { name: "Kolia Bhomora Bridge", aliases: ["Kolia Bhomora"] },
  { name: "Bogibeel Bridge", aliases: ["Bogibeel"] },
  { name: "Naranarayan Setu", aliases: ["Naranarayan"] },
  { name: "Dhola-Sadiya Bridge", aliases: ["Dhola-Sadiya", "Bhupen Hazarika Setu"] },
]);

// Extracts all location entities, corridors, rivers, and districts from text
export function extractLocationEntities(text) {
  if (!text) {
    return {
      placeNames: [],
      district: null,
      state: null,
      locality: null,
      river: null,
      corridor: null,
      coordinates: null,
      confidence: 0.0,
      rawLocationString: "",
    };
  }

  const foundPlaces = [];
  let resolvedState = null;
  let resolvedDistrict = null;
  let resolvedLocality = null;
  let resolvedRiver = null;
  let resolvedCorridor = null;
  let coordinates = null;

  // 1. Check Localities & Gazetteer
  for (const loc of LOCALITY_GAZETTEER) {
    const regex = new RegExp(`\\b${loc.name}\\b`, "i");
    if (regex.test(text)) {
      foundPlaces.push(loc.name);
      if (!resolvedLocality) {
        resolvedLocality = loc.name;
        resolvedDistrict = loc.district;
        resolvedState = loc.state;
        coordinates = { lat: loc.lat, lon: loc.lon };
      }
    }
  }

  // 2. Check Districts if not already resolved
  for (const dist of ASSAM_DISTRICTS) {
    const regex = new RegExp(`\\b${dist}\\b`, "i");
    if (regex.test(text)) {
      foundPlaces.push(dist);
      if (!resolvedDistrict) {
        resolvedDistrict = dist;
        resolvedState = "Assam";
        if (!coordinates && DISTRICT_CENTROIDS[dist]) {
          coordinates = { lat: DISTRICT_CENTROIDS[dist].lat, lon: DISTRICT_CENTROIDS[dist].lon };
        }
      }
    }
  }

  for (const dist of MEGHALAYA_DISTRICTS) {
    const regex = new RegExp(`\\b${dist}\\b`, "i");
    if (regex.test(text)) {
      foundPlaces.push(dist);
      if (!resolvedDistrict) {
        resolvedDistrict = dist;
        resolvedState = "Meghalaya";
        if (!coordinates && DISTRICT_CENTROIDS[dist]) {
          coordinates = { lat: DISTRICT_CENTROIDS[dist].lat, lon: DISTRICT_CENTROIDS[dist].lon };
        }
      }
    }
  }

  // 3. Check Regional Rivers
  for (const river of REGIONAL_RIVERS) {
    const regex = new RegExp(`\\b${river}\\b`, "i");
    if (regex.test(text)) {
      foundPlaces.push(`${river} River`);
      resolvedRiver = river;
    }
  }

  // 4. Check Corridors & Highways
  for (const corridor of REGIONAL_CORRIDORS) {
    for (const alias of corridor.aliases) {
      const regex = new RegExp(`\\b${alias}\\b`, "i");
      if (regex.test(text)) {
        foundPlaces.push(corridor.name);
        resolvedCorridor = corridor.name;
        break;
      }
    }
  }

  // Determine Location Confidence
  let locationConfidence = 0.2;
  if (resolvedLocality) {
    locationConfidence = 0.9; // Exact locality resolved
  } else if (resolvedDistrict) {
    locationConfidence = 0.65; // District-level resolved
  } else if (resolvedRiver || resolvedCorridor) {
    locationConfidence = 0.5; // Linear feature resolved
  } else if (foundPlaces.length > 0) {
    locationConfidence = 0.4;
  }

  const rawLocationString = [...new Set(foundPlaces)].join(", ");

  return {
    placeNames: [...new Set(foundPlaces)],
    district: resolvedDistrict,
    state: resolvedState,
    locality: resolvedLocality,
    river: resolvedRiver,
    corridor: resolvedCorridor,
    coordinates,
    confidence: locationConfidence,
    rawLocationString,
  };
}

export default {
  ASSAM_DISTRICTS,
  MEGHALAYA_DISTRICTS,
  DISTRICT_CENTROIDS,
  LOCALITY_GAZETTEER,
  REGIONAL_RIVERS,
  REGIONAL_CORRIDORS,
  extractLocationEntities,
};
