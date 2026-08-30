// Production API integration test suite for RESQ routing endpoints

import http from "http";
import app from "../../server/app.js";

const TEST_PORT = 5099;
let serverInstance = null;

// Helper to make HTTP POST requests
function postJson(urlStr, payload) {
  const url = new URL(urlStr);
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

// Helper to make HTTP GET requests
function getJson(urlStr) {
  const url = new URL(urlStr);

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

async function runTestSuite() {
  console.log("==================================================");
  console.log("RESQ PRODUCTION ROUTING API TEST SUITE");
  console.log("==================================================\n");

  // Start test server instance
  await new Promise((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // TEST 1: Health check
    console.log("TEST 1: GET /api/route/health");
    const healthRes = await getJson(`${baseUrl}/api/route/health`);
    if (healthRes.statusCode !== 200 || !healthRes.data.success) {
      throw new Error(`Health check failed with status ${healthRes.statusCode}`);
    }
    console.log("   Result: PASS (HTTP 200, Valhalla Healthy)\n");

    // TEST 2: Assam Intra-State (Guwahati Dispur -> Jalukbari)
    console.log("TEST 2: POST /api/route (Assam Intra-State: Guwahati Dispur -> Jalukbari)");
    const assamPayload = {
      origin: { lat: 26.1445, lon: 91.7898 },
      destination: { lat: 26.1550, lon: 91.6660 },
      mode: "fastest",
      vehicle: "car",
      alternatives: 2,
    };
    const assamRes = await postJson(`${baseUrl}/api/route`, assamPayload);
    if (assamRes.statusCode !== 200 || !assamRes.data.success) {
      throw new Error(`Assam route failed: ${JSON.stringify(assamRes.data)}`);
    }
    const assam = assamRes.data;
    console.log(`   Result: PASS (Distance: ${assam.route.distanceKm} km, Duration: ${assam.route.durationMinutes} mins)`);
    console.log(`   Geometry Coords: ${assam.route.geometry.length} points [lon, lat]`);
    console.log(`   Maneuvers: ${assam.route.instructions.length} steps`);
    console.log(`   Alternatives Returned: ${assam.alternatives.length}`);
    console.log(`   First Step: "${assam.route.instructions[0].instruction}"\n`);

    // TEST 3: Meghalaya Intra-State (Shillong -> Nongpoh)
    console.log("TEST 3: POST /api/route (Meghalaya Intra-State: Shillong -> Nongpoh)");
    const meghalayaPayload = {
      origin: { lat: 25.5788, lon: 91.8933 },
      destination: { lat: 25.9038, lon: 91.8805 },
      mode: "fastest",
      vehicle: "ambulance",
      alternatives: 2,
    };
    const meghalayaRes = await postJson(`${baseUrl}/api/route`, meghalayaPayload);
    if (meghalayaRes.statusCode !== 200 || !meghalayaRes.data.success) {
      throw new Error(`Meghalaya route failed: ${JSON.stringify(meghalayaRes.data)}`);
    }
    const meghalaya = meghalayaRes.data;
    console.log(`   Result: PASS (Distance: ${meghalaya.route.distanceKm} km, Duration: ${meghalaya.route.durationMinutes} mins)`);
    console.log(`   Vehicle: ${meghalaya.vehicle.type} (Costing: ${meghalaya.vehicle.costingProfile})`);
    console.log(`   Geometry Coords: ${meghalaya.route.geometry.length} points [lon, lat]\n`);

    // TEST 4: Cross-State Route (Guwahati, Assam -> Shillong, Meghalaya)
    console.log("TEST 4: POST /api/route (Cross-State: Guwahati -> Shillong)");
    const crossStatePayload = {
      origin: { lat: 26.1445, lon: 91.7898 },
      destination: { lat: 25.5788, lon: 91.8933 },
      mode: "fastest",
      vehicle: "relief_truck",
      alternatives: 2,
    };
    const crossRes = await postJson(`${baseUrl}/api/route`, crossStatePayload);
    if (crossRes.statusCode !== 200 || !crossRes.data.success) {
      throw new Error(`Cross-state route failed: ${JSON.stringify(crossRes.data)}`);
    }
    const cross = crossRes.data;
    console.log(`   Result: PASS (Distance: ${cross.route.distanceKm} km, Duration: ${cross.route.durationMinutes} mins)`);
    console.log(`   Geometry Coords: ${cross.route.geometry.length} points [lon, lat]`);
    console.log(`   Maneuvers: ${cross.route.instructions.length} steps\n`);

    // TEST 5: Invalid Coordinates (Validation Error)
    console.log("TEST 5: POST /api/route (Invalid Coordinates -> Expected 400 VALIDATION_ERROR)");
    const invalidPayload = {
      origin: { lat: "invalid", lon: 91.7898 },
      destination: { lat: 26.1550, lon: 91.6660 },
    };
    const invalidRes = await postJson(`${baseUrl}/api/route`, invalidPayload);
    if (invalidRes.statusCode !== 400 || invalidRes.data.error.code !== "VALIDATION_ERROR") {
      throw new Error(`Expected 400 VALIDATION_ERROR, got ${invalidRes.statusCode}: ${JSON.stringify(invalidRes.data)}`);
    }
    console.log(`   Result: PASS (HTTP 400, Error Code: ${invalidRes.data.error.code})\n`);

    // TEST 6: Outside Regional Coverage (Expected 422 ROUTING_OUTSIDE_COVERAGE)
    console.log("TEST 6: POST /api/route (Outside Coverage: Mumbai -> Expected 422 ROUTING_OUTSIDE_COVERAGE)");
    const outsidePayload = {
      origin: { lat: 19.0760, lon: 72.8777 },
      destination: { lat: 26.1550, lon: 91.6660 },
    };
    const outsideRes = await postJson(`${baseUrl}/api/route`, outsidePayload);
    if (outsideRes.statusCode !== 422 || outsideRes.data.error.code !== "ROUTING_OUTSIDE_COVERAGE") {
      throw new Error(`Expected 422 ROUTING_OUTSIDE_COVERAGE, got ${outsideRes.statusCode}: ${JSON.stringify(outsideRes.data)}`);
    }
    console.log(`   Result: PASS (HTTP 422, Error Code: ${outsideRes.data.error.code})\n`);

    // TEST 7: Unsupported Route Mode (Safe/Balanced -> Expected 501 MODE_NOT_IMPLEMENTED)
    console.log("TEST 7: POST /api/route (Mode: 'safe' -> Expected 501 MODE_NOT_IMPLEMENTED)");
    const safePayload = {
      origin: { lat: 26.1445, lon: 91.7898 },
      destination: { lat: 26.1550, lon: 91.6660 },
      mode: "safe",
    };
    const safeRes = await postJson(`${baseUrl}/api/route`, safePayload);
    if (safeRes.statusCode !== 501 || safeRes.data.error.code !== "MODE_NOT_IMPLEMENTED") {
      throw new Error(`Expected 501 MODE_NOT_IMPLEMENTED, got ${safeRes.statusCode}: ${JSON.stringify(safeRes.data)}`);
    }
    console.log(`   Result: PASS (HTTP 501, Error Code: ${safeRes.data.error.code})\n`);

    // TEST 8: Performance Latency Benchmark (5 repeated runs)
    console.log("TEST 8: Performance Latency Benchmark (5 consecutive runs for Cross-State Route)...");
    const latencies = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const benchRes = await postJson(`${baseUrl}/api/route`, crossStatePayload);
      const elapsed = Date.now() - t0;
      if (benchRes.statusCode === 200) {
        latencies.push(elapsed);
      }
    }
    const minLat = Math.min(...latencies);
    const maxLat = Math.max(...latencies);
    const avgLat = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    console.log(`   Completed Runs: ${latencies.length}/5`);
    console.log(`   Min Latency: ${minLat} ms`);
    console.log(`   Max Latency: ${maxLat} ms`);
    console.log(`   Avg Latency: ${avgLat} ms\n`);

    console.log("==================================================");
    console.log("ALL 8 PRODUCTION ROUTING API TESTS PASSED");
    console.log("==================================================");
    process.exit(0);
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err);
  if (serverInstance) {
    serverInstance.close();
  }
  process.exit(1);
});
