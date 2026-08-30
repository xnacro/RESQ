// Comprehensive Dynamic Risk Scenario Testing Script
// Evaluates Geocoding Ambiguity, False Positive Control, State Boundary Safety, and End-to-End Pipeline
import { extractDisasterEvent } from "../../nlp/index.js";
import { resolveCoordinates, findAffectedGridCells } from "../services/news/newsGeolocationService.js";
import { extractLocationEntities } from "../../nlp/location/nerLocationExtractor.js";

async function runScenarioTests() {
  console.log("================================================================================");
  console.log("             RESQ DYNAMIC RISK SCENARIO & BEHAVIORAL AUDIT                      ");
  console.log("================================================================================");

  // Scenario 1: False Positive & Temporal Noise Control
  console.log("\n--- TEST 1: FALSE POSITIVE & TEMPORAL CONTROL ---");
  const testTexts = [
    {
      name: "CURRENT_CRITICAL_INCIDENT",
      text: "Heavy flooding has washed away a bridge near Boko in Assam, blocking relief traffic.",
    },
    {
      name: "HISTORICAL_RETROSPECTIVE",
      text: "During the 2022 floods in Silchar, major bridges were submerged and relief camps were set up.",
    },
    {
      name: "GENERIC_VULNERABILITY_OPINION",
      text: "Assam and Meghalaya remain inherently vulnerable to seasonal monsoon floods and river erosion.",
    },
    {
      name: "UNRELATED_TRAFFIC_SPORTS_NOISE",
      text: "IPL match traffic congestion in Guwahati causes severe delays during peak evening hours.",
    },
  ];

  for (const item of testTexts) {
    const res = extractDisasterEvent(item.text, "", "", {});
    console.log(`\nScenario: [${item.name}]`);
    console.log(`  Text: "${item.text}"`);
    console.log(`  ↳ isDisasterEvent: ${res.isDisasterEvent}`);
    console.log(`  ↳ Hazard: ${res.hazardType} | Event: ${res.eventType}`);
    console.log(`  ↳ Severity: ${res.severity} | Confidence: ${res.confidence}`);
    console.log(`  ↳ Historical: ${res.temporal.isHistorical} | RoadBlocked: ${res.impact.roadBlocked} | BridgeClosed: ${res.impact.bridgeClosed}`);
  }

  // Scenario 2: Geographic Ambiguity & Entity Extraction
  console.log("\n--- TEST 2: GEOGRAPHIC AMBIGUITY & RESOLUTION ---");
  const geoPhrases = [
    "near Guwahati",
    "Kamrup district",
    "on the Brahmaputra",
    "Assam-Meghalaya border",
    "near Nongpoh",
  ];

  for (const phrase of geoPhrases) {
    const loc = extractLocationEntities(phrase);
    const coords = await resolveCoordinates(loc);
    console.log(`\nPhrase: "${phrase}"`);
    console.log(`  ↳ Extracted Loc: District="${loc.district}", State="${loc.state}", Locality="${loc.locality}", River="${loc.river}", Corridor="${loc.corridor}"`);
    console.log(`  ↳ Resolved Coords: Lat=${coords?.lat}, Lon=${coords?.lon}, State=${coords?.state}, Confidence=${loc.confidence}`);
  }

  // Scenario 3: State Boundary & Spatial Grid Attribution
  console.log("\n--- TEST 3: STATE BOUNDARY ATTRIBUTION (Nongpoh vs Boko) ---");
  const boundaryCases = [
    { name: "Nongpoh (Meghalaya)", lat: 25.9000, lon: 91.8800, state: "Meghalaya" },
    { name: "Boko (Assam)", lat: 25.9754, lon: 91.2298, state: "Assam" },
  ];

  for (const b of boundaryCases) {
    const grids = await findAffectedGridCells(b.lat, b.lon, 2000, b.state);
    console.log(`\nLocation: ${b.name}`);
    console.log(`  ↳ Target State Table: grid_500m.${b.state.toLowerCase()}`);
    console.log(`  ↳ Matched 500m Grids: ${grids.length} cells`);
    if (grids.length > 0) {
      console.log(`  ↳ Sample Grids: ${grids.slice(0, 3).map((g) => `${g.grid_id} (${g.distance_m}m)`).join(", ")}`);
    }
  }

  process.exit(0);
}

runScenarioTests().catch((err) => {
  console.error("Scenario tests failed:", err);
  process.exit(1);
});
