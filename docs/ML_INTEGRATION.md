# RESQ Disaster Text Classifier: Production Integration Guide

**Document Version**: 1.0.0  
**Target Service**: `server/services/ml/disasterClassifierService.js`  
**Model Version**: `v1`  
**Date**: August 30, 2026  

---

## 1. System Overview

The RESQ Disaster Text Classifier is an in-process, lightweight Machine Learning classification service built with:
- **Feature Extraction**: Sublinear TF-IDF ($N\text{-gram} \in [1, 2]$, 2,500 max vocabulary).
- **Classification Engine**: Multinomial Logistic Regression with Balanced Class Weights.
- **Inference Runtime**: Pure Node.js matrix arithmetic evaluated directly from `ml/models/model_v1.json`.
- **Latency**: $<0.03\text{ ms}$ per classification (over 35,000 classifications/sec).
- **External Dependencies**: Zero. Production Node.js server does not require Python or external child processes.

---

## 2. Configuration & Feature Flags

Environment variables configured in `server/.env`:

```env
# Enable or disable the ML classification service entirely
ML_CLASSIFIER_ENABLED=true

# Operating Mode:
# 'off'    -> Bypassed completely. Pure legacy rule-based NLP used.
# 'shadow' -> Parallel inference. Logs ML predictions in event metadata without modifying live risk.
# 'active' -> Conservative Event Gate. Rejects non-active false positives from 500m grid linking.
ML_CLASSIFIER_MODE=shadow

# Minimum probability threshold required to qualify as ACTIVE_DISASTER in active mode
ML_CONFIDENCE_THRESHOLD=0.70
```

---

## 3. The Conservative Event Classification Gate

In Active Mode (`ML_CLASSIFIER_MODE=active`), an ingested RSS item is required to satisfy all criteria before generating an active disaster event and linking 500m PostGIS cells:

```
                  ┌───────────────────────────────┐
                  │      Incoming RSS Item        │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────────┐
                    │ Rule-Based Keyword Check  │
                    └────────────┬──────────────┘
                                 │ (Passes Score >= 2)
                                 ▼
                    ┌───────────────────────────┐
                    │ ML Classification (v1)    │
                    └────────────┬──────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
                   ▼ (Label = ACTIVE_DISASTER  ▼ (Label != ACTIVE_DISASTER
                      & Confidence >= 0.70)       or Confidence < 0.70)
        ┌───────────────────────┐   ┌──────────────────────────────┐
        │  Resolve Coordinates  │   │ Mark as Non-Active Incident  │
        └──────────┬────────────┘   │ (No 500m Grid Risk Inflation)│
                   │ (Resolved)     └──────────────────────────────┘
                   ▼
        ┌───────────────────────┐
        │  Link 500m PostGIS    │
        │  Dynamic Risk Grids   │
        └───────────────────────┘
```

---

## 4. Fail-Safe Invariants

1. **Missing / Corrupt Model File**: If `model_v1.json` is missing or invalid, `disasterClassifierService.js` logs a single warning and sets `isReady = false`. Subsequent calls return `{ fallback: true }`. The RSS pipeline automatically continues with legacy rule-based extraction without throwing unhandled exceptions or crashing.
2. **Zero Downstream Formula Changes**: The PostGIS 500m grid calculations, `dynamicRiskService.js`, and Valhalla routing remain authoritative. The ML model only acts as an input filter on the text.

---

## 5. Verification Commands

```powershell
# 1. Run ML Classifier Regression Test Suite
node server/test/mlClassifier.test.js

# 2. Retrain Model (if dataset is updated)
$env:OMP_NUM_THREADS="1"; python ml/train.py

# 3. Build & Lint Client Application
npm --prefix client run build; npm --prefix client run lint
```
