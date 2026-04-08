import json
import os
import pickle

import pandas as pd


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "adhd_assessment_v2.csv")
MODEL_PATH = os.path.join(BASE_DIR, "adhd_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "adhd_scaler.pkl")
IMPUTER_PATH = os.path.join(BASE_DIR, "adhd_imputer.pkl")
METADATA_PATH = os.path.join(BASE_DIR, "adhd_model_metadata.json")


def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH)
    df["iq_estimate"] = df["iq_estimate"].replace(-1, pd.NA)
    df["adhd200_inattentive"] = df["adhd200_inattentive"].replace(-999, pd.NA)
    df["adhd200_hyperimpulsive"] = df["adhd200_hyperimpulsive"].replace(-999, pd.NA)
    return df


def main() -> None:
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)
    with open(IMPUTER_PATH, "rb") as f:
        imputer = pickle.load(f)

    df = load_dataset()
    feature_cols = metadata["feature_cols"]
    row = df[feature_cols].iloc[[0]]

    row_imputed = imputer.transform(row)
    row_scaled = scaler.transform(row_imputed)
    score = float(model.predict_proba(row_scaled)[0][1])

    print("Model artifacts load successfully.")
    print(f"Feature count: {len(feature_cols)}")
    print(f"Sample probability: {score:.4f}")


if __name__ == "__main__":
    main()
