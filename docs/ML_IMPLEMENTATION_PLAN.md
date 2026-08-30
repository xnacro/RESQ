# RESQ Machine Learning Implementation Plan: Disaster Text Classification

**Document Version**: 1.0.0  
**Phase**: Stage 1 — Audit & Architecture Plan  
**Target Model**: Version 1.0 (`model_v1`)

---

## 1. Objective & Scope

The goal of this ML integration is to provide a **lightweight, localized, and fail-safe text classification model** that augments the existing RESQ disaster intelligence pipeline.

### Strict Boundaries:
- **ML Role**: Predict text category (`ACTIVE_DISASTER`, `HISTORICAL_DISASTER`, `GENERAL_RISK`, `IRRELEVANT`) and confidence score ($P \in [0.0, 1.0]$).
- **Out of Scope for ML**: The model will **NOT** compute `static_risk`, `dynamic_risk`, `risk_score`, `risk_status`, or routing safety directly. Those remain strictly within the PostGIS and dynamic risk engine rules.

---

## 2. Dataset Construction & Labeling

### 2.1 Dataset Location & File Format
- File path: `ml/data/disaster_text_dataset.csv`
- Schema:
  - `id`: Unique integer identifier.
  - `text`: Cleaned news headline and brief description.
  - `label`: One of `ACTIVE_DISASTER`, `HISTORICAL_DISASTER`, `GENERAL_RISK`, `IRRELEVANT`.
  - `hazard_type`: Specific hazard (`FLOOD`, `FLASH_FLOOD`, `LANDSLIDE`, `ROAD_BLOCKAGE`, `BRIDGE_CLOSURE`, `SEVERE_RAINFALL`, `OTHER`).
  - `label_source`: Provenance tag (`manual`, `reviewed`, `existing_event`, `weak_label`).
  - `source_name`: Publishing agency / outlet.
  - `event_date`: Publication timestamp or date string.
  - `is_duplicate`: Boolean flag for deduplication tracking.

### 2.2 Stratified Partitioning & Leakage Prevention
- **Total Corpus**: 200–250 curated and labeled regional items across Assam & Meghalaya.
- **Train Split (80%)**: Used for TF-IDF feature extraction and Logistic Regression weight fitting.
- **Test Split (20%)**: Held-out, human-verified evaluation suite.
- **Leakage Prevention**: Grouped splitting ensures syndicated wire duplicates and near-identical headlines ($>85\%$ token overlap) remain in either train or test, never across both.

---

## 3. Model Architecture & Training Strategy

### 3.1 Model Selection
- **Feature Extraction**: `TfidfVectorizer`
  - `ngram_range=(1, 2)` (captures key phrases like *"road blocked"*, *"flash flood"*, *"drainage plan"*, *"in 2022"*).
  - `max_features=2500`
  - `sublinear_tf=True`
  - English stop words with regional geography preservation.
- **Classifier**: `LogisticRegression`
  - `solver='lbfgs'`
  - `class_weight='balanced'` (prevents bias against minority acute road/bridge closures).
  - `max_iter=1000`
  - `C=1.0` (L2 regularization).

### 3.2 Comparison Baseline
- `LinearSVC` (Calibrated with `CalibratedClassifierCV`) will be evaluated as a secondary baseline during training for objective comparison.

### 3.3 Training Pipeline (`ml/train.py`)
1. Validate dataset schema and clean null values.
2. Deduplicate near-identical entries.
3. Compute 5-fold stratified cross-validation.
4. Fit final vectorizer and classifier on the training partition.
5. Evaluate on the held-out test partition.
6. Export artifacts:
   - `ml/models/model_v1.joblib`: Standard scikit-learn binary.
   - `ml/models/model_v1.json`: Extracted vocabulary index, IDF vector, class names, logistic regression weight matrix $W$, and bias vector $b$.
   - `ml/models/metrics_v1.json`: Test set precision, recall, F1, and confusion matrix.

---

## 4. Node.js In-Process Inference Architecture

To achieve zero external dependencies and sub-millisecond execution in production Node.js:

```
┌────────────────────────────────────────────────────────┐
│      server/services/ml/disasterClassifierService.js   │
├────────────────────────────────────────────────────────┤
│ 1. Load model_v1.json on server startup into memory.   │
│ 2. Tokenize input text (lower-case, regex tokenizer).  │
│ 3. Build unigram + bigram term counts.                 │
│ 4. Multiply by IDF weights and apply L2 norm:          │
│       x_norm = x_tfidf / sqrt(sum(x_tfidf^2))          │
│ 5. Compute Linear Scores: z_k = W_k · x_norm + b_k     │
│ 6. Compute Softmax Probabilities:                      │
│       P(k) = exp(z_k) / sum_j(exp(z_j))                │
│ 7. Return: { label, confidence, probabilities, version }│
└────────────────────────────────────────────────────────┘
```

- **Latency**: $< 0.2\text{ ms}$ per classification.
- **Memory Footprint**: $< 1.5\text{ MB}$.
- **Python Dependency in Production**: **Zero**. Production Node.js server does not require Python running or spawned.

---

## 5. Rollout Phasing, Feature Flags, and Shadow Mode

### 5.1 Configuration Environment Variables
```env
# Feature Flag for ML Classifier (disabled by default)
ML_CLASSIFIER_ENABLED=false

# Operating Mode: 'off' | 'shadow' | 'active'
ML_CLASSIFIER_MODE=shadow

# Minimum confidence required to qualify as ACTIVE_DISASTER
ML_CONFIDENCE_THRESHOLD=0.70
```

### 5.2 Operating Modes
1. **OFF (`ML_CLASSIFIER_MODE=off`)**:
   - ML service is completely bypassed. Standard production NLP continues as normal.
2. **SHADOW MODE (`ML_CLASSIFIER_MODE=shadow`)**:
   - During RSS processing, the article is evaluated by both baseline NLP and ML.
   - Predictions and confidence scores are logged into `disaster.news_events.raw_extraction` metadata.
   - **Zero impact on live risk**: Events are created solely based on existing NLP rules.
   - Shadow comparison report generated: `docs/ML_SHADOW_EVALUATION.md`.
3. **ACTIVE MODE (`ML_CLASSIFIER_MODE=active`)**:
   - The Conservative Event Gate is enabled.

---

## 6. Conservative Event Classification Gate

In Active Mode, an ingested article only creates an active geospatial disaster event if all three independent signals agree:

$$\text{Allow Active Event} \iff \begin{cases} 
\text{ML Label} = \text{"ACTIVE\_DISASTER"} \\
\text{ML Confidence} \ge 0.70 \\
\text{Baseline NLP} \ne \text{FILTERED} \\
\text{Geocoding Coordinates Resolved} = \text{TRUE}
\end{cases}$$

### Downgrade Behavior:
- If ML classifies an article as `HISTORICAL_DISASTER`, `GENERAL_RISK`, or `IRRELEVANT`, or if ML confidence is below 0.70:
  - Event status is flagged as `PROCESSED_NON_ACTIVE` or discarded.
  - **No 500m PostGIS grid cells are linked**.
  - **Dynamic risk is NOT elevated**.

---

## 7. Fail-Safe Behavior & Rollback Strategy

1. **Model Loading Failure**:
   - If `model_v1.json` is missing or corrupt, `disasterClassifierService.js` catches the error, logs a single warning, and sets an internal `isReady = false` flag.
   - All subsequent classification calls gracefully return `fallback: true`.
   - The RSS pipeline immediately falls back to baseline rule-based NLP without interruption.
2. **Instant Rollback**:
   - Setting `ML_CLASSIFIER_ENABLED=false` or `ML_CLASSIFIER_MODE=off` in `.env` reverts the system to 100% legacy behavior with zero database schema changes required.

---

## 8. Verification & Test Plan

1. **Unit & ML Test Suite (`test/mlClassifier.test.js`)**:
   - Validates mathematical equivalence between Node.js JavaScript inference and Python scikit-learn outputs across test vectors.
   - Evaluates performance on known difficult regression test cases (historical 2022 floods, tea auction prices, Boko flash floods, Nongpoh bridge closures).
2. **Shadow Mode Live Evaluation**:
   - Evaluates live RSS items over a simulated or live cycle, reporting agreement rate and divergence cases.
3. **End-to-End Browser & Map Verification**:
   - Open Map Dashboard, Intelligence Panel, and RESQ Mode.
   - Confirm active disaster cards display ML classification metadata and confidence.
   - Confirm historical / policy articles do not create live red grid cells on the map.
   - Confirm Valhalla routing and RESQ Mode live GPS tracking operate without regression.

---

## 9. Commit & Delivery Schedule

- **Commit 1**: `docs(ml): add ML data and integration audit` (Audit document + Implementation Plan)
- **Commit 2**: `feat(ml): add disaster classifier training pipeline` (Dataset, training script, exported model artifact)
- **Commit 3**: `test(ml): add classifier evaluation suite` (Node test suite + verification fixtures)
- **Commit 4**: `feat(ml): add shadow inference integration` (Node classifier service + shadow logging)
- **Commit 5**: `feat(ml): add conservative event classification gate` (Active mode gate in newsEventService)
- **Commit 6**: `feat(client): expose optional disaster classification confidence` (Admin/Intelligence UI metadata display)
