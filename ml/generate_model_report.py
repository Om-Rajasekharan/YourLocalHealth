"""Create a readable ML report from MyLocalHealth training artifacts.

The training script writes machine-readable metrics into ``ml/models``. This
script turns those files into a short Markdown report that is easier to review
in a portfolio, demo, or internal model note.

Run:
  python3 ml/generate_model_report.py
  python3 ml/generate_model_report.py --output docs/model-report.md

This report is informational. It does not validate the model clinically.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_SUMMARY_PATH = Path("ml/models/training_summary.json")
DEFAULT_OUTPUT_PATH = Path("ml/model_report.md")

DISPLAY_NAMES = {
    "felt_impact": "Local conditions affected me",
    "respiratory_symptoms": "Respiratory symptoms",
    "allergy_symptoms": "Allergy-like symptoms",
    "heat_symptoms": "Heat discomfort",
    "headache_or_fatigue": "Headache or fatigue",
    "avoided_outdoor_activity": "Avoided outdoor activity",
    "used_rescue_medication": "Used rescue medication",
    "missed_work_school_activity": "Missed work, school, or activity",
    "severe_symptoms": "Higher symptom severity",
}

MODEL_NAMES = {
    "extra_trees": "Extra Trees",
    "gradient_boosting": "Gradient Boosting",
    "logistic_regression": "Logistic Regression",
    "random_forest": "Random Forest",
}

FEATURE_LABELS = {
    "model_score": "overall local risk score",
    "aqi": "air quality index",
    "forecast_average_score": "average forecast risk",
    "forecast_peak_score": "peak forecast risk",
    "forecast_allergy_peak_score": "peak allergy forecast",
    "equity_score": "health-equity vulnerability",
    "places_chronic_burden_score": "local chronic disease burden",
    "places_asthma": "asthma prevalence",
    "places_copd": "COPD prevalence",
    "places_smoking": "smoking prevalence",
    "places_obesity": "obesity prevalence",
    "places_diabetes": "diabetes prevalence",
    "checkin_month": "seasonality",
    "checkin_day_of_week": "day of week",
    "zip_prefix": "regional ZIP pattern",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Markdown model report from MyLocalHealth metrics."
    )
    parser.add_argument(
        "--summary",
        type=Path,
        default=DEFAULT_SUMMARY_PATH,
        help="Path to training_summary.json.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Markdown report output path.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Optional compact JSON summary output path.",
    )
    parser.add_argument(
        "--top-features",
        type=int,
        default=5,
        help="Number of top features to show per trained target.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Could not find {path}. Train models first with "
            "`python3 ml/train_symptom_model.py data/synthetic_checkins.csv --all-targets`."
        )

    return json.loads(path.read_text(encoding="utf-8"))


def percent(value: Any) -> str:
    if value is None:
        return "n/a"
    try:
        return f"{float(value) * 100:.1f}%"
    except (TypeError, ValueError):
        return "n/a"


def number(value: Any, digits: int = 3) -> str:
    if value is None:
        return "n/a"
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return "n/a"


def readable_model_name(model_name: str | None) -> str:
    if not model_name:
        return "n/a"
    return MODEL_NAMES.get(model_name, model_name.replace("_", " ").title())


def readable_feature_name(raw_feature: str) -> str:
    feature = raw_feature
    for prefix in ["numeric__", "categorical__"]:
        if feature.startswith(prefix):
            feature = feature.removeprefix(prefix)
            break

    if "_" in feature and feature.split("_", 1)[0] in FEATURE_LABELS:
        feature = feature.split("_", 1)[0]

    return FEATURE_LABELS.get(feature, feature.replace("_", " "))


def model_quality(metrics: dict[str, Any]) -> str:
    auc = metrics.get("roc_auc")
    average_precision = metrics.get("average_precision")
    balanced = metrics.get("balanced_accuracy")

    score = max(
        float(auc or 0),
        float(average_precision or 0) * 0.8,
        float(balanced or 0),
    )

    if score >= 0.8:
        return "strong demo signal"
    if score >= 0.65:
        return "usable early signal"
    if score >= 0.55:
        return "experimental signal"
    return "needs more data"


def summarize_result(result: dict[str, Any], top_features: int) -> dict[str, Any]:
    holdout = result.get("holdout_metrics", {})
    features = [
        {
            "feature": readable_feature_name(item.get("feature", "")),
            "importance": item.get("importance"),
        }
        for item in result.get("top_features", [])[:top_features]
    ]

    return {
        "target": result.get("target"),
        "label": DISPLAY_NAMES.get(result.get("target"), result.get("target")),
        "status": result.get("status"),
        "selected_model": readable_model_name(result.get("selected_model")),
        "rows": result.get("rows"),
        "positive_rate": result.get("positive_rate"),
        "roc_auc": holdout.get("roc_auc"),
        "average_precision": holdout.get("average_precision"),
        "balanced_accuracy": holdout.get("balanced_accuracy"),
        "quality": model_quality(holdout),
        "top_features": features,
        "reason": result.get("reason"),
    }


def build_markdown(summary: dict[str, Any], compact: list[dict[str, Any]]) -> str:
    trained = [result for result in compact if result["status"] == "trained"]
    skipped = [result for result in compact if result["status"] != "trained"]
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    lines = [
        "# MyLocalHealth ML Model Report",
        "",
        f"Generated at: `{generated_at}`",
        f"Training data source: `{summary.get('csv_path', 'unknown')}`",
        f"Rows reviewed by trainer: `{summary.get('row_count', 'unknown')}`",
        "",
        "> This report describes experimental symptom-risk models trained from",
        "> MyLocalHealth check-in data. It is not clinical validation and should",
        "> not be presented as medical advice, diagnosis, or treatment.",
        "",
        "## Summary",
        "",
        f"- Trained targets: {len(trained)}",
        f"- Skipped targets: {len(skipped)}",
        "- Recommended use: product research, model transparency, and demo QA.",
        "- Not recommended: clinical claims or individual medical decision-making.",
        "",
    ]

    if trained:
        lines.extend(
            [
                "## Trained Targets",
                "",
                "| Outcome | Model | Rows | Positive rate | ROC AUC | Avg precision | Balanced accuracy | Readiness |",
                "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
            ]
        )
        for result in trained:
            lines.append(
                "| {label} | {model} | {rows} | {positive_rate} | {roc_auc} | "
                "{average_precision} | {balanced_accuracy} | {quality} |".format(
                    label=result["label"],
                    model=result["selected_model"],
                    rows=result["rows"],
                    positive_rate=percent(result["positive_rate"]),
                    roc_auc=number(result["roc_auc"]),
                    average_precision=number(result["average_precision"]),
                    balanced_accuracy=number(result["balanced_accuracy"]),
                    quality=result["quality"],
                )
            )
        lines.append("")

        lines.extend(["## Top Predictors", ""])
        for result in trained:
            lines.extend([f"### {result['label']}", ""])
            if not result["top_features"]:
                lines.extend(["No feature-importance data was produced.", ""])
                continue

            for feature in result["top_features"]:
                lines.append(
                    f"- {feature['feature']}: importance {number(feature['importance'], 4)}"
                )
            lines.append("")

    if skipped:
        lines.extend(["## Skipped Targets", ""])
        for result in skipped:
            lines.append(f"- {result['label']}: {result.get('reason', 'not trained')}")
        lines.append("")

    lines.extend(
        [
            "## How To Improve Accuracy",
            "",
            "1. Collect real user check-ins linked to the exact snapshot shown that day.",
            "2. Keep synthetic rows separate from real labels when reporting performance.",
            "3. Track model drift by location, season, and respiratory-virus period.",
            "4. Validate calibration so a predicted 30% risk behaves like 30% in reality.",
            "5. Review feature importance for leakage or proxy variables before launch.",
            "",
            "## Guardrails",
            "",
            "- This model estimates self-reported symptom outcomes, not disease.",
            "- The model should explain uncertainty and data coverage in the UI.",
            "- Users with serious symptoms should seek medical care.",
        ]
    )

    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    summary = load_json(args.summary)
    compact = [
        summarize_result(result, args.top_features)
        for result in summary.get("results", [])
    ]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_markdown(summary, compact), encoding="utf-8")
    print(f"Wrote Markdown report: {args.output}")

    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(
            json.dumps(
                {
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "source_summary": str(args.summary),
                    "targets": compact,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"Wrote JSON report: {args.json_output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
