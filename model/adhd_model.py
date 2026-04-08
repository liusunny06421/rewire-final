import json
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "adhd_assessment_v2.csv")
MODEL_PATH = os.path.join(BASE_DIR, "adhd_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "adhd_scaler.pkl")
IMPUTER_PATH = os.path.join(BASE_DIR, "adhd_imputer.pkl")
METADATA_PATH = os.path.join(BASE_DIR, "adhd_model_metadata.json")

DROP_COLS = ["subject_id", "has_adhd", "adhd_subtype"]
TARGET_COL = "has_adhd"
RANDOM_STATE = 42
THRESHOLD = 0.5


def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH)

    # Normalize known sentinel values before fitting the preprocessing steps.
    df["iq_estimate"] = df["iq_estimate"].replace(-1, np.nan)
    df["adhd200_inattentive"] = df["adhd200_inattentive"].replace(-999, np.nan)
    df["adhd200_hyperimpulsive"] = df["adhd200_hyperimpulsive"].replace(-999, np.nan)
    return df


def build_training_data(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    feature_cols = [col for col in df.columns if col not in DROP_COLS]
    X = df[feature_cols].copy()
    y = df[TARGET_COL].astype(int)
    return X, y, feature_cols


def train_model() -> dict:
    df = load_dataset()
    X, y, feature_cols = build_training_data(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    model = LogisticRegression(max_iter=2000, class_weight="balanced")

    X_train_imputed = imputer.fit_transform(X_train)
    X_test_imputed = imputer.transform(X_test)

    X_train_scaled = scaler.fit_transform(X_train_imputed)
    X_test_scaled = scaler.transform(X_test_imputed)

    model.fit(X_train_scaled, y_train)

    probabilities = model.predict_proba(X_test_scaled)[:, 1]
    predictions = (probabilities >= THRESHOLD).astype(int)

    accuracy = accuracy_score(y_test, predictions)
    roc_auc = roc_auc_score(y_test, probabilities)

    coef_df = pd.DataFrame(
        {
            "feature": feature_cols,
            "coefficient": model.coef_[0],
        }
    ).sort_values("coefficient", key=lambda series: series.abs(), ascending=False)

    artifacts = {
        "model": model,
        "scaler": scaler,
        "imputer": imputer,
        "feature_cols": feature_cols,
        "train_rows": len(X_train),
        "X_test": X_test,
        "y_test": y_test,
        "metrics": {
            "accuracy": accuracy,
            "roc_auc": roc_auc,
            "classification_report": classification_report(y_test, predictions),
        },
        "coef_df": coef_df,
    }
    return artifacts


def save_artifacts(model, scaler, imputer, feature_cols) -> None:
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    with open(IMPUTER_PATH, "wb") as f:
        pickle.dump(imputer, f)
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "feature_cols": feature_cols,
                "target_col": TARGET_COL,
                "threshold": THRESHOLD,
                "model_type": "LogisticRegression",
                "random_state": RANDOM_STATE,
                "intercept": float(model.intercept_[0]),
                "coefficients": [float(value) for value in model.coef_[0]],
                "imputer_statistics": [float(value) for value in imputer.statistics_],
                "scaler_mean": [float(value) for value in scaler.mean_],
                "scaler_scale": [float(value) for value in scaler.scale_],
            },
            f,
            indent=2,
        )


def load_artifacts() -> tuple:
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)
    with open(IMPUTER_PATH, "rb") as f:
        imputer = pickle.load(f)
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    return model, scaler, imputer, metadata


def predict_adhd(input_dict: dict) -> dict:
    model, scaler, imputer, metadata = load_artifacts()
    feature_cols = metadata["feature_cols"]

    row = pd.DataFrame([input_dict], columns=feature_cols)
    row_imputed = imputer.transform(row)
    row_scaled = scaler.transform(row_imputed)

    score = float(model.predict_proba(row_scaled)[0][1])
    prediction = int(score >= metadata["threshold"])

    return {
        "score": round(score, 4),
        "prediction": prediction,
        "label": "ADHD likely" if prediction else "ADHD unlikely",
    }


def main() -> None:
    artifacts = train_model()
    save_artifacts(
        artifacts["model"],
        artifacts["scaler"],
        artifacts["imputer"],
        artifacts["feature_cols"],
    )

    print("=== ADHD Logistic Regression Model ===")
    print(f"Features used : {len(artifacts['feature_cols'])}")
    print(f"Training rows : {artifacts['train_rows']}")
    print(f"Test rows     : {len(artifacts['X_test'])}")
    print()
    print("── Test-set metrics ──")
    print(f"  Accuracy : {artifacts['metrics']['accuracy']:.4f}")
    print(f"  ROC AUC  : {artifacts['metrics']['roc_auc']:.4f}")
    print()
    print("── Classification report ──")
    print(artifacts["metrics"]["classification_report"])
    print("── Top 10 most influential features ──")
    print(artifacts["coef_df"].head(10).to_string(index=False))
    print()
    print(f"Model saved    → {MODEL_PATH}")
    print(f"Scaler saved   → {SCALER_PATH}")
    print(f"Imputer saved  → {IMPUTER_PATH}")
    print(f"Metadata saved → {METADATA_PATH}")

    sample = artifacts["X_test"].iloc[0].to_dict()
    result = predict_adhd(sample)
    print()
    print(
        "Sample prediction: "
        f"score={result['score']}, "
        f"prediction={result['label']} "
        f"(actual={int(artifacts['y_test'].iloc[0])})"
    )


if __name__ == "__main__":
    main()
