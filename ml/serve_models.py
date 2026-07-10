"""FastAPI microservice that serves the trained symptom-risk models.

Loads the joblib pipelines produced by train_symptom_model.py and exposes a
single /predict endpoint that runs a feature snapshot from the Next.js app
through every trained target model. This is the real-model inference path
that complements the heuristic in src/lib/symptomPrediction.ts -- the Next.js
app calls this service with a short timeout and falls back to the heuristic
on any failure, so this process is never a hard dependency for the main app.

Run:
  pip install -r ml/requirements.txt
  uvicorn ml.serve_models:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
import shap
from fastapi import FastAPI
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_symptom_model import CATEGORICAL_FEATURES, NUMERIC_FEATURES, TARGETS  # noqa: E402

MODELS_DIR = Path(__file__).resolve().parent / "models"
TOP_DRIVER_COUNT = 5

app = FastAPI(title="MyLocalHealth Symptom Model Service")

_pipelines: dict[str, object] = {}
_explainers: dict[str, object] = {}
_calibrators: dict[str, object] = {}
_positive_rates: dict[str, Optional[float]] = {}


def _load_models() -> None:
    import json

    summary_path = MODELS_DIR / "training_summary.json"
    positive_rates: dict[str, Optional[float]] = {}
    if summary_path.exists():
        summary = json.loads(summary_path.read_text())
        for result in summary.get("results", []):
            positive_rates[result["target"]] = result.get("positive_rate")

    for target in TARGETS:
        model_path = MODELS_DIR / f"{target}_model.joblib"
        if not model_path.exists():
            continue

        pipeline = joblib.load(model_path)
        _pipelines[target] = pipeline
        _positive_rates[target] = positive_rates.get(target)

        calibrator_path = MODELS_DIR / f"{target}_calibrator.joblib"
        if calibrator_path.exists():
            _calibrators[target] = joblib.load(calibrator_path)

        classifier = pipeline.named_steps["classifier"]
        preprocessor = pipeline.named_steps["preprocessor"]
        try:
            if hasattr(classifier, "feature_importances_"):
                # Tree ensembles (RandomForest/GradientBoosting/ExtraTrees):
                # TreeExplainer reads the tree structure directly, no
                # background data needed.
                _explainers[target] = shap.TreeExplainer(classifier)
            elif hasattr(classifier, "coef_"):
                # Linear models (LogisticRegression) need a background
                # distribution -- train_symptom_model.py saves a raw feature
                # sample per target specifically for this.
                background_path = MODELS_DIR / f"{target}_background.csv"
                if background_path.exists():
                    background = pd.read_csv(background_path)
                    background_transformed = preprocessor.transform(background)
                    _explainers[target] = shap.LinearExplainer(
                        classifier, background_transformed
                    )
        except Exception:  # noqa: BLE001 -- explanations are a bonus, never block serving
            pass


def _feature_group(name: str) -> str:
    """Maps a post-encoding column (e.g. "categorical__heat_risk_High") back
    to the original feature name (e.g. "heat_risk") so one-hot-encoded
    categories roll up into a single SHAP attribution per source feature."""
    if name.startswith("numeric__"):
        return name[len("numeric__"):]
    if name.startswith("categorical__"):
        remainder = name[len("categorical__"):]
        for column in sorted(CATEGORICAL_FEATURES, key=len, reverse=True):
            if remainder == column or remainder.startswith(f"{column}_"):
                return column
        return remainder
    return name


def _top_drivers(target: str, pipeline, frame: pd.DataFrame) -> Optional[list[dict]]:
    explainer = _explainers.get(target)
    if explainer is None:
        return None

    preprocessor = pipeline.named_steps["preprocessor"]
    classifier = pipeline.named_steps["classifier"]
    transformed = preprocessor.transform(frame)
    feature_names = preprocessor.get_feature_names_out()

    shap_values = explainer.shap_values(transformed)
    if shap_values.ndim == 3:
        # Multi-output-capable estimators (e.g. RandomForestClassifier) return
        # (n_samples, n_features, n_classes); pick the positive class.
        positive_index = list(classifier.classes_).index(True)
        row_values = shap_values[0, :, positive_index]
    else:
        # Single-output binary estimators (e.g. GradientBoostingClassifier)
        # return (n_samples, n_features) relative to the positive class.
        row_values = shap_values[0, :]

    grouped: dict[str, float] = {}
    for name, value in zip(feature_names, row_values):
        group = _feature_group(name)
        grouped[group] = grouped.get(group, 0.0) + float(value)

    ranked = sorted(grouped.items(), key=lambda kv: abs(kv[1]), reverse=True)
    return [
        {"feature": feature, "impact": round(impact, 4)}
        for feature, impact in ranked[:TOP_DRIVER_COUNT]
    ]


@app.on_event("startup")
def startup() -> None:
    _load_models()


class FeatureSnapshotRequest(BaseModel):
    model_score: Optional[float] = None
    aqi: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    forecast_average_score: Optional[float] = None
    forecast_peak_score: Optional[float] = None
    forecast_allergy_peak_score: Optional[float] = None
    equity_score: Optional[float] = None
    places_chronic_burden_score: Optional[float] = None
    places_asthma: Optional[float] = None
    places_copd: Optional[float] = None
    places_smoking: Optional[float] = None
    places_obesity: Optional[float] = None
    places_diabetes: Optional[float] = None
    checkin_month: Optional[float] = None
    checkin_day_of_week: Optional[float] = None
    zip_prefix: Optional[float] = None

    city: Optional[str] = None
    state: Optional[str] = None
    model_version: Optional[str] = None
    health_risk: Optional[str] = None
    respiratory_risk: Optional[str] = None
    air_quality: Optional[str] = None
    dominant_pollutant: Optional[str] = None
    pollutant_risk: Optional[str] = None
    heat_risk: Optional[str] = None
    uv_risk: Optional[str] = None
    alert_risk: Optional[str] = None
    flu_activity: Optional[str] = None
    covid_activity: Optional[str] = None
    covid_coverage: Optional[str] = None
    forecast_best_window: Optional[str] = None
    forecast_worst_window: Optional[str] = None
    forecast_allergy_peak_window: Optional[str] = None
    forecast_pollen_risk: Optional[str] = None
    equity_level: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok", "modelsLoaded": sorted(_pipelines.keys())}


@app.post("/predict")
def predict(payload: FeatureSnapshotRequest):
    row = payload.model_dump()
    frame = pd.DataFrame([row], columns=NUMERIC_FEATURES + CATEGORICAL_FEATURES)

    predictions = {}
    for target, pipeline in _pipelines.items():
        try:
            proba = pipeline.predict_proba(frame)[0]
            classes = list(pipeline.classes_)
            positive_index = classes.index(True) if True in classes else len(classes) - 1
            raw_probability = float(proba[positive_index])

            calibrator = _calibrators.get(target)
            if calibrator is not None:
                calibrated_probability = float(
                    calibrator.predict_proba([[raw_probability]])[0][1]
                )
            else:
                calibrated_probability = raw_probability

            entry = {
                # Calibrated via Platt scaling so this behaves like an actual
                # probability (see train_symptom_model.py); rawProbability is
                # the model's uncalibrated output, kept for transparency.
                "probability": round(calibrated_probability, 4),
                "rawProbability": round(raw_probability, 4),
                "trainingPositiveRate": _positive_rates.get(target),
            }
            try:
                entry["topDrivers"] = _top_drivers(target, pipeline, frame)
            except Exception:  # noqa: BLE001 -- a failed explanation shouldn't drop the prediction
                entry["topDrivers"] = None
            predictions[target] = entry
        except Exception as exc:  # noqa: BLE001 -- one target failing shouldn't fail the batch
            predictions[target] = {"probability": None, "error": str(exc)}

    return {"predictions": predictions, "modelsAvailable": sorted(_pipelines.keys())}
