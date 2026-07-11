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
    import numpy as np
    import pandas as pd
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import (
        ExtraTreesClassifier,
        GradientBoostingClassifier,
        RandomForestClassifier,
    )
    from sklearn.dummy import DummyClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.inspection import permutation_importance
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
    from sklearn.model_selection import (
        RandomizedSearchCV,
        StratifiedKFold,
        cross_val_predict,
        train_test_split,
    )
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
except ModuleNotFoundError as import_error:
    joblib = None
    np = None
    pd = None
    ColumnTransformer = Any
    ExtraTreesClassifier = None
    GradientBoostingClassifier = None
    RandomForestClassifier = None
    DummyClassifier = None
    SimpleImputer = None
    permutation_importance = None
    LogisticRegression = None
    RandomizedSearchCV = None
    StratifiedKFold = None
    Pipeline = Any
    OneHotEncoder = None
    StandardScaler = None
    MISSING_DEPENDENCY = import_error.name
else:
    MISSING_DEPENDENCY = ""

# XGBoost is optional and imported separately: it depends on a native
# OpenMP library (libomp on macOS, libgomp on Linux) that isn't guaranteed
# to be present everywhere sklearn is, so a missing/broken XGBoost install
# degrades to training with the other four candidates instead of failing
# the whole script.
try:
    from xgboost import XGBClassifier

    XGBOOST_AVAILABLE = True
except Exception:  # noqa: BLE001 -- xgboost can fail at import time with a
    # native-library load error (e.g. missing libomp/libgomp), not just
    # ModuleNotFoundError, so this needs to catch broadly to actually
    # degrade gracefully rather than crash the whole training run.
    XGBClassifier = None
    XGBOOST_AVAILABLE = False


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
    parser.add_argument(
        "--tune",
        action="store_true",
        help=(
            "Run a RandomizedSearchCV hyperparameter search for each "
            "tree-based candidate instead of normal training, and print "
            "the best-found parameters. This is an offline/manual tool for "
            "deciding what to hardcode into candidate_models() -- it does "
            "not run on every training call (including CI), since a full "
            "search on every push would make training far too slow."
        ),
    )
    parser.add_argument(
        "--tune-iterations",
        type=int,
        default=15,
        help="RandomizedSearchCV iterations per candidate model when --tune is set.",
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


def candidate_models(
    random_state: int, scale_pos_weight: float = 1.0
) -> dict[str, Any]:
    # Hyperparameters below aren't hand-guessed -- they're the consensus
    # from running --tune (RandomizedSearchCV, scored on ROC AUC) against
    # three targets spanning the dataset's range of class balance
    # (felt_impact ~80% positive, allergy_symptoms ~35%,
    # missed_work_school_activity ~5%). gradient_boosting's max_depth=2 was
    # the single strongest, most consistent signal across all three --
    # shallow trees clearly outperformed deeper ones on this feature set.
    models: dict[str, Any] = {
        "logistic_regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            solver="liblinear",
            C=0.5,
            random_state=random_state,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=450,
            max_depth=10,
            min_samples_leaf=4,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=random_state,
            n_jobs=-1,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=450,
            max_depth=10,
            min_samples_leaf=4,
            max_features="sqrt",
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(
            n_estimators=220,
            max_depth=2,
            learning_rate=0.03,
            subsample=0.85,
            random_state=random_state,
        ),
    }

    # XGBoost doesn't take a class_weight= like the sklearn ensembles above;
    # scale_pos_weight (~= negative_count / positive_count) is its standard
    # equivalent for binary imbalanced classification.
    if XGBOOST_AVAILABLE:
        models["xgboost"] = XGBClassifier(
            n_estimators=600,
            max_depth=4,
            learning_rate=0.02,
            subsample=1.0,
            colsample_bytree=0.9,
            reg_lambda=2.0,
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss",
            random_state=random_state,
            n_jobs=-1,
        )

    return models


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


TUNING_PARAM_DISTRIBUTIONS = {
    "random_forest": {
        "classifier__n_estimators": [300, 400, 500, 600, 800],
        "classifier__max_depth": [None, 6, 8, 12, 16, 20],
        "classifier__min_samples_leaf": [1, 2, 3, 4, 6, 8],
        "classifier__max_features": ["sqrt", "log2", 0.5],
    },
    "extra_trees": {
        "classifier__n_estimators": [300, 400, 500, 600, 800],
        "classifier__max_depth": [None, 6, 8, 12, 16, 20],
        "classifier__min_samples_leaf": [1, 2, 3, 4, 6, 8],
        "classifier__max_features": ["sqrt", "log2", 0.5],
    },
    "gradient_boosting": {
        "classifier__n_estimators": [100, 150, 200, 250, 350],
        "classifier__max_depth": [2, 3, 4, 5],
        "classifier__learning_rate": [0.02, 0.05, 0.08, 0.1, 0.15],
        "classifier__subsample": [0.6, 0.8, 0.9, 1.0],
    },
    "xgboost": {
        "classifier__n_estimators": [150, 200, 300, 400, 600],
        "classifier__max_depth": [3, 4, 5, 6, 8],
        "classifier__learning_rate": [0.02, 0.05, 0.08, 0.1, 0.15],
        "classifier__subsample": [0.6, 0.8, 0.9, 1.0],
        "classifier__colsample_bytree": [0.6, 0.8, 0.9, 1.0],
        "classifier__reg_lambda": [0.5, 1.0, 2.0, 5.0, 10.0],
    },
}


def tune_hyperparameters(
    target: str,
    x_train: pd.DataFrame,
    y_train: pd.Series,
    numeric_features: list[str],
    categorical_features: list[str],
    random_state: int,
    n_iter: int,
) -> dict[str, Any]:
    """Offline hyperparameter search: for each tunable candidate, run
    RandomizedSearchCV (scored on ROC AUC, cross-validated on the training
    split only -- the holdout stays untouched) and report the best
    parameters found. This is a manual tool for deciding what to hardcode
    into candidate_models()'s defaults, not something that runs as part of
    normal training -- a full search on every push would make CI, which
    retrains from scratch every time, far too slow."""
    class_counts = y_train.value_counts()
    scale_pos_weight = class_counts[False] / class_counts[True]
    n_splits = min(3, int(class_counts.min()))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    candidates = candidate_models(random_state, scale_pos_weight)

    results: dict[str, Any] = {}
    for model_name, param_distributions in TUNING_PARAM_DISTRIBUTIONS.items():
        if model_name not in candidates:
            continue

        pipeline = build_pipeline(
            candidates[model_name], numeric_features, categorical_features
        )
        search = RandomizedSearchCV(
            pipeline,
            param_distributions=param_distributions,
            n_iter=n_iter,
            scoring="roc_auc",
            cv=cv,
            random_state=random_state,
            n_jobs=-1,
            error_score="raise",
        )
        search.fit(x_train, y_train)
        results[model_name] = {
            "best_score": round(float(search.best_score_), 4),
            "best_params": search.best_params_,
        }
        print(
            f"[{target}] {model_name}: best CV ROC AUC="
            f"{results[model_name]['best_score']} "
            f"params={results[model_name]['best_params']}"
        )

    return results


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


def bootstrap_metric_ci(
    labels: pd.Series,
    probabilities: pd.Series,
    metric_fn,
    random_state: int,
    n_resamples: int = 1000,
) -> dict[str, float] | None:
    """A 95% confidence interval for a metric via case resampling: redraw the
    holdout set with replacement n_resamples times, recompute the metric each
    time, and report the 2.5th/97.5th percentiles. This turns a single point
    estimate (e.g. "ROC AUC 0.66") into an honest range (e.g. "0.58-0.74"),
    which matters most for the low-prevalence targets where a holdout of a
    few hundred rows makes a point estimate fairly noisy."""
    if len(labels) < 20:
        return None

    rng = np.random.default_rng(random_state)
    labels_arr = labels.to_numpy()
    probs_arr = probabilities.to_numpy()
    n = len(labels_arr)
    scores = []

    for _ in range(n_resamples):
        indices = rng.integers(0, n, size=n)
        resampled_labels = labels_arr[indices]
        if len(np.unique(resampled_labels)) < 2:
            continue
        try:
            scores.append(metric_fn(resampled_labels, probs_arr[indices]))
        except ValueError:
            continue

    if len(scores) < 50:
        return None

    return {
        "low": round(float(np.percentile(scores, 2.5)), 4),
        "high": round(float(np.percentile(scores, 97.5)), 4),
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
    cv_probabilities_by_model: dict[str, pd.Series] = {}
    train_scale_pos_weight = train_class_counts[False] / train_class_counts[True]

    for model_name, classifier in candidate_models(
        random_state, train_scale_pos_weight
    ).items():
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
        cv_probabilities_by_model[model_name] = pd.Series(
            probabilities, index=y_train.index
        )
        metrics = metric_summary(y_train, cv_probabilities_by_model[model_name])
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
        candidate_models(random_state, train_scale_pos_weight)[best_model_name],
        numeric_features,
        categorical_features,
    )
    final_model.fit(x_train, y_train)
    holdout_probabilities = probability_scores(final_model, x_test)
    holdout_metrics = metric_summary(y_test, holdout_probabilities)
    holdout_metrics["calibration"] = calibration_summary(y_test, holdout_probabilities)
    holdout_metrics["roc_auc_ci95"] = bootstrap_metric_ci(
        y_test, holdout_probabilities, roc_auc_score, random_state
    )
    holdout_metrics["brier_score_ci95"] = bootstrap_metric_ci(
        y_test, holdout_probabilities, brier_score_loss, random_state
    )
    holdout_report = classification_report(
        y_test,
        holdout_probabilities >= 0.5,
        output_dict=True,
        zero_division=0,
    )

    # Platt scaling: fit a 1D logistic regression mapping the winning model's
    # cross-validated (out-of-fold, never-seen-during-training) probabilities
    # to observed outcomes, then apply it to the holdout to prove calibration
    # actually improves -- not just measure that it's off.
    calibrator = LogisticRegression().fit(
        cv_probabilities_by_model[best_model_name].to_numpy().reshape(-1, 1),
        y_train,
    )
    calibrated_holdout_probabilities = pd.Series(
        calibrator.predict_proba(
            holdout_probabilities.to_numpy().reshape(-1, 1)
        )[:, 1],
        index=y_test.index,
    )
    calibrated_metrics = metric_summary(y_test, calibrated_holdout_probabilities)
    holdout_metrics["calibrated"] = {
        "brier_score": calibrated_metrics["brier_score"],
        "calibration": calibration_summary(y_test, calibrated_holdout_probabilities),
        "note": "Platt scaling preserves rank order, so ROC AUC is unchanged; only Brier score and calibration bins shift.",
    }

    permutation = permutation_importance(
        final_model,
        x_test,
        y_test,
        scoring="roc_auc",
        n_repeats=10,
        random_state=random_state,
        n_jobs=-1,
    )
    permutation_ranked = sorted(
        zip(numeric_features + categorical_features, permutation.importances_mean, permutation.importances_std),
        key=lambda item: item[1],
        reverse=True,
    )

    baseline = evaluate_baseline(
        x_train, y_train, x_test, y_test, n_splits, random_state
    )
    baseline["roc_auc_lift"] = round(
        holdout_metrics.get("roc_auc", 0)
        - baseline["holdout_metrics"].get("roc_auc", 0),
        4,
    )

    final_full_scale_pos_weight = (
        (~labels).sum() / labels.sum()
    )
    final_model = build_pipeline(
        candidate_models(random_state, final_full_scale_pos_weight)[best_model_name],
        numeric_features,
        categorical_features,
    )
    final_model.fit(features, labels)

    # Refit the calibrator for the production model using out-of-fold
    # probabilities over the FULL dataset (not just x_train), so the
    # deployed calibrator matches the deployed (full-data-fit) model.
    full_cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    full_cv_probabilities = cross_val_predict(
        build_pipeline(
            candidate_models(random_state, final_full_scale_pos_weight)[best_model_name],
            numeric_features,
            categorical_features,
        ),
        features,
        labels,
        cv=full_cv,
        method="predict_proba",
    )[:, 1]
    production_calibrator = LogisticRegression().fit(
        full_cv_probabilities.reshape(-1, 1), labels
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / f"{target}_model.joblib"
    metrics_path = output_dir / f"{target}_metrics.json"
    importance_path = output_dir / f"{target}_feature_importance.csv"
    permutation_importance_path = output_dir / f"{target}_permutation_importance.csv"
    background_path = output_dir / f"{target}_background.csv"
    calibrator_path = output_dir / f"{target}_calibrator.joblib"

    joblib.dump(final_model, model_path)
    joblib.dump(production_calibrator, calibrator_path)
    importance = feature_importance(final_model)
    importance.to_csv(importance_path, index=False)

    permutation_df = pd.DataFrame(
        permutation_ranked, columns=["feature", "importance_mean", "importance_std"]
    )
    permutation_df.to_csv(permutation_importance_path, index=False)

    # A raw (pre-preprocessing) feature sample for serve_models.py to build a
    # SHAP LinearExplainer background from when a linear model wins -- tree
    # models don't need this, but saving it unconditionally means serving
    # doesn't silently lose explanations if a re-run picks a different model.
    background_sample = features.sample(
        min(100, len(features)), random_state=random_state
    )
    background_sample.to_csv(background_path, index=False)

    metadata = {
        "target": target,
        "status": "trained",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_path": str(model_path),
        "metrics_path": str(metrics_path),
        "feature_importance_path": str(importance_path),
        "permutation_importance_path": str(permutation_importance_path),
        "background_path": str(background_path),
        "calibrator_path": str(calibrator_path),
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
        "permutation_importance": [
            {
                "feature": feature,
                "importance_mean": round(float(mean), 4),
                "importance_std": round(float(std), 4),
            }
            for feature, mean, std in permutation_ranked[:15]
        ],
        "notes": [
            "This is a user-check-in model, not a clinical prediction model.",
            "Metrics are only meaningful once the dataset contains enough diverse check-ins.",
            "Use prospective validation before showing ML predictions as product claims.",
            "Calibration bins predicted probability against observed outcome rate on the holdout split; expected_calibration_error near 0 means a claimed 70% risk behaves like 70% in practice.",
            "holdout_metrics.calibrated shows the same probabilities after Platt scaling -- the calibrator applied in production -- so the raw-vs-calibrated calibration error can be compared directly.",
            "roc_auc_ci95/brier_score_ci95 are 95% bootstrap confidence intervals from the holdout split, not just point estimates; they widen for low-prevalence targets where the holdout has few positive examples.",
            "top_features uses the model's built-in impurity/coefficient importance, which is known to be biased toward high-cardinality one-hot categories; permutation_importance measures actual holdout ROC AUC drop per feature and is model-agnostic, so prefer it when the two disagree.",
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

    if args.tune:
        for target in targets:
            if target not in prepared_data.columns:
                print(f"[{target}] skipped: missing target column")
                continue

            target_data = prepared_data.dropna(subset=[target]).copy()
            if len(target_data) < args.min_rows:
                print(f"[{target}] skipped: fewer than {args.min_rows} labeled rows")
                continue

            labels = coerce_bool(target_data[target])
            target_data = target_data.loc[labels.index]
            if labels.nunique() < 2 or labels.value_counts().min() < 3:
                print(f"[{target}] skipped: not enough examples in each class")
                continue

            numeric_features, categorical_features = available_features(target_data)
            features = target_data[numeric_features + categorical_features]
            x_train, _, y_train, _ = train_test_split(
                features,
                labels,
                test_size=args.test_size,
                random_state=args.random_state,
                stratify=labels,
            )

            tune_hyperparameters(
                target,
                x_train,
                y_train,
                numeric_features,
                categorical_features,
                args.random_state,
                args.tune_iterations,
            )

        return 0

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
