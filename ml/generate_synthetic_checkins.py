"""Generate synthetic MyLocalHealth check-ins for ML pipeline testing.

Synthetic data is useful for testing the training pipeline, demos, and UI
integration. It is not evidence that the model is clinically accurate.

Run:
  python3 ml/generate_synthetic_checkins.py
  python3 ml/generate_synthetic_checkins.py --rows 2000 --output data/synthetic_checkins.csv
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path


FIELDNAMES = [
    "checkin_id",
    "user_id",
    "snapshot_id",
    "checkin_zip_code",
    "felt_impact",
    "respiratory_symptoms",
    "allergy_symptoms",
    "heat_symptoms",
    "headache_or_fatigue",
    "avoided_outdoor_activity",
    "used_rescue_medication",
    "missed_work_school_activity",
    "symptom_severity",
    "checkin_created_at",
    "zip_code",
    "city",
    "state",
    "latitude",
    "longitude",
    "model_version",
    "model_score",
    "health_risk",
    "respiratory_risk",
    "air_quality",
    "aqi",
    "dominant_pollutant",
    "pollutant_risk",
    "heat_risk",
    "uv_risk",
    "alert_risk",
    "flu_activity",
    "covid_activity",
    "covid_coverage",
    "forecast_average_score",
    "forecast_peak_score",
    "forecast_best_window",
    "forecast_worst_window",
    "forecast_allergy_peak_score",
    "forecast_allergy_peak_window",
    "forecast_pollen_risk",
    "equity_score",
    "equity_level",
    "places_chronic_burden_score",
    "places_asthma",
    "places_copd",
    "places_smoking",
    "places_obesity",
    "places_diabetes",
    "snapshot_created_at",
]


@dataclass(frozen=True)
class Place:
    zip_code: str
    city: str
    state: str
    latitude: float
    longitude: float
    baseline_equity: int
    baseline_chronic: int


PLACES = [
    Place("80528", "Fort Collins", "CO", 40.5237, -105.0250, 28, 34),
    Place("27516", "Chapel Hill", "NC", 35.9162, -79.0999, 32, 38),
    Place("10001", "New York", "NY", 40.7506, -73.9972, 58, 52),
    Place("85004", "Phoenix", "AZ", 33.4510, -112.0685, 62, 56),
    Place("90011", "Los Angeles", "CA", 34.0079, -118.2582, 72, 61),
    Place("60623", "Chicago", "IL", 41.8502, -87.7170, 70, 64),
    Place("77002", "Houston", "TX", 29.7555, -95.3657, 57, 58),
    Place("98101", "Seattle", "WA", 47.6101, -122.3344, 34, 36),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate synthetic check-ins for ML testing."
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=1500,
        help="Number of synthetic rows to generate.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/synthetic_checkins.csv"),
        help="CSV output path.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible fake data.",
    )
    return parser.parse_args()


def clamp(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, round(value)))


def sigmoid(value: float) -> float:
    return 1 / (1 + math.exp(-value))


def weighted_choice(rng: random.Random, options: list[tuple[str, float]]) -> str:
    total = sum(weight for _, weight in options)
    draw = rng.uniform(0, total)
    current = 0.0
    for label, weight in options:
        current += weight
        if draw <= current:
            return label
    return options[-1][0]


def risk_label(score: int) -> str:
    if score >= 67:
        return "High"
    if score >= 34:
        return "Moderate"
    return "Low"


def activity_label(score: int) -> str:
    if score >= 75:
        return "Very High"
    if score >= 55:
        return "High"
    if score >= 35:
        return "Moderate"
    if score >= 15:
        return "Low"
    return "Very Low"


def boolean_label(value: bool) -> str:
    return "true" if value else "false"


def generate_row(rng: random.Random, index: int) -> dict[str, str | int | float]:
    place = rng.choice(PLACES)
    now = datetime.now(timezone.utc)
    checkin_date = now - timedelta(days=rng.randint(0, 240), hours=rng.randint(0, 23))
    month = checkin_date.month
    summer = month in [6, 7, 8, 9]
    winter = month in [11, 12, 1, 2, 3]
    spring = month in [3, 4, 5]

    heat_score = clamp(rng.gauss(64 if summer else 24, 18))
    uv_score = clamp(rng.gauss(70 if summer else 32, 18))
    pollen_score = clamp(rng.gauss(68 if spring else 32, 20))
    aqi = clamp(rng.gauss(42, 18) + (10 if place.state in ["CA", "AZ", "TX"] else 0), 5, 175)
    pollutant_score = clamp((aqi - 20) * 0.7 + rng.gauss(0, 8))
    flu_score = clamp(rng.gauss(58 if winter else 18, 18))
    covid_score = clamp(rng.gauss(36, 18))
    alert_score = clamp(rng.gauss(20, 18) + (20 if summer and place.state in ["AZ", "TX"] else 0))
    equity_score = clamp(place.baseline_equity + rng.gauss(0, 10))
    chronic_score = clamp(place.baseline_chronic + rng.gauss(0, 10))

    forecast_average = clamp(
        0.23 * pollutant_score
        + 0.21 * heat_score
        + 0.18 * uv_score
        + 0.2 * pollen_score
        + 0.18 * alert_score
        + rng.gauss(0, 8)
    )
    forecast_peak = clamp(forecast_average + abs(rng.gauss(12, 9)))
    model_score = clamp(
        0.2 * pollutant_score
        + 0.16 * heat_score
        + 0.12 * uv_score
        + 0.13 * pollen_score
        + 0.18 * max(flu_score, covid_score)
        + 0.12 * equity_score
        + 0.09 * chronic_score
        + rng.gauss(0, 7)
    )

    respiratory_probability = sigmoid(
        -2.8
        + 0.021 * pollutant_score
        + 0.018 * max(flu_score, covid_score)
        + 0.016 * chronic_score
        + 0.01 * equity_score
        + rng.gauss(0, 0.45)
    )
    allergy_probability = sigmoid(
        -3.0
        + 0.038 * pollen_score
        + 0.012 * pollutant_score
        + 0.008 * chronic_score
        + rng.gauss(0, 0.45)
    )
    heat_probability = sigmoid(
        -3.2
        + 0.042 * heat_score
        + 0.012 * uv_score
        + 0.008 * equity_score
        + rng.gauss(0, 0.45)
    )
    headache_probability = sigmoid(
        -3.1
        + 0.016 * pollutant_score
        + 0.014 * heat_score
        + 0.01 * forecast_peak
        + rng.gauss(0, 0.5)
    )

    respiratory_symptoms = rng.random() < respiratory_probability
    allergy_symptoms = rng.random() < allergy_probability
    heat_symptoms = rng.random() < heat_probability
    headache_or_fatigue = rng.random() < headache_probability
    felt_impact = (
        respiratory_symptoms
        or allergy_symptoms
        or heat_symptoms
        or headache_or_fatigue
        or rng.random() < sigmoid(-3.5 + 0.028 * model_score)
    )
    avoided_outdoor_activity = felt_impact and rng.random() < sigmoid(-2.2 + 0.035 * forecast_peak)
    used_rescue_medication = respiratory_symptoms and rng.random() < sigmoid(-2.8 + 0.026 * chronic_score)
    missed_work_school_activity = felt_impact and rng.random() < sigmoid(-4.0 + 0.035 * model_score)

    severity_base = (
        1.2 * respiratory_symptoms
        + 1.1 * allergy_symptoms
        + 1.1 * heat_symptoms
        + 0.8 * headache_or_fatigue
        + 1.4 * used_rescue_medication
        + 1.2 * missed_work_school_activity
        + model_score / 35
    )
    symptom_severity = clamp(rng.gauss(severity_base, 1.2), 0, 10)

    pollutant = weighted_choice(
        rng,
        [
            ("PM2.5", 0.42),
            ("Ozone", 0.32),
            ("NO2", 0.12),
            ("PM10", 0.14),
        ],
    )
    best_window = weighted_choice(
        rng,
        [("6 AM-9 AM", 0.36), ("9 AM-12 PM", 0.24), ("5 PM-8 PM", 0.3), ("8 PM-10 PM", 0.1)],
    )
    worst_window = weighted_choice(
        rng,
        [("12 PM-3 PM", 0.44), ("3 PM-6 PM", 0.36), ("9 AM-12 PM", 0.12), ("6 PM-9 PM", 0.08)],
    )

    return {
        "checkin_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "snapshot_id": str(uuid.uuid4()),
        "checkin_zip_code": place.zip_code,
        "felt_impact": boolean_label(felt_impact),
        "respiratory_symptoms": boolean_label(respiratory_symptoms),
        "allergy_symptoms": boolean_label(allergy_symptoms),
        "heat_symptoms": boolean_label(heat_symptoms),
        "headache_or_fatigue": boolean_label(headache_or_fatigue),
        "avoided_outdoor_activity": boolean_label(avoided_outdoor_activity),
        "used_rescue_medication": boolean_label(used_rescue_medication),
        "missed_work_school_activity": boolean_label(missed_work_school_activity),
        "symptom_severity": symptom_severity,
        "checkin_created_at": checkin_date.isoformat(),
        "zip_code": place.zip_code,
        "city": place.city,
        "state": place.state,
        "latitude": round(place.latitude + rng.gauss(0, 0.015), 5),
        "longitude": round(place.longitude + rng.gauss(0, 0.015), 5),
        "model_version": "synthetic-demo-v1",
        "model_score": model_score,
        "health_risk": risk_label(model_score),
        "respiratory_risk": risk_label(clamp(0.42 * pollutant_score + 0.38 * max(flu_score, covid_score) + 0.2 * chronic_score)),
        "air_quality": f"{aqi} - {risk_label(pollutant_score)}",
        "aqi": aqi,
        "dominant_pollutant": pollutant,
        "pollutant_risk": risk_label(pollutant_score),
        "heat_risk": risk_label(heat_score),
        "uv_risk": risk_label(uv_score),
        "alert_risk": risk_label(alert_score),
        "flu_activity": activity_label(flu_score),
        "covid_activity": activity_label(covid_score),
        "covid_coverage": weighted_choice(rng, [("Good", 0.65), ("Limited", 0.25), ("Unknown", 0.1)]),
        "forecast_average_score": forecast_average,
        "forecast_peak_score": forecast_peak,
        "forecast_best_window": best_window,
        "forecast_worst_window": worst_window,
        "forecast_allergy_peak_score": pollen_score,
        "forecast_allergy_peak_window": weighted_choice(rng, [("9 AM-12 PM", 0.35), ("12 PM-3 PM", 0.35), ("3 PM-6 PM", 0.2), ("6 AM-9 AM", 0.1)]),
        "forecast_pollen_risk": risk_label(pollen_score),
        "equity_score": equity_score,
        "equity_level": risk_label(equity_score),
        "places_chronic_burden_score": chronic_score,
        "places_asthma": round(6 + chronic_score * 0.09 + rng.gauss(0, 1.1), 1),
        "places_copd": round(3 + chronic_score * 0.07 + rng.gauss(0, 0.9), 1),
        "places_smoking": round(7 + chronic_score * 0.13 + rng.gauss(0, 1.8), 1),
        "places_obesity": round(18 + chronic_score * 0.22 + rng.gauss(0, 2.8), 1),
        "places_diabetes": round(5 + chronic_score * 0.09 + rng.gauss(0, 1.2), 1),
        "snapshot_created_at": (checkin_date - timedelta(minutes=rng.randint(1, 90))).isoformat(),
    }


def main() -> int:
    args = parse_args()
    rng = random.Random(args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with args.output.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        for index in range(args.rows):
            writer.writerow(generate_row(rng, index))

    print(f"Wrote {args.rows} synthetic check-ins to {args.output}")
    print(
        "Reminder: this file is for testing/demo training only, not accuracy claims."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
