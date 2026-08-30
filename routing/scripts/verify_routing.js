// Routing engine verification script for RESQ Valhalla Regional instance
const http = require("http");

const VALHALLA_URL = process.env.VALHALLA_URL || "http://127.0.0.1:8002";

async function postJson(endpoint, payload) {
  const url = new URL(endpoint, VALHALLA_URL);
  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body, error: e.message });
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getJson(endpoint) {
  const url = new URL(endpoint, VALHALLA_URL);

  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body, error: e.message });
        }
      });
    }).on("error", reject);
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("RESQ VALHALLA REGIONAL ENGINE VERIFICATION");
  console.log(`Endpoint: ${VALHALLA_URL}`);
  console.log("==================================================\n");

  // Health check
  console.log("1. Checking Valhalla Health /status...");
  const statusRes = await getJson("/status");
  if (statusRes.statusCode !== 200) {
    console.error("FAILED: /status returned code", statusRes.statusCode, statusRes);
    process.exit(1);
  }
  console.log("   Status: OK (HTTP 200)");
  console.log(`   Version: ${statusRes.data.version}`);
  console.log(`   Tileset Last Modified: ${new Date(statusRes.data.tileset_last_modified * 1000).toISOString()}`);
  console.log(`   Actions: ${statusRes.data.available_actions.join(", ")}\n`);

  // Test 1: Assam Intra-State (Guwahati Dispur -> Guwahati Jalukbari)
  console.log("2. Testing Assam Intra-State Route (Guwahati Dispur -> Jalukbari)...");
  const assamPayload = {
    locations: [
      { lat: 26.1445, lon: 91.7898, type: "break" },
      { lat: 26.1550, lon: 91.6660, type: "break" },
    ],
    costing: "auto",
    directions_options: {
      units: "kilometers",
      language: "en-US",
    },
  };

  const assamRes = await postJson("/route", assamPayload);
  if (assamRes.statusCode !== 200 || !assamRes.data.trip) {
    console.error("FAILED: Assam route failed:", assamRes);
    process.exit(1);
  }
  const assamTrip = assamRes.data.trip;
  const assamLeg = assamTrip.legs[0];
  console.log("   Route Exists: YES");
  console.log(`   Distance: ${assamTrip.summary.length} km`);
  console.log(`   Duration: ${assamTrip.summary.time} seconds (~${(assamTrip.summary.time / 60).toFixed(1)} mins)`);
  console.log(`   Geometry Shape Length: ${assamLeg.shape.length} chars (Polyline6 encoded)`);
  console.log(`   Maneuvers: ${assamLeg.maneuvers.length} instruction steps`);
  console.log(`   First instruction: "${assamLeg.maneuvers[0].instruction}"`);
  console.log(`   Last instruction: "${assamLeg.maneuvers[assamLeg.maneuvers.length - 1].instruction}"\n`);

  // Test 2: Meghalaya Intra-State (Shillong -> Nongpoh)
  console.log("3. Testing Meghalaya Intra-State Route (Shillong -> Nongpoh)...");
  const meghalayaPayload = {
    locations: [
      { lat: 25.5788, lon: 91.8933, type: "break" },
      { lat: 25.9038, lon: 91.8805, type: "break" },
    ],
    costing: "auto",
    directions_options: {
      units: "kilometers",
      language: "en-US",
    },
  };

  const meghalayaRes = await postJson("/route", meghalayaPayload);
  if (meghalayaRes.statusCode !== 200 || !meghalayaRes.data.trip) {
    console.error("FAILED: Meghalaya route failed:", meghalayaRes);
    process.exit(1);
  }
  const meghalayaTrip = meghalayaRes.data.trip;
  const meghalayaLeg = meghalayaTrip.legs[0];
  console.log("   Route Exists: YES");
  console.log(`   Distance: ${meghalayaTrip.summary.length} km`);
  console.log(`   Duration: ${meghalayaTrip.summary.time} seconds (~${(meghalayaTrip.summary.time / 60).toFixed(1)} mins)`);
  console.log(`   Geometry Shape Length: ${meghalayaLeg.shape.length} chars (Polyline6 encoded)`);
  console.log(`   Maneuvers: ${meghalayaLeg.maneuvers.length} instruction steps`);
  console.log(`   First instruction: "${meghalayaLeg.maneuvers[0].instruction}"`);
  console.log(`   Last instruction: "${meghalayaLeg.maneuvers[meghalayaLeg.maneuvers.length - 1].instruction}"\n`);

  // Test 3: Cross-State Route (Guwahati, Assam -> Shillong, Meghalaya)
  console.log("4. Testing Cross-State Route (Guwahati, Assam -> Shillong, Meghalaya)...");
  const crossStatePayload = {
    locations: [
      { lat: 26.1445, lon: 91.7898, type: "break" },
      { lat: 25.5788, lon: 91.8933, type: "break" },
    ],
    costing: "auto",
    directions_options: {
      units: "kilometers",
      language: "en-US",
    },
  };

  const crossStateRes = await postJson("/route", crossStatePayload);
  if (crossStateRes.statusCode !== 200 || !crossStateRes.data.trip) {
    console.error("FAILED: Cross-State route failed:", crossStateRes);
    process.exit(1);
  }
  const crossTrip = crossStateRes.data.trip;
  const crossLeg = crossTrip.legs[0];
  console.log("   Route Exists: YES (Cross-State Connection Validated)");
  console.log(`   Distance: ${crossTrip.summary.length} km`);
  console.log(`   Duration: ${crossTrip.summary.time} seconds (~${(crossTrip.summary.time / 60).toFixed(1)} mins)`);
  console.log(`   Geometry Shape Length: ${crossLeg.shape.length} chars (Polyline6 encoded)`);
  console.log(`   Maneuvers: ${crossLeg.maneuvers.length} instruction steps`);
  console.log(`   First instruction: "${crossLeg.maneuvers[0].instruction}"`);
  console.log(`   Last instruction: "${crossLeg.maneuvers[crossLeg.maneuvers.length - 1].instruction}"\n`);

  console.log("==================================================");
  console.log("ALL REGIONAL ROUTING TESTS PASSED SUCCESSFULLY");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
