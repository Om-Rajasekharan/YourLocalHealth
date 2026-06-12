"""Train a baseline symptom-risk model from exported YourLocalHealth data.

Expected CSV shape:
One row per symptom_checkin joined to its health_snapshot. Export columns can
come from Supabase SQL such as:

select
  c.respiratory_symptoms,
  c.symptom_severity,
  c.felt_impact,
  s.model_score,
  s.aqi,
  s.forecast_average_score,
  s.forecast_peak_score,
  s.equity_score,
  s.health_risk,
  s.respiratory_risk,
  s.air_quality,
  s.pollutant_risk,
  s.heat_risk,
  s.uv_risk,
  s.alert_risk,
  s.flu_activity,
  s.covid_activity,
  s.covid_coverage
from public.symptom_checkins c
left join public.health_snapshots s on s.id = c.snapshot_id;

Run:
  python ml/train_symptom_model.py data/checkins.csv
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


TARGET = "respiratory_symptoms"

NUMERIC_FEATURES = [
    "model_score",
    "aqi",
    "forecast_average_score",
    "forecast_peak_score",
    "equity_score",
]

CATEGORICAL_FEATURES = [
    "health_risk",
    "respiratory_risk",
    "air_quality",
    "pollutant_risk",
    "heat_risk",
    "uv_risk",
    "alert_risk",
    "flu_activity",
    "covid_activity",
    "covid_coverage",
]


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python ml/train_symptom_model.py data/checkins.csv")
        return 1

    data_path = Path(sys.argv[1])
    if not data_path.exists():
        print(f"Could not find {data_path}")
        return 1

    data = pd.read_csv(data_path)
    missing_columns = [
        column
        for column in [TARGET, *NUMERIC_FEATURES, *CATEGORICAL_FEATURES]
        if column not in data.columns
    ]

    if missing_columns:
        print(f"CSV is missing columns: {', '.join(missing_columns)}")
        return 1

    data = data.dropna(subset=[TARGET])
    if data[TARGET].nunique() < 2:
        print("Need both positive and negative labels before training.")
        return 1

    features = data[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    labels = data[TARGET].astype(bool)
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(
                    steps=[("imputer", SimpleImputer(strategy="median"))]
                ),
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore"),
                        ),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=200,
                    min_samples_leaf=3,
                    random_state=42,
                    class_weight="balanced",
                ),
            ),
        ]
    )

    model.fit(x_train, y_train)
    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]

    print(classification_report(y_test, predictions))
    print(f"ROC AUC: {roc_auc_score(y_test, probabilities):.3f}")

    output_path = Path("ml/models/respiratory_symptom_model.joblib")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)
    print(f"Saved model to {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
