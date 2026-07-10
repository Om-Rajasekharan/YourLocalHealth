"""Train symptom-risk models from exported MyLocalHealth check-in data.

This script expects a CSV exported from Supabase where each row is one
symptom_checkin joined to the health_snapshot that was shown to the user.

Example export SQL:

select
  c.felt_impact,
  c.respiratory_symptoms,
  c.allergy_symptoms,
  c.heat_symptoms,
  c.headache_or_fatigue,
  c.avoided_outdoor_activity,
  c.used_rescue_medication,
  c.missed_work_school_activity,
  c.symptom_severity,
  c.created_at as checkin_created_at,
  s.zip_code,
  s.city,
  s.state,
  s.latitude,
  s.longitude,
  s.model_version,
  s.model_score,
  s.health_risk,
  s.respiratory_risk,
  s.air_quality,
  s.aqi,
  s.dominant_pollutant,
  s.pollutant_risk,
  s.heat_risk,
  s.uv_risk,
  s.alert_risk,
  s.flu_activity,
  s.covid_activity,
  s.covid_coverage,
  s.forecast_average_score,
  s.forecast_peak_score,
  s.forecast_best_window,
  s.forecast_worst_window,
  s.forecast_allergy_peak_score,
  s.forecast_allergy_peak_window,
  s.forecast_pollen_risk,
  s.equity_score,
  s.equity_level,
  s.places_chronic_burden_score,
  s.places_asthma,
  s.places_copd,
  s.places_smoking,
  s.places_obesity,
  s.places_diabetes
from public.symptom_checkins c
left join public.health_snapshots s on s.id = c.snapshot_id;

Run:
  python ml/train_symptom_model.py data/checkins.csv
  python ml/train_symptom_model.py data/checkins.csv --target heat_symptoms
  python ml/train_symptom_model.py data/checkins.csv --all-targets
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import joblib
    import pandas as pd
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import (
        ExtraTreesClassifier,
        GradientBoostingClassifier,
        RandomForestClassifier,
    )
    from sklearn.dummy import DummyClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        balanced_accuracy_score,
        brier_score_loss,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
except ModuleNotFoundError as import_error:
    joblib = None
    pd = None
    ColumnTransformer = Any
    ExtraTreesClassifier = None
    GradientBoostingClassifier = None
    RandomForestClassifier = None
    DummyClassifier = None
    SimpleImputer = None
    LogisticRegression = None
    StratifiedKFold = None
    Pipeline = Any
    OneHotEncoder = None
    StandardScaler = None
    MISSING_DEPENDENCY = import_error.name
else:
    MISSING_DEPENDENCY = ""


TARGETS = [
    "felt_impact",
    "respiratory_symptoms",
    "allergy_symptoms",
    "heat_symptoms",
    "headache_or_fatigue",
    "avoided_outdoor_activity",
    "used_rescue_medication",
    "missed_work_school_activity",
    "severe_symptoms",
]

DEFAULT_TARGET = "respiratory_symptoms"

NUMERIC_FEATURES = [
    "model_score",
    "aqi",
    "latitude",
    "longitude",
    "forecast_average_score",
    "forecast_peak_score",
    "forecast_allergy_peak_score",
    "equity_score",
    "places_chronic_burden_score",
    "places_asthma",
    "places_copd",
    "places_smoking",
    "places_obesity",
    "places_diabetes",
    "checkin_month",
    "checkin_day_of_week",
    "zip_prefix",
]

CATEGORICAL_FEATURES = [
    "city",
    "state",
    "model_version",
    "health_risk",
    "respiratory_risk",
    "air_quality",
    "dominant_pollutant",
    "pollutant_risk",
    "heat_risk",
    "uv_risk",
    "alert_risk",
    "flu_activity",
    "covid_activity",
    "covid_coverage",
    "forecast_best_window",
    "forecast_worst_window",
    "forecast_allergy_peak_window",
    "forecast_pollen_risk",
    "equity_level",
]

EXCLUDED_FROM_FEATURES = {
    "symptom_severity",
    *TARGETS,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train MyLocalHealth symptom-risk models from a check-in CSV."
    )
    parser.add_argument("csv_path", type=Path, help="Path to exported training CSV.")
    parser.add_argument(
        "--target",
        choices=TARGETS,
        default=DEFAULT_TARGET,
        help=f"Outcome label to train. Default: {DEFAULT_TARGET}.",
    )
    parser.add_argument(
        "--all-targets",
        action="store_true",
        help="Train one model for every supported symptom/check-in target.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ml/models"),
        help="Directory for model artifacts.",
    )
    parser.add_argument(
        "--min-rows",
        type=int,
        default=30,
        help="Minimum labeled rows required before training a target.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.25,
        help="Holdout test fraction when enough rows are available.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed for reproducible training.",
    )
    return parser.parse_args()


def make_one_hot_encoder() -> OneHotEncoder:
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def coerce_bool(series: pd.Series) -> pd.Series:
    if series.dtype == bool:
        return series

    normalized = series.astype(str).str.strip().str.lower()
    return normalized.isin(["true", "t", "1", "yes", "y"])


def add_engineered_features(data: pd.DataFrame) -> pd.DataFrame:
    prepared = data.copy()

    if "symptom_severity" in prepared.columns:
        prepared["severe_symptoms"] = (
            pd.to_numeric(prepared["symptom_severity"], errors="coerce").fillna(0) >= 4
        )

    if "zip_code" in prepared.columns:
        zip_text = prepared["zip_code"].astype(str).str.extract(r"(\d{3})")[0]
        prepared["zip_prefix"] = pd.to_numeric(zip_text, errors="coerce")

    if "checkin_created_at" in prepared.columns:
        checkin_dates = pd.to_datetime(
            prepared["checkin_created_at"], errors="coerce", utc=True
        )
        prepared["checkin_month"] = checkin_dates.dt.month
        prepared["checkin_day_of_week"] = checkin_dates.dt.dayofweek

    for column in NUMERIC_FEATURES:
        if column in prepared.columns:
            prepared[column] = pd.to_numeric(prepared[column], errors="coerce")

    for column in CATEGORICAL_FEATURES:
        if column in prepared.columns:
            prepared[column] = prepared[column].astype("string")

    return prepared


def available_features(data: pd.DataFrame) -> tuple[list[str], list[str]]:
    numeric = [
        column
        for column in NUMERIC_FEATURES
        if column in data.columns and column not in EXCLUDED_FROM_FEATURES
    ]
    categorical = [
        column
        for column in CATEGORICAL_FEATURES
        if column in data.columns and column not in EXCLUDED_FROM_FEATURES
    ]
    return numeric, categorical


def build_preprocessor(
    numeric_features: list[str], categorical_features: list[str]
) -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric_features,
            ),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", make_one_hot_encoder()),
                    ]
                ),
                categorical_features,
            ),
        ],
        remainder="drop",
    )


def candidate_models(random_state: int) -> dict[str, Any]:
    return {
        "logistic_regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            solver="liblinear",
            random_state=random_state,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=500,
            min_samples_leaf=3,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=random_state,
            n_jobs=-1,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=500,
            min_samples_leaf=3,
            max_features="sqrt",
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(random_state=random_state),
    }


def build_pipeline(
    classifier: Any,
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor(numeric_features, categorical_features)),
            ("classifier", classifier),
        ]
    )


def probability_scores(model: Pipeline, features: pd.DataFrame) -> pd.Series:
    if hasattr(model, "predict_proba"):
        return pd.Series(model.predict_proba(features)[:, 1], index=features.index)

    decision = pd.Series(model.decision_function(features), index=features.index)
    return 1 / (1 + decision.map(lambda value: math.exp(-value)))


def metric_summary(labels: pd.Series, probabilities: pd.Series) -> dict[str, Any]:
    predictions = probabilities >= 0.5
    summary: dict[str, Any] = {
        "rows": int(len(labels)),
        "positive_rows": int(labels.sum()),
        "positive_rate": round(float(labels.mean()), 4),
        "accuracy": round(accuracy_score(labels, predictions), 4),
        "balanced_accuracy": round(balanced_accuracy_score(labels, predictions), 4),
        "precision": round(
            precision_score(labels, predictions, zero_division=0),
            4,
        ),
        "recall": round(recall_score(labels, predictions, zero_division=0), 4),
        "f1": round(f1_score(labels, predictions, zero_division=0), 4),
        "average_precision": round(average_precision_score(labels, probabilities), 4),
        "brier_score": round(brier_score_loss(labels, probabilities), 4),
        "confusion_matrix": confusion_matrix(labels, predictions).tolist(),
    }

    if labels.nunique() == 2:
        summary["roc_auc"] = round(roc_auc_score(labels, probabilities), 4)

    return summary


def calibration_summary(
    labels: pd.Series, probabilities: pd.Series, n_bins: int = 10
) -> dict[str, Any] | None:
    """Bins predictions by predicted probability and compares each bin's mean
    prediction to its observed positive rate, so a claimed "70% risk" can be
    checked against how often that bin was actually positive. Reports the
    Expected Calibration Error (a sample-weighted average of that gap) since
    the app only ever shows users a probability, never a thresholded
    decision -- so calibration matters more here than accuracy-style metrics."""
    if labels.nunique() < 2 or len(labels) < 10:
        return None

    resolved_bins = max(2, min(n_bins, len(labels) // 5))
    edges = [i / resolved_bins for i in range(resolved_bins + 1)]

    probs = probabilities.to_numpy()
    labs = labels.to_numpy().astype(float)

    bins = []
    weighted_error = 0.0
    for i in range(resolved_bins):
        lo, hi = edges[i], edges[i + 1]
        in_bin = (probs >= lo) & (probs <= hi if i == resolved_bins - 1 else probs < hi)
        count = int(in_bin.sum())
        if count == 0:
            continue

        predicted_mean = round(float(probs[in_bin].mean()), 4)
        observed_rate = round(float(labs[in_bin].mean()), 4)
        bins.append(
            {
                "bin_range": [round(lo, 2), round(hi, 2)],
                "predicted_mean": predicted_mean,
                "observed_rate": observed_rate,
                "count": count,
            }
        )
        weighted_error += (count / len(labs)) * abs(predicted_mean - observed_rate)

    if not bins:
        return None

    return {
        "expected_calibration_error": round(weighted_error, 4),
        "bins": bins,
    }


def evaluate_baseline(
    x_train: pd.DataFrame,
    y_train: pd.Series,
    x_test: pd.DataFrame,
    y_test: pd.Series,
    n_splits: int,
    random_state: int,
) -> dict[str, Any]:
    """Evaluates a DummyClassifier that always predicts the training positive
    rate, through the same cross-validation and holdout path as the real
    candidates. This is diagnostic only -- it is never eligible for selection
    as the deployed model -- and exists so "the model beats guessing the
    average rate" is a checked fact instead of an assumption."""
    baseline = DummyClassifier(strategy="prior")

    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    cv_probabilities = cross_val_predict(
        baseline, x_train, y_train, cv=cv, method="predict_proba"
    )[:, 1]
    cv_metrics = metric_summary(
        y_train, pd.Series(cv_probabilities, index=y_train.index)
    )
    cv_metrics["model_name"] = "baseline_prior"

    baseline.fit(x_train, y_train)
    holdout_probabilities = pd.Series(
        baseline.predict_proba(x_test)[:, 1], index=x_test.index
    )
    holdout_metrics = metric_summary(y_test, holdout_probabilities)
    holdout_metrics["calibration"] = calibration_summary(y_test, holdout_probabilities)

    return {
        "description": "DummyClassifier(strategy='prior') always predicts the training positive rate; a real model should beat this.",
        "cross_validation": cv_metrics,
        "holdout_metrics": holdout_metrics,
    }


def feature_names(model: Pipeline) -> list[str]:
    preprocessor = model.named_steps["preprocessor"]
    return list(preprocessor.get_feature_names_out())


def feature_importance(model: Pipeline) -> pd.DataFrame:
    classifier = model.named_steps["classifier"]
    names = feature_names(model)

    if hasattr(classifier, "feature_importances_"):
        values = classifier.feature_importances_
    elif hasattr(classifier, "coef_"):
        values = abs(classifier.coef_[0])
    else:
        return pd.DataFrame(columns=["feature", "importance"])

    return (
        pd.DataFrame({"feature": names, "importance": values})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )


def train_target(
    data: pd.DataFrame,
    target: str,
    output_dir: Path,
    min_rows: int,
    test_size: float,
    random_state: int,
) -> dict[str, Any]:
    if target not in data.columns:
        return {"target": target, "status": "skipped", "reason": "missing target column"}

    target_data = data.dropna(subset=[target]).copy()
    if len(target_data) < min_rows:
        return {
            "target": target,
            "status": "skipped",
            "reason": f"need at least {min_rows} labeled rows",
            "rows": int(len(target_data)),
        }

    labels = coerce_bool(target_data[target])
    target_data = target_data.loc[labels.index]
    if labels.nunique() < 2:
        return {
            "target": target,
            "status": "skipped",
            "reason": "need both positive and negative labels",
            "rows": int(len(labels)),
            "positive_rows": int(labels.sum()),
        }

    class_counts = labels.value_counts()
    if class_counts.min() < 3:
        return {
            "target": target,
            "status": "skipped",
            "reason": "need at least 3 examples in each class",
            "rows": int(len(labels)),
            "positive_rows": int(labels.sum()),
        }

    numeric_features, categorical_features = available_features(target_data)
    if not numeric_features and not categorical_features:
        return {
            "target": target,
            "status": "skipped",
            "reason": "no usable feature columns",
        }

    features = target_data[numeric_features + categorical_features]

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=test_size,
        random_state=random_state,
        stratify=labels,
    )

    train_class_counts = y_train.value_counts()
    if train_class_counts.min() < 2:
        return {
            "target": target,
            "status": "skipped",
            "reason": "training split needs at least 2 examples in each class",
            "rows": int(len(labels)),
            "positive_rows": int(labels.sum()),
        }

    model_scores = []
    n_splits = min(5, int(train_class_counts.min()))

    for model_name, classifier in candidate_models(random_state).items():
        model = build_pipeline(classifier, numeric_features, categorical_features)
        cv = StratifiedKFold(
            n_splits=n_splits, shuffle=True, random_state=random_state
        )
        probabilities = cross_val_predict(
            model,
            x_train,
            y_train,
            cv=cv,
            method="predict_proba",
        )[:, 1]
        metrics = metric_summary(
            y_train,
            pd.Series(probabilities, index=y_train.index),
        )
        metrics["model_name"] = model_name
        model_scores.append(metrics)

    ranked_models = sorted(
        model_scores,
        key=lambda item: (
            item.get("roc_auc", 0),
            item.get("average_precision", 0),
            item.get("balanced_accuracy", 0),
        ),
        reverse=True,
    )
    best_model_name = ranked_models[0]["model_name"]

    final_model = build_pipeline(
        candidate_models(random_state)[best_model_name],
        numeric_features,
        categorical_features,
    )
    final_model.fit(x_train, y_train)
    holdout_probabilities = probability_scores(final_model, x_test)
    holdout_metrics = metric_summary(y_test, holdout_probabilities)
    holdout_metrics["calibration"] = calibration_summary(y_test, holdout_probabilities)
    holdout_report = classification_report(
        y_test,
        holdout_probabilities >= 0.5,
        output_dict=True,
        zero_division=0,
    )

    baseline = evaluate_baseline(
        x_train, y_train, x_test, y_test, n_splits, random_state
    )
    baseline["roc_auc_lift"] = round(
        holdout_metrics.get("roc_auc", 0)
        - baseline["holdout_metrics"].get("roc_auc", 0),
        4,
    )

    final_model.fit(features, labels)

    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / f"{target}_model.joblib"
    metrics_path = output_dir / f"{target}_metrics.json"
    importance_path = output_dir / f"{target}_feature_importance.csv"

    joblib.dump(final_model, model_path)
    importance = feature_importance(final_model)
    importance.to_csv(importance_path, index=False)

    metadata = {
        "target": target,
        "status": "trained",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_path": str(model_path),
        "metrics_path": str(metrics_path),
        "feature_importance_path": str(importance_path),
        "selected_model": best_model_name,
        "rows": int(len(labels)),
        "positive_rows": int(labels.sum()),
        "positive_rate": round(float(labels.mean()), 4),
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "train_rows": int(len(y_train)),
        "holdout_rows": int(len(y_test)),
        "model_selection": "Candidate models are selected by stratified cross-validation on the training split only; holdout metrics are computed once on an untouched test split.",
        "cross_validation": ranked_models,
        "holdout_metrics": holdout_metrics,
        "holdout_classification_report": holdout_report,
        "baseline": baseline,
        "top_features": importance.head(15).to_dict(orient="records"),
        "notes": [
            "This is a user-check-in model, not a clinical prediction model.",
            "Metrics are only meaningful once the dataset contains enough diverse check-ins.",
            "Use prospective validation before showing ML predictions as product claims.",
            "Calibration bins predicted probability against observed outcome rate on the holdout split; expected_calibration_error near 0 means a claimed 70% risk behaves like 70% in practice.",
        ],
    }

    metrics_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> int:
    args = parse_args()

    if MISSING_DEPENDENCY:
        print(
            f"Missing Python package: {MISSING_DEPENDENCY}\n"
            "Install the ML dependencies first:\n"
            "  python3 -m pip install -r ml/requirements.txt"
        )
        return 1

    if not args.csv_path.exists():
        print(f"Could not find {args.csv_path}")
        return 1

    data = pd.read_csv(args.csv_path)
    prepared_data = add_engineered_features(data)
    targets = TARGETS if args.all_targets else [args.target]
    results = [
        train_target(
            data=prepared_data,
            target=target,
            output_dir=args.output_dir,
            min_rows=args.min_rows,
            test_size=args.test_size,
            random_state=args.random_state,
        )
        for target in targets
    ]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = args.output_dir / "training_summary.json"
    summary = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "csv_path": str(args.csv_path),
        "row_count": int(len(prepared_data)),
        "results": results,
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    for result in results:
        if result["status"] == "trained":
            print(
                f"Trained {result['target']} with {result['selected_model']} "
                f"on {result['rows']} rows. Holdout ROC AUC: "
                f"{result['holdout_metrics'].get('roc_auc', 'n/a')}"
                f" (baseline {result['baseline']['holdout_metrics'].get('roc_auc', 'n/a')}, "
                f"lift {result['baseline']['roc_auc_lift']})"
            )
            calibration = result["holdout_metrics"].get("calibration")
            if calibration:
                print(
                    f"  calibration: expected_calibration_error="
                    f"{calibration['expected_calibration_error']}"
                )
            print(f"  model: {result['model_path']}")
            print(f"  metrics: {result['metrics_path']}")
            print(f"  feature importance: {result['feature_importance_path']}")
        else:
            print(
                f"Skipped {result['target']}: {result['reason']} "
                f"({result.get('rows', 0)} rows)"
            )

    print(f"Training summary: {summary_path}")
    trained_count = sum(1 for result in results if result["status"] == "trained")
    return 0 if trained_count else 1


if __name__ == "__main__":
    raise SystemExit(main())
