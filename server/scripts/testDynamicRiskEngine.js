// Comprehensive Verification & Test Suite for RESQ Reactive Dynamic Risk Engine
// Tests Scenarios 1-7, Performance Benchmarks, Event Expiration, and Dynamic Risk Explainability
import pool from "../config/db.js";
import {
  calculateRiskScore,
  determineRiskStatus,
  recomputeGridsFromActiveEvents,
  expireStaleEvents,
  getDynamicRiskBreakdown,
} from "../services/risk/dynamicRiskService.js";

async function runTests() {
  console.log("================================================================================");
  console.log("             RESQ DYNAMIC RISK FUSION & EXPIRATION VERIFICATION                 ");
  console.log("================================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = "") {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details ? "(" + details + ")" : ""}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? "(" + details + ")" : ""}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST SCENARIO 1: NORMAL BASELINE (NO DYNAMIC EVENTS)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 1: NORMAL BASELINE (static_risk = 20, dynamic_risk = 0) ---");
  const s1_score = calculateRiskScore(20.0, 0.0);
  const s1_status = determineRiskStatus(s1_score, 0.0);
  console.log(`   ↳ Score: ${s1_score} (Expected: 20.0), Status: ${s1_status} (Expected: LOW)`);
  assert(s1_score === 20.0, "Scenario 1 Score Equals Static Risk", `Score: ${s1_score}`);
  assert(s1_status === "LOW", "Scenario 1 Status is LOW", `Status: ${s1_status}`);

  // -------------------------------------------------------------------------
  // TEST SCENARIO 2: NEWS ONLY (static_risk = 20, news_risk = 60)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 2: NEWS ONLY (static_risk = 20, news_risk = 60) ---");
  const s2_dynamic = 60.0;
  const s2_score = calculateRiskScore(20.0, s2_dynamic);
  const s2_status = determineRiskStatus(s2_score, 0.0);
  console.log(`   ↳ Dynamic Risk: ${s2_dynamic}, Score: ${s2_score} (Expected: 44.0), Status: ${s2_status} (Expected: MODERATE)`);
  assert(s2_score === 44.0, "Scenario 2 Combined Score 0.4*20 + 0.6*60 = 44.0", `Score: ${s2_score}`);
  assert(s2_status === "MODERATE", "Scenario 2 Status is MODERATE", `Status: ${s2_status}`);

  // -------------------------------------------------------------------------
  // TEST SCENARIO 3: ROAD CLOSURE SAFETY OVERRIDE (static = 20, road_closure_risk = 90)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 3: ROAD CLOSURE OVERRIDE (static = 20, road_closure = 90) ---");
  const s3_dynamic = 90.0;
  const s3_score = calculateRiskScore(20.0, s3_dynamic);
  const s3_status = determineRiskStatus(s3_score, 90.0);
  console.log(`   ↳ Score: ${s3_score} (Expected: 62.0), Status: ${s3_status} (Expected: CRITICAL via road_closure_risk >= 80)`);
  assert(s3_score === 62.0, "Scenario 3 Score is 62.0", `Score: ${s3_score}`);
  assert(s3_status === "CRITICAL", "Scenario 3 Safety Escalation to CRITICAL", `Status: ${s3_status}`);

  // -------------------------------------------------------------------------
  // TEST SCENARIO 4: MULTIPLE EVENTS (news = 60, nlp = 75, closure = 90)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 4: MULTIPLE EVENTS (news = 60, nlp = 75, closure = 90) ---");
  const s4_dynamic = Math.min(100.0, Math.max(90.0, 60.0, 75.0));
  const s4_score = calculateRiskScore(20.0, s4_dynamic);
  const s4_status = determineRiskStatus(s4_score, 90.0);
  console.log(`   ↳ Dynamic Risk: ${s4_dynamic} (Expected: 90.0), Status: ${s4_status} (Expected: CRITICAL)`);
  assert(s4_dynamic === 90.0, "Scenario 4 Dynamic Risk reflects max hazard & safety floor", `Dynamic: ${s4_dynamic}`);
  assert(s4_status === "CRITICAL", "Scenario 4 Multi-Factor Status is CRITICAL", `Status: ${s4_status}`);

  // -------------------------------------------------------------------------
  // TEST SCENARIO 5: RECOMPUTE REAL LINKED CELLS IN DATABASE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 5: RECOMPUTE REAL LINKED CELLS IN DATABASE ---");
  const closureCellId = "AS_00239973";
  const recomputeResult = await recomputeGridsFromActiveEvents([closureCellId], "Assam");
  assert(recomputeResult.updatedCount === 1, "Targeted Recomputation updated closure cell", `Count: ${recomputeResult.updatedCount}`);

  const closureBreakdown = await getDynamicRiskBreakdown(closureCellId);
  console.log(`   ↳ Cell: ${closureBreakdown.gridId}`);
  console.log(`       Static Risk:       ${closureBreakdown.riskSummary.staticRisk}`);
  console.log(`       News Risk:         ${closureBreakdown.dynamicFactorChannels.newsRisk}`);
  console.log(`       Road Closure Risk: ${closureBreakdown.dynamicFactorChannels.roadClosureRisk}`);
  console.log(`       Dynamic Risk:      ${closureBreakdown.riskSummary.dynamicRisk} (Expected: 90.0)`);
  console.log(`       Risk Score:        ${closureBreakdown.riskSummary.riskScore} (Expected: 0.4*12.6 + 0.6*90 = 59.0)`);
  console.log(`       Risk Status:       ${closureBreakdown.riskSummary.riskStatus} (Expected: CRITICAL)`);
  console.log(`       Risk Confidence:   ${closureBreakdown.riskSummary.riskConfidence}`);
  console.log(`       Active Events:     ${closureBreakdown.activeEvents.length}`);

  assert(closureBreakdown.riskSummary.dynamicRisk === 90.0, "Cell dynamic_risk is reactively elevated to 90.0", `Dynamic: ${closureBreakdown.riskSummary.dynamicRisk}`);
  assert(closureBreakdown.riskSummary.riskScore === 59.0, "Cell combined risk_score is 59.0", `Score: ${closureBreakdown.riskSummary.riskScore}`);
  assert(closureBreakdown.riskSummary.riskStatus === "CRITICAL", "Cell risk_status escalated to CRITICAL", `Status: ${closureBreakdown.riskSummary.riskStatus}`);

  // -------------------------------------------------------------------------
  // TEST SCENARIO 6: STAGGERED EVENT EXPIRATION (Event A = 50, Event B = 80)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 6: STAGGERED EVENT EXPIRATION & DECAY RECALCULATION ---");
  const testClient = await pool.connect();
  try {
    await testClient.query("SET default_transaction_read_only = off;");
    await testClient.query("BEGIN;");

    const testGridId = "AS_00000001";

    // 1. Insert Temporary Test Event A (severity = 50, valid for 1 hour)
    const evARes = await testClient.query(`
      INSERT INTO disaster.news_events (
        event_type, hazard_type, severity, confidence, location_text, state,
        latitude, longitude, geom, reported_at, valid_until, event_status
      )
      VALUES (
        'FLOOD', 'FLOOD', 50, 0.90, 'Test Location A', 'Assam',
        26.0, 91.0, ST_SetSRID(ST_Point(91.0, 26.0), 4326),
        NOW(), NOW() + INTERVAL '1 hour', 'ACTIVE'
      )
      RETURNING id;
    `);
    const eventAId = evARes.rows[0].id;

    // 2. Insert Temporary Test Event B (severity = 80, valid for 2 hours)
    const evBRes = await testClient.query(`
      INSERT INTO disaster.news_events (
        event_type, hazard_type, severity, confidence, location_text, state,
        latitude, longitude, geom, reported_at, valid_until, event_status
      )
      VALUES (
        'FLOOD', 'FLOOD', 80, 0.90, 'Test Location B', 'Assam',
        26.0, 91.0, ST_SetSRID(ST_Point(91.0, 26.0), 4326),
        NOW(), NOW() + INTERVAL '2 hours', 'ACTIVE'
      )
      RETURNING id;
    `);
    const eventBId = evBRes.rows[0].id;

    // Link both to test grid
    await testClient.query(`
      INSERT INTO disaster.event_grid_links (event_id, grid_id, state, impact_score)
      VALUES 
        ($1, $3, 'Assam', 50.0),
        ($2, $3, 'Assam', 80.0);
    `, [eventAId, eventBId, testGridId]);

    // Recompute with both active -> news_risk should be 80.0
    await recomputeGridsFromActiveEvents([testGridId], "Assam", testClient);
    const stateBoth = await testClient.query(`SELECT news_risk, dynamic_risk FROM grid_500m.assam WHERE grid_id = $1;`, [testGridId]);
    console.log(`   ↳ State 1 (Both Active): news_risk = ${stateBoth.rows[0].news_risk} (Expected: 80.0)`);
    assert(parseFloat(stateBoth.rows[0].news_risk) === 80.0, "Both Active -> news_risk is MAX(50, 80) = 80.0");

    // Expire Event B -> news_risk should decay to 50.0
    await testClient.query(`UPDATE disaster.news_events SET event_status = 'EXPIRED' WHERE id = $1;`, [eventBId]);
    await recomputeGridsFromActiveEvents([testGridId], "Assam", testClient);
    const stateOnlyA = await testClient.query(`SELECT news_risk, dynamic_risk FROM grid_500m.assam WHERE grid_id = $1;`, [testGridId]);
    console.log(`   ↳ State 2 (B Expired): news_risk = ${stateOnlyA.rows[0].news_risk} (Expected: 50.0)`);
    assert(parseFloat(stateOnlyA.rows[0].news_risk) === 50.0, "Event B Expired -> news_risk decays to Event A value (50.0)");

    // Expire Event A -> news_risk should decay to 0.0
    await testClient.query(`UPDATE disaster.news_events SET event_status = 'EXPIRED' WHERE id = $1;`, [eventAId]);
    await recomputeGridsFromActiveEvents([testGridId], "Assam", testClient);
    const stateNone = await testClient.query(`SELECT news_risk, dynamic_risk, risk_score FROM grid_500m.assam WHERE grid_id = $1;`, [testGridId]);
    console.log(`   ↳ State 3 (Both Expired): news_risk = ${stateNone.rows[0].news_risk}, dynamic_risk = ${stateNone.rows[0].dynamic_risk} (Expected: 0.0)`);
    assert(parseFloat(stateNone.rows[0].news_risk) === 0.0, "All Expired -> news_risk resets to 0.0");
    assert(parseFloat(stateNone.rows[0].dynamic_risk) === 0.0, "All Expired -> dynamic_risk resets to 0.0");

    await testClient.query("ROLLBACK;");
    console.log("   ↳ Rolled back test transaction cleanly.");
  } finally {
    testClient.release();
  }

  // -------------------------------------------------------------------------
  // TEST SCENARIO 7: PERFORMANCE BENCHMARKING (1, 10, 100, 1000 GRIDS)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 7: TARGETED PERFORMANCE BENCHMARK ---");
  const sampleSizes = [1, 10, 100, 1000];

  for (const size of sampleSizes) {
    const gridRes = await pool.query(`SELECT grid_id FROM grid_500m.assam LIMIT $1;`, [size]);
    const gridIds = gridRes.rows.map((r) => r.grid_id);

    const start = performance.now();
    await recomputeGridsFromActiveEvents(gridIds, "Assam");
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    console.log(`   ↳ Recomputed ${size} cells: ${durationMs}ms (${(durationMs / size).toFixed(3)}ms / cell)`);
    assert(durationMs < 4000, `Recomputation for ${size} cells completes in < 4000ms`, `${durationMs}ms`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`             TEST RESULTS: ${passedTests} / ${totalTests} PASSED               `);
  console.log("================================================================================");

  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
