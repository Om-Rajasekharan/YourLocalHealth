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
from fastapi import FastAPI
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_symptom_model import CATEGORICAL_FEATURES, NUMERIC_FEATURES, TARGETS  # noqa: E402

MODELS_DIR = Path(__file__).resolve().parent / "models"

app = FastAPI(title="MyLocalHealth Symptom Model Service")

_pipelines: dict[str, object] = {}
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
        if model_path.exists():
            _pipelines[target] = joblib.load(model_path)
            _positive_rates[target] = positive_rates.get(target)


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
            predictions[target] = {
                "probability": round(float(proba[positive_index]), 4),
                "trainingPositiveRate": _positive_rates.get(target),
            }
        except Exception as exc:  # noqa: BLE001 -- one target failing shouldn't fail the batch
            predictions[target] = {"probability": None, "error": str(exc)}

    return {"predictions": predictions, "modelsAvailable": sorted(_pipelines.keys())}
