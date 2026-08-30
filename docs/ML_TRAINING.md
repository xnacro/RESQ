# RESQ Disaster Text Classifier: Model Training & Evaluation Report

**Model Version**: v1.0  
**Algorithm**: TF-IDF (Unigram + Bigram, Sublinear TF) + Multinomial Logistic Regression (Balanced Class Weights)  
**Evaluation Partition**: Independent held-out test split (20% stratified, zero cross-split leakage)  
**Date**: August 30, 2026  

---

## 1. Dataset Partitioning & Class Distribution

The training dataset (`ml/data/disaster_text_dataset.csv`) contains 125 carefully cataloged news headlines and lead sentences spanning regional reporting across Assam and Meghalaya.

| Class Label | Total Count | Proportion (%) | Training Partition | Held-Out Test Partition |
| :--- | :--- | :--- | :--- | :--- |
| **`ACTIVE_DISASTER`** | 40 | 32.0% | 32 | 8 |
| **`HISTORICAL_DISASTER`** | 25 | 20.0% | 20 | 5 |
| **`GENERAL_RISK`** | 25 | 20.0% | 20 | 5 |
| **`IRRELEVANT`** | 35 | 28.0% | 28 | 7 |
| **Total** | **125** | **100.0%** | **100** | **25** |

---

## 2. Feature Extraction & Hyperparameters

- **Vectorization**: `TfidfVectorizer`
  - `ngram_range`: `(1, 2)` (captures key phrases like *"road blocked"*, *"bridge closure"*, *"drainage plan"*, *"in 2022"*)
  - `max_features`: 2500
  - `sublinear_tf`: `True`
  - `token_pattern`: `(?u)\b\w+\b`
  - `stop_words`: English (with regional geographic preserving tokenization)
- **Classifier**: `LogisticRegression`
  - `solver`: `lbfgs`
  - `class_weight`: `balanced`
  - `C`: 1.0 (L2 Regularization)
  - `max_iter`: 1000

---

## 3. Evaluation Metrics (Independent Held-Out Test Set)

| Metric | Logistic Regression (v1) | LinearSVC Baseline |
| :--- | :--- | :--- |
| **Overall Accuracy** | **76.00%** | 80.00% |
| **Macro F1 Score** | **0.7222** | 0.7640 |
| **Weighted F1 Score** | **0.7511** | 0.7920 |
| **`ACTIVE_DISASTER` Recall** | **100.00% (8 / 8)** | 100.00% (8 / 8) |
| **`ACTIVE_DISASTER` Precision** | **80.00%** | 88.89% |

### Per-Class Detailed Performance

| Class | Precision | Recall | F1 Score | Test Support |
| :--- | :--- | :--- | :--- | :--- |
| **`ACTIVE_DISASTER`** | **0.8000** | **1.0000** | **0.8889** | 8 |
| **`HISTORICAL_DISASTER`** | **0.5714** | **0.8000** | **0.6667** | 5 |
| **`GENERAL_RISK`** | **0.6667** | **0.4000** | **0.5000** | 5 |
| **`IRRELEVANT`** | **1.0000** | **0.7143** | **0.8333** | 7 |

---

## 4. Confusion Matrix

```
                Predicted ->
               ACTIVE_D   GENERAL_   HISTORIC   IRRELEVA
Actual:
ACTIVE_D              8          0          0          0
GENERAL_              2          2          1          0
HISTORIC              0          1          4          0
IRRELEVA              0          0          2          5
```

---

## 5. Measured Error Analysis & Safety Gate Validation

Inspection of the 6 misclassified test cases revealed an essential operational finding regarding prediction confidence:

1. **`GENERAL_RISK` $\rightarrow$ `ACTIVE_DISASTER` (2 items)**:
   - *"Heavy rain alert for Guwahati: IMD warns of possible waterlogging and flash floods over next 3-4 days."* $\rightarrow$ Predicted confidence: **0.295**
   - *"Geological Survey of India maps 120 high-risk landslide zones along NH-6 corridor."* $\rightarrow$ Predicted confidence: **0.297**
   - **Safety Gate Validation**: Because our production **Conservative Event Gate** strictly enforces $\text{ML Confidence} \ge 0.70$ to create active disaster events, both of these low-confidence predictions ($<0.30$) are **automatically rejected** from creating active 500m grid risk links.
2. **`HISTORICAL_DISASTER` $\rightarrow$ `GENERAL_RISK` (1 item)**:
   - *"Driving my XUV 7XO AWD through one of the worst Guwahati floods of July 2024."* $\rightarrow$ Confidence: **0.344**
3. **`IRRELEVANT` $\rightarrow$ `HISTORICAL_DISASTER` (2 items)**:
   - *"Assam: Gauhati High Court orders Rs 3 lakh compensation in 2018 Maibang police firing case."* $\rightarrow$ Confidence: **0.300**
   - *"Bollywood star arrives in Kaziranga for wildlife conservation documentary shoot."* $\rightarrow$ Confidence: **0.278**

---

## 6. Exported Artifacts

- **`ml/models/model_v1.joblib`**: Standard scikit-learn training pipeline artifact.
- **`ml/models/model_v1.json`** (259.2 KB): Portable parameter export containing vocabulary mappings, IDF vector, coefficients matrix $W$, and intercept vector $b$ for in-process JavaScript execution.
- **`ml/models/metrics_v1.json`**: Exact test metrics and confusion matrix data.
