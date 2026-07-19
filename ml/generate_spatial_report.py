"""Create a readable report from the BYM2 spatial model's artifacts.

``ml/spatial_model.py`` writes machine-readable diagnostics and a per-tract
lookup into ``ml/models/spatial``. This script turns those files into a short
Markdown report, following the same pattern as ``ml/generate_model_report.py``.

Run:
  python3 ml/generate_spatial_report.py
  python3 ml/generate_spatial_report.py --output docs/spatial-report.md

This report is informational. It does not validate the model clinically.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_DIAGNOSTICS_PATH = Path("ml/models/spatial/diagnostics.json")
DEFAULT_LOOKUP_PATH = Path("ml/models/spatial/tract_lookup.json")
DEFAULT_OUTPUT_PATH = Path("ml/spatial_model_report.md")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Markdown report from the BYM2 spatial model's diagnostics."
    )
    parser.add_argument(
        "--diagnostics",
        type=Path,
        default=DEFAULT_DIAGNOSTICS_PATH,
        help="Path to diagnostics.json.",
    )
    parser.add_argument(
        "--lookup",
        type=Path,
        default=DEFAULT_LOOKUP_PATH,
        help="Path to tract_lookup.json.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Markdown report output path.",
    )
    parser.add_argument(
        "--top-shifts",
        type=int,
        default=5,
        help="Number of tracts with the largest raw-vs-smoothed shift to show.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(
            f"Could not find {path}. Fit the spatial model first with "
            "`python3 ml/spatial_model.py`."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def number(value: Any, digits: int = 3) -> str:
    if value is None:
        return "n/a"
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return "n/a"


def readiness(diagnostics: dict[str, Any]) -> str:
    r_hat = diagnostics["bym2"]["r_hat_max"]
    ess = diagnostics["bym2"]["ess_bulk_min"]
    divergences = diagnostics["bym2"]["divergences"]
    if r_hat < 1.01 and ess > 400 and divergences == 0:
        return "clean fit"
    if r_hat < 1.05 and divergences == 0:
        return "usable, borderline ESS"
    return "needs more draws/tuning"


def build_markdown(
    diagnostics: dict[str, Any], lookup: dict[str, Any], top_shifts: int
) -> str:
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    region = diagnostics["region"]
    adjacency = diagnostics["adjacency"]
    bym2 = diagnostics["bym2"]
    baseline = diagnostics["non_spatial_baseline"]
    comparison = diagnostics["model_comparison_loo"]
    spatial_won = diagnostics["spatial_term_won_on_loo"]

    shifts = [
        {
            "tractfips": fips,
            "county": row["county"],
            "population": row["population"],
            "raw": row["raw_prevalence"],
            "smoothed": row["smoothed_prevalence"],
            "shift": row["smoothed_prevalence"] - row["raw_prevalence"],
        }
        for fips, row in lookup.items()
    ]
    largest_shifts = sorted(shifts, key=lambda item: abs(item["shift"]), reverse=True)[
        :top_shifts
    ]

    lines = [
        "# MyLocalHealth Spatial Model Report (BYM2)",
        "",
        f"Generated at: `{generated_at}`",
        f"Region: {', '.join(region['counties'])} counties, {region['state']} "
        f"({region['tract_count']} census tracts)",
        f"Target variable: `{diagnostics['target_variable']}` (CDC PLACES)",
        "",
        "> This report describes a Bayesian hierarchical spatial model (BYM2)",
        "> fit on public CDC PLACES / Census TIGERweb data. It is not clinical",
        "> validation and should not be presented as medical advice.",
        "",
        "## Why a spatial model",
        "",
        "Each census tract's diabetes prevalence estimate is itself a modeled",
        "small-area estimate (CDC PLACES: BRFSS survey data + county/state",
        "covariates), not a raw count -- smaller-population tracts carry more",
        "sampling noise. A BYM2 spatial model lets each tract's estimate borrow",
        "statistical strength from its geographic neighbors, the standard",
        "technique in disease mapping and small-area estimation.",
        "",
        "## Adjacency graph",
        "",
        f"- Edges from true tract-boundary contiguity (Census TIGERweb polygons): "
        f"{adjacency['edges_from_true_contiguity']}",
        f"- Bridge edges added to repair connectivity: "
        f"{adjacency['bridge_edges_added_for_connectivity']}",
        f"- BYM2 scaling factor (Morris et al. 2019): {number(adjacency['scaling_factor'], 4)}",
        "",
        "## Model fit diagnostics",
        "",
        "| Model | R-hat (max) | ESS bulk (min) | Divergences | Readiness |",
        "| --- | ---: | ---: | ---: | --- |",
        f"| BYM2 spatial | {number(bym2['r_hat_max'])} | {number(bym2['ess_bulk_min'], 0)} "
        f"| {bym2['divergences']} | {readiness(diagnostics)} |",
        f"| Non-spatial baseline | {number(baseline['r_hat_max'])} "
        f"| {number(baseline['ess_bulk_min'], 0)} | {baseline['divergences']} | -- |",
        "",
        "R-hat close to 1.0 and zero divergences indicate the MCMC sampler",
        "converged cleanly; this is a check on the fitting procedure, not on",
        "whether the spatial term is actually useful (see below).",
        "",
        "## Does the spatial term earn its keep?",
        "",
        "| Model | Rank | ELPD (PSIS-LOO) | Effective params | Weight |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for row in sorted(comparison, key=lambda item: item["rank"]):
        lines.append(
            f"| {row['index']} | {row['rank']} | {number(row['elpd'], 1)} "
            f"| {number(row['p'], 1)} | {number(row['weight'], 2)} |"
        )
    lines.append("")
    if spatial_won:
        lines.append(
            "The BYM2 spatial model has the higher expected log pointwise "
            "predictive density (ELPD) under leave-one-out cross-validation "
            "-- the spatial term measurably improves out-of-sample fit over "
            "the unstructured baseline on this data."
        )
    else:
        lines.append(
            "The non-spatial baseline scored at least as well on this "
            "comparison -- the spatial term did not clearly improve fit here. "
            "Reported honestly rather than tuned away: with this region/target "
            "combination, the unstructured random effect already captures "
            "most of the variation."
        )
    lines.append("")

    lines.extend(
        [
            "## Tracts with the largest raw-vs-smoothed shift",
            "",
            "| Tract FIPS | County | Population | Raw prevalence | Smoothed prevalence | Shift |",
            "| --- | --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for item in largest_shifts:
        lines.append(
            f"| {item['tractfips']} | {item['county']} | {item['population']} "
            f"| {number(item['raw'], 1)}% | {number(item['smoothed'], 1)}% "
            f"| {number(item['shift'], 2)} pp |"
        )
    lines.append("")
    lines.append(
        "The largest shifts are expected in lower-population tracts, where the "
        "raw small-area estimate carries the most sampling uncertainty and so "
        "gets pulled hardest toward its neighbors' values."
    )
    lines.append("")

    lines.extend(
        [
            "## Guardrails",
            "",
            "- Informational only; does not validate any estimate clinically.",
            "- CDC PLACES prevalence is itself a modeled small-area estimate, not",
            "  a raw survey count -- this model's uncertainty is relative to CDC's",
            "  already-modeled estimate, not to ground truth.",
            "- Adjacency reflects true tract boundary contiguity, not a distance",
            "  based approximation.",
            "- Only covers the pilot region listed above; all other ZIPs fall back",
            "  to the app's existing unmodified behavior.",
        ]
    )

    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    diagnostics = load_json(args.diagnostics)
    lookup = load_json(args.lookup)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        build_markdown(diagnostics, lookup, args.top_shifts), encoding="utf-8"
    )
    print(f"Wrote Markdown report: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
