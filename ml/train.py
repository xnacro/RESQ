# RESQ Disaster Text Classification: Training & Model Export Pipeline
# Implements TF-IDF + Logistic Regression with Grouped Leakage Prevention and JSON parameter export

import os
import json
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
)
import joblib

MODEL_VERSION = "v1"
REQUIRED_COLUMNS = ["id", "text", "label", "hazard_type", "label_source"]
ALLOWED_CLASSES = ["ACTIVE_DISASTER", "HISTORICAL_DISASTER", "GENERAL_RISK", "IRRELEVANT"]

def main():
    print(f"=== RESQ DISASTER CLASSIFIER TRAINING (Version: {MODEL_VERSION}) ===")
    
    # 1. Load and validate dataset
    dataset_path = os.path.join(os.path.dirname(__file__), "data", "disaster_text_dataset.csv")
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
    df = pd.read_csv(dataset_path)
    print(f"Loaded {len(df)} records from {dataset_path}")
    
    # Validate columns
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")
            
    # Validate labels and drop invalid rows
    df = df[df["label"].isin(ALLOWED_CLASSES)].copy()
    df = df.dropna(subset=["text", "label"]).reset_index(drop=True)
    print(f"Valid records after schema check: {len(df)}")
    
    # Report class distribution
    print("\nClass Distribution:")
    class_counts = df["label"].value_counts()
    for cls in ALLOWED_CLASSES:
        count = int(class_counts.get(cls, 0))
        pct = (count / len(df)) * 100
        print(f"  - {cls:<20}: {count:>3} ({pct:>5.1f}%)")
        
    # 2. Prevent data leakage by isolating duplicate/syndicated wire stories
    non_dup_df = df[df.get("is_duplicate", 0) == 0].copy().reset_index(drop=True)
    dup_df = df[df.get("is_duplicate", 0) == 1].copy().reset_index(drop=True)
    
    # Stratified Train/Test split (80% train, 20% test on non-duplicate stories)
    train_df, test_df = train_test_split(
        non_dup_df,
        test_size=0.20,
        random_state=42,
        stratify=non_dup_df["label"]
    )
    
    # Append duplicates to the train partition only (never allow test leakage)
    if len(dup_df) > 0:
        train_df = pd.concat([train_df, dup_df]).reset_index(drop=True)
        
    print(f"\nPartitions: Train = {len(train_df)} samples | Held-out Test = {len(test_df)} samples")
    
    # Extract string lists to prevent pyarrow indexing compatibility issues
    train_texts = [str(t) for t in train_df["text"].tolist()]
    train_labels = np.array([str(l) for l in train_df["label"].tolist()], dtype=object)
    
    test_texts = [str(t) for t in test_df["text"].tolist()]
    test_labels = np.array([str(l) for l in test_df["label"].tolist()], dtype=object)
    
    # 3. Train TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=2500,
        sublinear_tf=True,
        lowercase=True,
        token_pattern=r"(?u)\b\w+\b",
        stop_words="english",
    )
    
    X_train = vectorizer.fit_transform(train_texts)
    y_train = train_labels
    
    X_test = vectorizer.transform(test_texts)
    y_test = test_labels
    
    # 4. Fit Logistic Regression Classifier
    clf = LogisticRegression(
        class_weight="balanced",
        C=1.0,
        solver="lbfgs",
        max_iter=1000,
        random_state=42,
    )
    clf.fit(X_train, y_train)
    
    # Baseline comparison: Linear SVC
    svc = LinearSVC(class_weight="balanced", random_state=42, max_iter=2000)
    svc.fit(X_train, y_train)
    
    # 5. Evaluate on Test Set
    y_pred = clf.predict(X_test)
    y_pred_proba = clf.predict_proba(X_test)
    
    y_pred_svc = svc.predict(X_test)
    
    acc_lr = accuracy_score(y_test, y_pred)
    acc_svc = accuracy_score(y_test, y_pred_svc)
    
    prec_macro, rec_macro, f1_macro, _ = precision_recall_fscore_support(
        y_test, y_pred, average="macro", zero_division=0
    )
    prec_weighted, rec_weighted, f1_weighted, _ = precision_recall_fscore_support(
        y_test, y_pred, average="weighted", zero_division=0
    )
    
    # Per-class metrics
    class_names = list(clf.classes_)
    prec_per_class, rec_per_class, f1_per_class, supp_per_class = precision_recall_fscore_support(
        y_test, y_pred, labels=class_names, zero_division=0
    )
    
    conf_matrix = confusion_matrix(y_test, y_pred, labels=class_names)
    
    print("\n" + "=" * 60)
    print(f"EVALUATION RESULTS (Model: TF-IDF + Logistic Regression v{MODEL_VERSION})")
    print("=" * 60)
    print(f"Accuracy (Logistic Regression) : {acc_lr * 100:.2f}%")
    print(f"Accuracy (LinearSVC Baseline)  : {acc_svc * 100:.2f}%")
    print(f"Macro F1 Score                : {f1_macro:.4f}")
    print(f"Weighted F1 Score             : {f1_weighted:.4f}")
    
    print("\nPer-Class Breakdown:")
    for idx, cname in enumerate(class_names):
        print(f"  - {cname:<20}: Precision={prec_per_class[idx]:.4f} | Recall={rec_per_class[idx]:.4f} | F1={f1_per_class[idx]:.4f} | Support={supp_per_class[idx]}")
        
    print("\nConfusion Matrix:")
    header = "          " + "  ".join([f"{c[:8]:>8}" for c in class_names])
    print(header)
    for idx, row in enumerate(conf_matrix):
        row_str = f"{class_names[idx][:8]:>8}  " + "  ".join([f"{val:>8}" for val in row])
        print(row_str)
        
    # 6. Error Analysis
    print("\n" + "=" * 60)
    print("ERROR ANALYSIS (Detailed Misclassifications on Held-out Test Set)")
    print("=" * 60)
    
    test_df_evaluated = test_df.copy().reset_index(drop=True)
    test_df_evaluated["predicted"] = y_pred
    test_df_evaluated["confidence"] = np.max(y_pred_proba, axis=1)
    
    errors = test_df_evaluated[test_df_evaluated["label"] != test_df_evaluated["predicted"]]
    if len(errors) == 0:
        print("✓ Zero misclassifications observed on the held-out test suite.")
    else:
        print(f"Found {len(errors)} misclassifications:")
        for _, err in errors.iterrows():
            print(f"\n[Error] True: {err['label']} -> Predicted: {err['predicted']} (Conf: {err['confidence']:.3f})")
            print(f"        Text: \"{err['text']}\"")
            print(f"        Hazard: {err['hazard_type']} | Source: {err['source_name']}")
            
    # 7. Export Model Artifacts
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)
    
    # A. Standard scikit-learn binary
    joblib_path = os.path.join(models_dir, f"model_{MODEL_VERSION}.joblib")
    joblib.dump({"vectorizer": vectorizer, "classifier": clf}, joblib_path)
    print(f"\nSaved scikit-learn model binary to: {joblib_path}")
    
    # B. Export pure JSON parameters for zero-dependency Node.js linear evaluation
    vocab_map = {str(k): int(v) for k, v in vectorizer.vocabulary_.items()}
    idf_weights = [float(w) for w in vectorizer.idf_.tolist()]
    coef_matrix = [[float(c) for c in row] for row in clf.coef_.tolist()]
    intercept_vector = [float(b) for b in clf.intercept_.tolist()]
    
    json_model = {
        "model_version": MODEL_VERSION,
        "algorithm": "TF-IDF + Logistic Regression",
        "classes": class_names,
        "ngram_range": list(vectorizer.ngram_range),
        "sublinear_tf": bool(vectorizer.sublinear_tf),
        "vocabulary": vocab_map,
        "idf": idf_weights,
        "coefficients": coef_matrix,
        "intercept": intercept_vector,
        "exported_at": pd.Timestamp.now().isoformat(),
    }
    
    json_path = os.path.join(models_dir, f"model_{MODEL_VERSION}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_model, f, indent=2)
    print(f"Saved portable JSON inference artifact to: {json_path} (Size: {os.path.getsize(json_path) / 1024:.1f} KB)")
    
    # C. Export Metrics JSON
    metrics_data = {
        "model_version": MODEL_VERSION,
        "accuracy_logistic_regression": float(acc_lr),
        "accuracy_linear_svc": float(acc_svc),
        "macro_f1": float(f1_macro),
        "weighted_f1": float(f1_weighted),
        "classes": class_names,
        "per_class": {
            cname: {
                "precision": float(prec_per_class[i]),
                "recall": float(rec_per_class[i]),
                "f1": float(f1_per_class[i]),
                "support": int(supp_per_class[i]),
            }
            for i, cname in enumerate(class_names)
        },
        "confusion_matrix": conf_matrix.tolist(),
        "train_size": len(train_df),
        "test_size": len(test_df),
        "evaluated_at": pd.Timestamp.now().isoformat(),
    }
    
    metrics_path = os.path.join(models_dir, f"metrics_{MODEL_VERSION}.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved evaluation metrics to: {metrics_path}")
    
    print("\n[SUCCESS] Training and artifact generation completed successfully.")

if __name__ == "__main__":
    main()
