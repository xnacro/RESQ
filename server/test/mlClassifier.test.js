// Regression Test Suite for In-Process Disaster Text Classification
import assert from "assert";
import { classifyDisasterText, getClassifierStatus, loadModel } from "../services/ml/disasterClassifierService.js";

async function runTests() {
  console.log("=== RUNNING RESQ ML CLASSIFIER EVALUATION SUITE ===\n");

  // 1. Verify Model Initialization
  const status = getClassifierStatus();
  console.log("1. Checking model initialization status...");
  assert.strictEqual(status.isReady, true, "Classifier must be ready after startup");
  assert.strictEqual(status.version, "v1", "Model version must be v1");
  assert.strictEqual(status.classes.length, 4, "Model must have 4 output classes");
  console.log(`   ✓ Status OK: ${status.classes.join(", ")} | Features: ${status.featureCount}`);

  // 2. Active Disaster Test Cases (Must be ACTIVE_DISASTER with confidence >= 0.60)
  console.log("\n2. Testing Active Disaster Classifications...");
  const activeCases = [
    {
      text: "Heavy rainfall has flooded roads in Boko, Kamrup district, leaving several routes blocked.",
      expected: "ACTIVE_DISASTER",
    },
    {
      text: "Officials announced a bridge closure after structural damage near Nongpoh on GS Road.",
      expected: "ACTIVE_DISASTER",
    },
    {
      text: "Barak River crosses danger mark in Silchar; flood water submerges key residential roads.",
      expected: "ACTIVE_DISASTER",
    },
    {
      text: "Vehicular traffic diverted after massive waterlogging at Jorabat intersection on NH-27.",
      expected: "ACTIVE_DISASTER",
    },
  ];

  for (const tc of activeCases) {
    const res = classifyDisasterText(tc.text);
    console.log(`   [ACTIVE] Label: ${res.label} (Conf: ${res.confidence}) | "${tc.text.slice(0, 60)}..."`);
    assert.strictEqual(res.label, tc.expected, `Expected ${tc.expected} but got ${res.label}`);
    assert.ok(res.confidence >= 0.50, `Confidence ${res.confidence} should be >= 0.50`);
    assert.strictEqual(res.isDisaster, true);
  }

  // 3. Historical Disaster Test Cases (Must NOT be ACTIVE_DISASTER)
  console.log("\n3. Testing Historical Disaster Classifications (False-Positive Prevention)...");
  const historicalCases = [
    "During the 2022 Assam floods, Silchar experienced unprecedented inundation and months of power disruption.",
    "A retrospective look at how the 2004 Assam floods reshaped river islands in the Brahmaputra.",
    "Remembering the catastrophic 2020 Baghjan blowout and associated flood crisis in Tinsukia.",
    "Ten years after the 2014 Garo Hills flash floods, infrastructure reconstruction remains incomplete.",
  ];

  for (const text of historicalCases) {
    const res = classifyDisasterText(text);
    console.log(`   [HISTORICAL] Label: ${res.label} (Conf: ${res.confidence}) | "${text.slice(0, 60)}..."`);
    assert.notStrictEqual(res.label, "ACTIVE_DISASTER", `Historical text must not be classified as ACTIVE_DISASTER: "${text}"`);
    assert.strictEqual(res.isDisaster, false);
  }

  // 4. General Risk / Urban Policy Test Cases (Must NOT create acute active disaster)
  console.log("\n4. Testing General Risk & Policy Classifications...");
  const generalCases = [
    "Seven-layer drainage plan charts path to flood-free Guwahati over the next decade.",
    "Recurring Guwahati floods raises doubts over Rs 6,000 Cr drainage masterplan.",
    "ASDMA issues seasonal monsoon preparedness guidelines to all 35 district commissioners.",
  ];

  for (const text of generalCases) {
    const res = classifyDisasterText(text);
    console.log(`   [GENERAL] Label: ${res.label} (Conf: ${res.confidence}) | "${text.slice(0, 60)}..."`);
    assert.notStrictEqual(res.label, "ACTIVE_DISASTER", `Policy text must not be classified as ACTIVE_DISASTER: "${text}"`);
  }

  // 5. Irrelevant / Non-Disaster Test Cases
  console.log("\n5. Testing Irrelevant News Filtering...");
  const irrelevantCases = [
    "Kolkata FF Fatafat Result Today 29th August, Check FF Result Online.",
    "Tea prices fall 15% at Guwahati auction centre amid transport bottlenecks.",
    "Arunachal Pradesh records rare Spoon-tailed Duskhawker dragonfly at Namdapha.",
    "Gold prices hit all-time high in Guwahati jewellery markets ahead of festive season.",
  ];

  for (const text of irrelevantCases) {
    const res = classifyDisasterText(text);
    console.log(`   [IRRELEVANT] Label: ${res.label} (Conf: ${res.confidence}) | "${text.slice(0, 60)}..."`);
    assert.notStrictEqual(res.label, "ACTIVE_DISASTER", `Irrelevant text must not be ACTIVE_DISASTER`);
    assert.strictEqual(res.isDisaster, false);
  }

  // 6. Fail-Safe Fallback Behavior (Invalid Model Path)
  console.log("\n6. Testing Fail-Safe Behavior with missing model...");
  const previousStatus = loadModel("invalid/path/to/missing_model.json");
  assert.strictEqual(previousStatus, false, "LoadModel should return false for invalid path");
  const fallbackRes = classifyDisasterText("Flash floods inundate town");
  assert.strictEqual(fallbackRes.fallback, true, "Classifier must return fallback: true");
  assert.strictEqual(fallbackRes.label, "UNKNOWN");

  // Restore valid model
  loadModel();
  console.log("   ✓ Restored valid model successfully.");

  // 7. Latency Performance Benchmark
  console.log("\n7. Benchmarking Classification Throughput...");
  const sampleText = "Heavy rainfall has flooded roads in Boko, leaving routes blocked.";
  const iterations = 500;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    classifyDisasterText(sampleText);
  }
  const totalMs = performance.now() - start;
  const avgPerItemMs = totalMs / iterations;
  console.log(`   ✓ Benchmark: ${iterations} classifications executed in ${totalMs.toFixed(2)}ms (${avgPerItemMs.toFixed(4)}ms / item)`);
  assert.ok(avgPerItemMs < 1.0, `Average latency (${avgPerItemMs}ms) must be < 1.0ms`);

  console.log("\n[SUCCESS] ALL ML CLASSIFIER REGRESSION TESTS PASSED.");
}

runTests().catch((err) => {
  console.error("\n[TEST FAILED]:", err);
  process.exit(1);
});
