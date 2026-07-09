#!/usr/bin/env python3
"""Validate MyLocalHealth training/check-in CSV data.

This script is intentionally dependency-light so it can run in a clean
environment. It checks the structure and basic statistical health of a training
export before the data is used for model development.
"""

from __future__ import annotations

import argparse
import csv
import math
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import mean, median, pstdev
from typing import Iterable


REQUIRED_COLUMNS = [
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
    "model_score",
    "health_risk",
    "respiratory_risk",
    "aqi",
    "heat_risk",
    "uv_risk",
    "flu_activity",
    "covid_activity",
    "forecast_average_score",
    "forecast_peak_score",
    "equity_score",
    "places_chronic_burden_score",
]

BOOLEAN_COLUMNS = [
    "felt_impact",
    "respiratory_symptoms",
    "allergy_symptoms",
    "heat_symptoms",
    "headache_or_fatigue",
    "avoided_outdoor_activity",
    "used_rescue_medication",
    "missed_work_school_activity",
]

NUMERIC_COLUMNS = [
    "symptom_severity",
    "model_score",
    "aqi",
    "forecast_average_score",
    "forecast_peak_score",
    "equity_score",
    "places_chronic_burden_score",
    "places_asthma",
    "places_copd",
    "places_smoking",
    "places_obesity",
    "places_diabetes",
]

SCORE_COLUMNS = [
    "symptom_severity",
    "model_score",
    "forecast_average_score",
    "forecast_peak_score",
    "equity_score",
    "places_chronic_burden_score",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a MyLocalHealth model-training CSV export."
    )
    parser.add_argument("input", type=Path, help="CSV file to validate")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/data_validation_report.md"),
        help="Markdown report path",
    )
    return parser.parse_args()


def read_rows(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open(newline="", encoding="utf-8") as handle:
      reader = csv.DictReader(handle)
      rows = list(reader)
      return rows, reader.fieldnames or []


def as_float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def as_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    return None


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def pct(part: int, whole: int) -> str:
    if whole == 0:
        return "0.0%"
    return f"{(part / whole) * 100:.1f}%"


def numeric_summary(values: Iterable[float]) -> dict[str, float] | None:
    known = list(values)
    if not known:
        return None
    return {
        "min": min(known),
        "median": median(known),
        "mean": mean(known),
        "max": max(known),
        "sd": pstdev(known) if len(known) > 1 else 0.0,
    }


def format_number(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return f"{value:.2f}"


def validate(rows: list[dict[str, str]], fieldnames: list[str]) -> dict[str, object]:
    row_count = len(rows)
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in fieldnames]
    duplicate_checkins = row_count - len({row.get("checkin_id", "") for row in rows})
    missingness = {
        column: sum(1 for row in rows if row.get(column, "").strip() == "")
        for column in fieldnames
    }

    invalid_booleans = {
        column: sum(
            1
            for row in rows
            if row.get(column, "").strip() != "" and as_bool(row.get(column)) is None
        )
        for column in BOOLEAN_COLUMNS
        if column in fieldnames
    }

    invalid_numerics = {
        column: sum(
            1
            for row in rows
            if row.get(column, "").strip() != "" and as_float(row.get(column)) is None
        )
        for column in NUMERIC_COLUMNS
        if column in fieldnames
    }

    range_issues: dict[str, int] = {}
    for column in SCORE_COLUMNS:
        if column not in fieldnames:
            continue
        if column == "symptom_severity":
            low, high = 0, 10
        else:
            low, high = 0, 100
        range_issues[column] = sum(
            1
            for row in rows
            if (value := as_float(row.get(column))) is not None
            and not (low <= value <= high)
        )

    label_balance = {
        column: Counter(row.get(column, "").strip() or "missing" for row in rows)
        for column in BOOLEAN_COLUMNS
        if column in fieldnames
    }

    state_counts = Counter(row.get("state", "").strip() or "missing" for row in rows)
    zip_counts = Counter(row.get("zip_code", "").strip() or "missing" for row in rows)
    dates = [
        parsed
        for row in rows
        if (parsed := parse_datetime(row.get("checkin_created_at"))) is not None
    ]

    summaries = {
        column: numeric_summary(
            value
            for row in rows
            if (value := as_float(row.get(column))) is not None
        )
        for column in NUMERIC_COLUMNS
        if column in fieldnames
    }

    warnings: list[str] = []
    if row_count < 500:
        warnings.append("Dataset is small for model validation; treat metrics as unstable.")
    if missing_columns:
        warnings.append(f"Missing required columns: {', '.join(missing_columns)}.")
    if duplicate_checkins > 0:
        warnings.append(f"Found {duplicate_checkins} duplicate check-in IDs.")

    for column, counts in label_balance.items():
        positives = counts.get("true", 0)
        negatives = counts.get("false", 0)
        if positives == 0 or negatives == 0:
            warnings.append(f"{column} has only one observed class.")
        elif min(positives, negatives) / max(positives, negatives) < 0.1:
            warnings.append(f"{column} is highly imbalanced.")

    for column, count in range_issues.items():
        if count > 0:
            warnings.append(f"{column} has {count} out-of-range value(s).")

    return {
        "row_count": row_count,
        "fieldnames": fieldnames,
        "missing_columns": missing_columns,
        "duplicate_checkins": duplicate_checkins,
        "missingness": missingness,
        "invalid_booleans": invalid_booleans,
        "invalid_numerics": invalid_numerics,
        "range_issues": range_issues,
        "label_balance": label_balance,
        "state_counts": state_counts,
        "zip_counts": zip_counts,
        "dates": dates,
        "summaries": summaries,
        "warnings": warnings,
    }


def write_report(report: dict[str, object], input_path: Path, output_path: Path) -> None:
    row_count = int(report["row_count"])
    warnings = report["warnings"]
    dates = report["dates"]
    status = "Review needed" if warnings else "Passed basic validation"

    lines = [
        "# MyLocalHealth Data Validation Report",
        "",
        f"- Source file: `{input_path}`",
        f"- Rows: {row_count}",
        f"- Status: **{status}**",
    ]

    if dates:
        lines.append(
            f"- Check-in date range: {min(dates).date()} to {max(dates).date()}"
        )

    lines.extend(["", "## Warnings"])
    if warnings:
        lines.extend(f"- {warning}" for warning in warnings)
    else:
        lines.append("- No blocking issues found by the basic validator.")

    lines.extend(["", "## Label Balance"])
    label_balance: dict[str, Counter[str]] = report["label_balance"]  # type: ignore[assignment]
    for column, counts in label_balance.items():
        true_count = counts.get("true", 0)
        false_count = counts.get("false", 0)
        lines.append(
            f"- `{column}`: true={true_count} ({pct(true_count, row_count)}), "
            f"false={false_count} ({pct(false_count, row_count)})"
        )

    lines.extend(["", "## Numeric Summaries"])
    summaries = report["summaries"]  # type: ignore[assignment]
    for column, summary in summaries.items():
        if summary is None:
            lines.append(f"- `{column}`: no numeric values")
            continue
        lines.append(
            f"- `{column}`: min={format_number(summary['min'])}, "
            f"median={format_number(summary['median'])}, "
            f"mean={format_number(summary['mean'])}, max={format_number(summary['max'])}, "
            f"sd={format_number(summary['sd'])}"
        )

    lines.extend(["", "## Missingness"])
    missingness: dict[str, int] = report["missingness"]  # type: ignore[assignment]
    for column, count in sorted(missingness.items(), key=lambda item: item[1], reverse=True)[:20]:
        lines.append(f"- `{column}`: {count} missing ({pct(count, row_count)})")

    lines.extend(["", "## Geographic Coverage"])
    state_counts: Counter[str] = report["state_counts"]  # type: ignore[assignment]
    zip_counts: Counter[str] = report["zip_counts"]  # type: ignore[assignment]
    lines.append(
        "- Top states: "
        + ", ".join(f"{state}={count}" for state, count in state_counts.most_common(8))
    )
    lines.append(
        "- Top ZIPs: "
        + ", ".join(f"{zip_code}={count}" for zip_code, count in zip_counts.most_common(8))
    )

    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "This report checks data quality and training-readiness. It does not validate "
            "clinical accuracy. Synthetic rows should be used only for pipeline testing, "
            "not for real-world performance claims.",
            "",
        ]
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    rows, fieldnames = read_rows(args.input)
    report = validate(rows, fieldnames)
    write_report(report, args.input, args.output)
    print(f"Wrote validation report to {args.output}")


if __name__ == "__main__":
    main()
