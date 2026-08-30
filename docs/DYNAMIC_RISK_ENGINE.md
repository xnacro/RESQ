# RESQ — Reactive Dynamic Risk Engine & Multi-Factor Fusion

**Project**: RESQ (Disaster-Aware Relief Routing System for Assam & Meghalaya)  
**Module**: Reactive Dynamic Risk Fusion & Event Expiration Engine  
**Version**: 1.0.0 (Phase 1 Implemented)  
**Date**: August 30, 2026  

---

## 1. Architectural Overview

The **RESQ Reactive Dynamic Risk Engine** solves the fundamental challenge of fusing long-term static geographic baselines with volatile, real-time multi-source disaster evidence across **408,986 500m × 500m grid cells** (Assam: 317,842 cells, Meghalaya: 91,144 cells).

```
UNSTRUCTURED / SENSOR EVIDENCE (RSS News, Satellite, Gauge, Sensor)
                                  │
                                  ▼
                STRUCTURED DISASTER EVENT (NLP / Parser)
                                  │
                                  ▼
           SEVERITY (0-100) + CONFIDENCE (0.0-1.0) CALIBRATION
                                  │
                                  ▼
            SPATIAL BUFFER & DISTANCE DECAY ATTRIBUTION
                                  │
                                  ▼
          TARGETED 500M CELL RECOMPUTATION (Only Affected Cells)
    ┌─────────────────────────────────────────────────────────────┐
    │ 1. Dynamic Factor Channels (news, nlp, road_closure, etc.)  │
    │ 2. Dynamic Risk Aggregation with Safety Floor Escalation    │
    │ 3. Static-Dynamic Fusion: risk_score = 0.4*Static + 0.6*Dyn │
    │ 4. Risk Confidence Blending (Static Baseline + Active Ev)   │
    │ 5. Operational Status Escalation (CRITICAL / HIGH / MOD)    │
    └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                EXPLAINABLE DECISION & RELIEF ROUTING
```

---

## 2. Dynamic Factor Channels & Semantics

Each 500m grid cell maintains independent factor channels representing specific evidentiary streams:

| Factor Column | Data Type | Semantics & Evidence Stream | Current Status |
|---|---|---|---|
| `news_risk` | `DOUBLE (0-100)` | Corroborated incident intensity from verified media feeds | **OPERATIONAL** |
| `nlp_event_risk` | `DOUBLE (0-100)` | Structured NLP disaster event extraction intensity | **OPERATIONAL** |
| `road_closure_risk` | `DOUBLE (0-100)` | Transport corridor disruption (90 = closed/blocked, 75 = damaged) | **OPERATIONAL** |
| `rainfall_risk` | `DOUBLE (0-100)` | 24h/72h rainfall accumulation from IMD / GPM gridded gauges | Planned (Phase 4) |
| `flood_event_risk` | `DOUBLE (0-100)` | Live satellite flood inundation polygons | Planned (Phase 4) |
| `earthquake_event_risk`| `DOUBLE (0-100)`| NCS / USGS instrumental shake maps | Planned (Phase 4) |
| `landslide_event_risk` | `DOUBLE (0-100)`| GSI rainfall-triggered landslide hazard alerts | Planned (Phase 4) |
| `citizen_report_risk` | `DOUBLE (0-100)` | Crowdsourced field reports with clustering | Planned (Phase 5) |

---

## 3. Mathematical Formulations

### 3.1 Distance-Decayed Event Impact

For an active disaster event $e$ located at $(x_e, y_e)$ with severity $S \in [0, 100]$, confidence $C \in [0.0, 1.0]$, and buffer radius $R_b$ ($2,500\text{m}$ for roads, $1,500\text{m}$ for point hazards):

$$\text{Decay}(d) = \max\left(0.20,\, 1.0 - \frac{d}{R_b}\right)$$

$$\text{Impact Score } I_e(d) = \text{round}\Big(S \times C \times \text{Decay}(d),\, 1\Big)$$

### 3.2 Dynamic Risk Aggregation Formulation

The cell's aggregated `dynamic_risk` is computed reactively strictly from **currently active events** ($T_{\text{valid}} > T_{\text{now}}$ and $\text{status} = \text{'ACTIVE'}$):

$$\text{dynamic\_risk} = \min\left(100.0,\, \max\Big(F_{\text{closure\_escalation}},\, F_{\text{news}},\, F_{\text{nlp}},\, F_{\text{rain}},\, F_{\text{flood}},\, F_{\text{quake}},\, F_{\text{slide}},\, F_{\text{citizen}}\Big)\right)$$

#### Safety Escalation Override Rule:
$$\text{If } F_{\text{road\_closure}} \ge 80.0 \implies \text{dynamic\_risk} = \max(\text{dynamic\_risk},\, 90.0)$$

*Rationale*: A confirmed road blockage or bridge failure is an absolute operational barrier. It must never be diluted or averaged down by low static or weather baselines.

### 3.3 Composite Risk Score Fusion

$$\text{risk\_score} = \begin{cases} \text{static\_risk}, & \text{if } \text{dynamic\_risk} \le 0 \\ \text{round}\Big(0.40 \times \text{static\_risk} + 0.60 \times \text{dynamic\_risk},\, 1\Big), & \text{if } \text{dynamic\_risk} > 0 \end{cases}$$

### 3.4 Dynamic Confidence Blending

$$\text{risk\_confidence} = \begin{cases} 0.95, & \text{if } \text{dynamic\_risk} \le 0 \\ \text{round}\Big(0.40 \times 0.95 + 0.60 \times \max(C_{\text{active\_events}}),\, 2\Big), & \text{if } \text{dynamic\_risk} > 0 \end{cases}$$

### 3.5 Risk Status Classification

$$\text{risk\_status} = \begin{cases} \text{'CRITICAL'}, & \text{if } F_{\text{road\_closure}} \ge 80.0 \lor \text{risk\_score} \ge 70.0 \\ \text{'HIGH'}, & \text{if } \text{risk\_score} \ge 45.0 \\ \text{'MODERATE'}, & \text{if } \text{risk\_score} \ge 25.0 \\ \text{'LOW'}, & \text{otherwise} \end{cases}$$

---

## 4. Staggered Event Expiration & Decay Lifecycle

Events undergo automatic temporal decay without accumulating permanent stale risk:

```
ACTIVE EVENT (Valid Until T_now + 48h)
                │
                ▼
T_now >= Valid_Until
                │
                ▼
event_status = 'EXPIRED' (disaster.news_events)
                │
                ▼
Recompute Linked Grid Cells ONLY from Remaining ACTIVE Events
                │
                ├── If other active events exist ──► Factors decay to remaining event maximums
                │
                └── If 0 active events remain   ──► Factors reset to 0.0, risk_score = static_risk
```

### Protected Structural Events
Events of type `BRIDGE_CLOSURE`, `BRIDGE_WASHOUT`, `BRIDGE_COLLAPSE`, and `ROAD_COLLAPSE` are protected from premature expiration. They remain active until explicitly marked `RESOLVED` or after an extended safety window ($> 120\text{h}$).

---

## 5. API Reference & Dynamic Risk Explainability

### `GET /api/risk/grid/:gridId`

Retrieves a transparent, explainable breakdown of all static factors, dynamic channels, combined scores, and active linked events for any 500m grid cell.

#### Sample Response (`GET /api/risk/grid/AS_00210744`):
```json
{
  "success": true,
  "data": {
    "gridId": "AS_00210744",
    "state": "Assam",
    "center": {
      "lat": 26.14405,
      "lon": 91.73699
    },
    "riskSummary": {
      "staticRisk": 26.2,
      "dynamicRisk": 90.0,
      "riskScore": 64.5,
      "riskStatus": "CRITICAL",
      "riskConfidence": 0.97,
      "lastDynamicUpdate": "2026-08-30T01:33:54.270Z"
    },
    "dynamicFactorChannels": {
      "newsRisk": 80.8,
      "nlpEventRisk": 80.8,
      "roadClosureRisk": 90.0,
      "rainfallRisk": 0.0,
      "floodEventRisk": 0.0,
      "earthquakeEventRisk": 0.0,
      "landslideEventRisk": 0.0,
      "citizenReportRisk": 0.0
    },
    "staticFactors": {
      "elevationMean": 61.6,
      "slopeMean": 1.3,
      "distanceToRiver": 38409.3,
      "waterbodyPercentage": 2.4,
      "floodSusceptibility": 0.0,
      "landslideSusceptibility": 0.0,
      "seismicRisk": 100.0,
      "populationDensity": 2790.0,
      "infrastructureExposure": 95.0
    },
    "activeEvents": [
      {
        "event_id": "2",
        "event_type": "BRIDGE_CLOSURE",
        "hazard_type": "OTHER_HAZARD",
        "severity": 85,
        "confidence": 0.95,
        "impact_score": 80.8,
        "location_text": "Guwahati, Shillong, Nongpoh, Ri-Bhoi",
        "bridge_closed": true,
        "event_status": "ACTIVE",
        "news_title": "Officials announced a bridge closure after structural damage near Nongpoh.",
        "source_name": "The Shillong Times"
      }
    ]
  }
}
```

---

## 6. Verification & Test Suite Results

The comprehensive test suite [server/scripts/testDynamicRiskEngine.js](file:///f:/RESQ/server/scripts/testDynamicRiskEngine.js) validates all 7 operational scenarios and performance benchmarks with **20/20 tests passing (100%)**:

```
================================================================================
             RESQ DYNAMIC RISK FUSION & EXPIRATION VERIFICATION                 
================================================================================
✅ [PASS] Scenario 1 Score Equals Static Risk (Score: 20.0)
✅ [PASS] Scenario 1 Status is LOW (Status: LOW)
✅ [PASS] Scenario 2 Combined Score 0.4*20 + 0.6*60 = 44.0 (Score: 44.0)
✅ [PASS] Scenario 2 Status is MODERATE (Status: MODERATE)
✅ [PASS] Scenario 3 Score is 62.0 (Score: 62.0)
✅ [PASS] Scenario 3 Safety Escalation to CRITICAL (Status: CRITICAL)
✅ [PASS] Scenario 4 Dynamic Risk reflects max hazard & safety floor (Dynamic: 90.0)
✅ [PASS] Scenario 4 Multi-Factor Status is CRITICAL (Status: CRITICAL)
✅ [PASS] Targeted Recomputation updated closure cell (Count: 1)
✅ [PASS] Cell dynamic_risk is reactively elevated to 90.0 (Dynamic: 90.0)
✅ [PASS] Cell combined risk_score is 59.0 (Score: 59.0)
✅ [PASS] Cell risk_status escalated to CRITICAL (Status: CRITICAL)
✅ [PASS] Both Active -> news_risk is MAX(50, 80) = 80.0
✅ [PASS] Event B Expired -> news_risk decays to Event A value (50.0)
✅ [PASS] All Expired -> news_risk resets to 0.0
✅ [PASS] All Expired -> dynamic_risk resets to 0.0
✅ [PASS] Recomputation for 1 cells completes in < 4000ms (1240.79ms)
✅ [PASS] Recomputation for 10 cells completes in < 4000ms (1294.48ms)
✅ [PASS] Recomputation for 100 cells completes in < 4000ms (1302.15ms)
✅ [PASS] Recomputation for 1000 cells completes in < 4000ms (1689.33ms - 1.68ms/cell)

================================================================================
             TEST RESULTS: 20 / 20 PASSED (100%)
================================================================================
```
