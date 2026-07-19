"""Bayesian spatial model (BYM2) for CDC PLACES diabetes prevalence.

Demonstrates spatial random effects -- letting each census tract's estimate
borrow statistical strength from its geographic neighbors, the standard
technique behind small-area disease mapping (this is close to what CDC PLACES
itself does internally, one level up: county/state random effects over
BRFSS survey data). Pilot region: Orange + Durham + Chatham counties, NC
(contains ZIP 27514, this app's primary demo ZIP), chosen over Orange alone
because the wider urban/rural mix gives the spatial term more to actually do.

Data sources (both public, no API key required):
  - CDC PLACES 2025 (ArcGIS FeatureServer) -- tract-level diabetes prevalence,
    population, and CDC's own reported 95% CI. Same service already used by
    src/app/api/health-equity/route.ts.
  - Census TIGERweb (ArcGIS FeatureServer) -- tract polygon boundaries, used
    to compute true rook/queen adjacency (which tracts actually share a
    border), joined to the PLACES data by GEOID/tractfips.

This is informational and does not validate the spatial model clinically --
it demonstrates the modeling technique on real public-health data, following
the same honesty conventions as train_symptom_model.py (bootstrapped
uncertainty, explicit reporting of when a technique doesn't clearly help).

Run:
  python3 ml/spatial_model.py
  python3 ml/spatial_model.py --draws 1000 --tune 1000 --chains 2  (faster, coarser)
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

CDC_PLACES_URL = (
    "https://services1.arcgis.com/qTQ6qYkHpxlu0G82/arcgis/rest/services/"
    "CDC_Places_2025/FeatureServer/6/query"
)
TIGERWEB_URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/"
    "TIGERweb/Tracts_Blocks/MapServer/4/query"
)
STATE_ABBR = "NC"
STATE_FIPS = "37"
COUNTIES = ["Orange", "Durham", "Chatham"]
TARGET_FIELD = "diabetes_crudeprev_NUM"
CI_FIELD = "diabetes_crude95ci"
MODELS_DIR = Path(__file__).resolve().parent / "models" / "spatial"


def _fetch_json(url: str, params: dict[str, str]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{url}?{query}", timeout=30) as response:
        return json.loads(response.read())


def fetch_cdc_places() -> pd.DataFrame:
    """One tract per row: tractfips, county, population, prevalence, CI string."""
    counties_clause = ",".join(f"'{c}'" for c in COUNTIES)
    data = _fetch_json(
        CDC_PLACES_URL,
        {
            "where": f"stateabbr='{STATE_ABBR}' AND countyname IN ({counties_clause})",
            "outFields": (
                f"countyname,tractfips,totalpopulation_NUM,{TARGET_FIELD},{CI_FIELD}"
            ),
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "json",
        },
    )
    rows = []
    for feature in data.get("features", []):
        attrs = feature["attributes"]
        geom = feature.get("geometry") or {}
        rows.append(
            {
                "tractfips": attrs["tractfips"],
                "county": attrs["countyname"],
                "population": attrs["totalpopulation_NUM"],
                "prevalence": attrs[TARGET_FIELD],
                "ci_raw": attrs[CI_FIELD],
                "lon": geom.get("x"),
                "lat": geom.get("y"),
            }
        )
    frame = pd.DataFrame(rows).dropna(subset=["prevalence", "ci_raw"])
    return frame.reset_index(drop=True)


def fetch_tigerweb_polygons(tractfips: list[str]) -> dict[str, list[list[list[float]]]]:
    """GEOID -> polygon rings (list of rings, each a list of [x, y] vertices)."""
    county_fips = sorted({fips[2:5] for fips in tractfips})
    county_clause = ",".join(f"'{c}'" for c in county_fips)
    data = _fetch_json(
        TIGERWEB_URL,
        {
            "where": f"STATE='{STATE_FIPS}' AND COUNTY IN ({county_clause})",
            "outFields": "GEOID",
            "returnGeometry": "true",
            "geometryPrecision": "6",
            "outSR": "4326",
            "f": "json",
        },
    )
    polygons: dict[str, list[list[list[float]]]] = {}
    for feature in data.get("features", []):
        geoid = feature["attributes"]["GEOID"]
        rings = feature.get("geometry", {}).get("rings", [])
        polygons[geoid] = rings
    return polygons


def build_adjacency(
    tractfips: list[str], polygons: dict[str, list[list[list[float]]]]
) -> np.ndarray:
    """True rook/queen contiguity: tracts sharing a boundary vertex are
    neighbors. Vertices are bucketed to a coordinate grid (rounded to 6
    decimal places, ~11cm) since adjacent tracts sourced from the same
    TIGER/Line boundaries share exact vertex coordinates along their common
    border -- no shapely/geopandas needed for this."""
    n = len(tractfips)
    buckets: dict[tuple[float, float], set[int]] = {}
    for index, fips in enumerate(tractfips):
        for ring in polygons.get(fips, []):
            for x, y in ring:
                key = (round(x, 6), round(y, 6))
                buckets.setdefault(key, set()).add(index)

    adjacency = np.zeros((n, n), dtype=int)
    for indices in buckets.values():
        if len(indices) < 2:
            continue
        for i in indices:
            for j in indices:
                if i != j:
                    adjacency[i, j] = 1
    np.fill_diagonal(adjacency, 0)
    return adjacency


def repair_connectivity(
    adjacency: np.ndarray, lon: np.ndarray, lat: np.ndarray
) -> tuple[np.ndarray, int]:
    """ICAR requires a single connected graph. Bridges any isolated
    components by connecting the closest pair of tracts (by centroid
    distance) across components -- repeated until one component remains.
    Returns the repaired matrix and how many bridge edges were added."""
    n = adjacency.shape[0]
    bridges_added = 0

    def components() -> list[int]:
        labels = [-1] * n
        current = 0
        for start in range(n):
            if labels[start] != -1:
                continue
            stack = [start]
            labels[start] = current
            while stack:
                node = stack.pop()
                for neighbor in np.nonzero(adjacency[node])[0]:
                    if labels[neighbor] == -1:
                        labels[neighbor] = current
                        stack.append(neighbor)
            current += 1
        return labels

    labels = components()
    while len(set(labels)) > 1:
        comp_a = labels[0]
        group_a = [i for i, label in enumerate(labels) if label == comp_a]
        group_b = [i for i, label in enumerate(labels) if label != comp_a]

        best_pair = None
        best_dist = float("inf")
        for i in group_a:
            for j in group_b:
                dist = (lon[i] - lon[j]) ** 2 + (lat[i] - lat[j]) ** 2
                if dist < best_dist:
                    best_dist = dist
                    best_pair = (i, j)

        i, j = best_pair
        adjacency[i, j] = 1
        adjacency[j, i] = 1
        bridges_added += 1
        labels = components()

    return adjacency, bridges_added


def compute_scaling_factor(adjacency: np.ndarray) -> float:
    """BYM2's scaling factor (Morris et al. 2019, "Bayesian hierarchical
    spatial models: Implementing the Besag York Mollié model in Stan") --
    the geometric mean of the diagonal of the ICAR precision matrix's
    generalized inverse. Makes rho interpretable as "share of variance from
    the spatial component" regardless of graph size/density."""
    degree = np.diag(adjacency.sum(axis=1))
    laplacian = degree - adjacency
    # The ICAR precision matrix is singular (zero-sum constraint over the
    # whole graph, a one-dimensional null space along the constant vector).
    # The Moore-Penrose pseudo-inverse correctly projects that null space
    # out rather than needing an ad hoc jitter (this is what INLA's
    # `inla.scale.model` / the R `scale_c` helper used in Morris et al. do).
    precision_pinv = np.linalg.pinv(laplacian)
    return float(np.exp(np.mean(np.log(np.diag(precision_pinv)))))


def parse_ci(ci_raw: str) -> tuple[float, float]:
    numbers = re.findall(r"-?\d+\.?\d*", ci_raw)
    return float(numbers[0]), float(numbers[1])


def to_logit_scale(frame: pd.DataFrame) -> pd.DataFrame:
    proportions = frame["prevalence"] / 100
    ci_bounds = frame["ci_raw"].apply(parse_ci)
    lower = ci_bounds.apply(lambda pair: pair[0]) / 100
    upper = ci_bounds.apply(lambda pair: pair[1]) / 100

    # CDC PLACES prevalence is itself a modeled small-area estimate (BRFSS +
    # county covariates + state/county random effects), not a raw sample
    # count -- treating it as a Binomial count would assert a sampling SE
    # that shrinks with population size, which CDC's own reported CIs don't
    # actually do. Instead: back out each tract's SE from CDC's reported CI,
    # propagate to the logit scale via the delta method, and use a Normal
    # measurement-error likelihood there.
    se_proportion = (upper - lower) / (2 * 1.96)
    se_logit = se_proportion / (proportions * (1 - proportions))

    frame = frame.copy()
    frame["proportion"] = proportions
    frame["logit"] = np.log(proportions / (1 - proportions))
    frame["se_logit"] = se_logit
    frame["ci_lower_pct"] = lower * 100
    frame["ci_upper_pct"] = upper * 100
    return frame


def fit_bym2(
    logit_obs: np.ndarray,
    se_logit: np.ndarray,
    adjacency: np.ndarray,
    scaling_factor: float,
    draws: int,
    tune: int,
    chains: int,
    seed: int,
):
    import pymc as pm

    n = len(logit_obs)
    coords = {"tract": np.arange(n)}
    with pm.Model(coords=coords) as model:
        intercept = pm.Normal("intercept", mu=0, sigma=2)
        sigma = pm.HalfNormal("sigma", sigma=1)
        rho = pm.Beta("rho", alpha=1, beta=1)
        phi = pm.ICAR("phi", W=adjacency, dims="tract")
        theta = pm.Normal("theta", mu=0, sigma=1, dims="tract")
        convolved = pm.math.sqrt(rho / scaling_factor) * phi + pm.math.sqrt(1 - rho) * theta
        mu = pm.Deterministic("mu", intercept + sigma * convolved, dims="tract")
        pm.Normal("obs", mu=mu, sigma=se_logit, observed=logit_obs, dims="tract")
        idata = pm.sample(
            draws=draws,
            tune=tune,
            chains=chains,
            random_seed=seed,
            target_accept=0.95,
            progressbar=False,
        )
        pm.compute_log_likelihood(idata)
    return model, idata


def fit_baseline(
    logit_obs: np.ndarray,
    se_logit: np.ndarray,
    n: int,
    draws: int,
    tune: int,
    chains: int,
    seed: int,
):
    """Same model with the spatial term switched off (rho fixed at 0) --
    unstructured random effect only. Comparing against this is what tells us
    whether the spatial term earns its keep, rather than assuming it does."""
    import pymc as pm

    coords = {"tract": np.arange(n)}
    with pm.Model(coords=coords) as model:
        intercept = pm.Normal("intercept", mu=0, sigma=2)
        sigma = pm.HalfNormal("sigma", sigma=1)
        theta = pm.Normal("theta", mu=0, sigma=1, dims="tract")
        mu = pm.Deterministic("mu", intercept + sigma * theta, dims="tract")
        pm.Normal("obs", mu=mu, sigma=se_logit, observed=logit_obs, dims="tract")
        idata = pm.sample(
            draws=draws,
            tune=tune,
            chains=chains,
            random_seed=seed,
            target_accept=0.95,
            progressbar=False,
        )
        pm.compute_log_likelihood(idata)
    return model, idata


def summarize_diagnostics(idata, label: str) -> dict[str, Any]:
    import arviz as az

    summary = az.summary(idata, var_names=["intercept", "sigma", "rho"], round_to=4) if (
        "rho" in idata.posterior
    ) else az.summary(idata, var_names=["intercept", "sigma"], round_to=4)
    divergences = int(idata.sample_stats.diverging.sum()) if "diverging" in idata.sample_stats else 0
    return {
        "label": label,
        "r_hat_max": float(summary["r_hat"].max()),
        "ess_bulk_min": float(summary["ess_bulk"].min()),
        "divergences": divergences,
        "per_parameter": summary.reset_index().to_dict(orient="records"),
    }


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def _sanitize_for_json(value: Any) -> Any:
    """`json.dumps` silently writes NaN/Infinity as bare (invalid) JSON
    tokens rather than raising -- ArviZ's comparison table has a genuine NaN
    for `p_worse` on the top-ranked model ("probability it's worse than
    itself" is undefined), so this converts non-finite floats to null."""
    if isinstance(value, float) and not np.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--draws", type=int, default=2000)
    parser.add_argument("--tune", type=int, default=2000)
    parser.add_argument("--chains", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    print(f"Fetching CDC PLACES data for {', '.join(COUNTIES)} counties, {STATE_ABBR}...")
    places = fetch_cdc_places()
    print(f"  {len(places)} tracts fetched.")

    print("Fetching TIGERweb tract polygon boundaries...")
    polygons = fetch_tigerweb_polygons(places["tractfips"].tolist())
    missing_geometry = [fips for fips in places["tractfips"] if fips not in polygons]
    if missing_geometry:
        print(f"  WARNING: {len(missing_geometry)} tracts had no TIGERweb geometry, dropping them.")
        places = places[~places["tractfips"].isin(missing_geometry)].reset_index(drop=True)

    print("Building adjacency graph from true tract boundaries...")
    adjacency = build_adjacency(places["tractfips"].tolist(), polygons)
    edge_count = int(adjacency.sum() / 2)
    print(f"  {edge_count} adjacency edges before connectivity repair.")

    adjacency, bridges_added = repair_connectivity(
        adjacency, places["lon"].to_numpy(), places["lat"].to_numpy()
    )
    if bridges_added:
        print(f"  Added {bridges_added} bridge edge(s) to connect isolated component(s).")
    else:
        print("  Graph was already fully connected -- no repair needed.")

    scaling_factor = compute_scaling_factor(adjacency)
    print(f"  BYM2 scaling factor: {scaling_factor:.4f}")

    frame = to_logit_scale(places)

    print(f"\nFitting BYM2 spatial model ({args.chains} chains x {args.draws} draws)...")
    _, bym2_idata = fit_bym2(
        frame["logit"].to_numpy(),
        frame["se_logit"].to_numpy(),
        adjacency,
        scaling_factor,
        args.draws,
        args.tune,
        args.chains,
        args.seed,
    )
    bym2_diagnostics = summarize_diagnostics(bym2_idata, "bym2_spatial")
    print(
        f"  R-hat max: {bym2_diagnostics['r_hat_max']:.3f}, "
        f"ESS min: {bym2_diagnostics['ess_bulk_min']:.0f}, "
        f"divergences: {bym2_diagnostics['divergences']}"
    )

    print(f"\nFitting non-spatial baseline ({args.chains} chains x {args.draws} draws)...")
    _, baseline_idata = fit_baseline(
        frame["logit"].to_numpy(),
        frame["se_logit"].to_numpy(),
        len(frame),
        args.draws,
        args.tune,
        args.chains,
        args.seed,
    )
    baseline_diagnostics = summarize_diagnostics(baseline_idata, "non_spatial_baseline")
    print(
        f"  R-hat max: {baseline_diagnostics['r_hat_max']:.3f}, "
        f"ESS min: {baseline_diagnostics['ess_bulk_min']:.0f}, "
        f"divergences: {baseline_diagnostics['divergences']}"
    )

    import arviz as az

    print("\nComparing models (PSIS-LOO)...")
    comparison = az.compare(
        {"bym2_spatial": bym2_idata, "non_spatial_baseline": baseline_idata}
    )
    print(comparison[["rank", "elpd", "p", "weight"]].to_string())
    spatial_won = comparison.loc["bym2_spatial", "rank"] == 0

    posterior_mu = bym2_idata.posterior["mu"]
    mu_mean = posterior_mu.mean(dim=("chain", "draw")).to_numpy()
    mu_lower = posterior_mu.quantile(0.025, dim=("chain", "draw")).to_numpy()
    mu_upper = posterior_mu.quantile(0.975, dim=("chain", "draw")).to_numpy()

    smoothed_prevalence = sigmoid(mu_mean) * 100
    smoothed_lower = sigmoid(mu_lower) * 100
    smoothed_upper = sigmoid(mu_upper) * 100

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    lookup = {}
    for i, row in frame.iterrows():
        lookup[row["tractfips"]] = {
            "county": row["county"],
            "population": int(row["population"]),
            "raw_prevalence": round(float(row["prevalence"]), 2),
            "raw_ci_lower": round(float(row["ci_lower_pct"]), 2),
            "raw_ci_upper": round(float(row["ci_upper_pct"]), 2),
            "smoothed_prevalence": round(float(smoothed_prevalence[i]), 2),
            "smoothed_ci_lower": round(float(smoothed_lower[i]), 2),
            "smoothed_ci_upper": round(float(smoothed_upper[i]), 2),
        }
    (MODELS_DIR / "tract_lookup.json").write_text(json.dumps(lookup, indent=2))

    diagnostics = {
        "region": {"state": STATE_ABBR, "counties": COUNTIES, "tract_count": len(frame)},
        "target_variable": "diabetes_crudeprev_NUM",
        "adjacency": {
            "edges_from_true_contiguity": edge_count,
            "bridge_edges_added_for_connectivity": bridges_added,
            "scaling_factor": scaling_factor,
        },
        "bym2": bym2_diagnostics,
        "non_spatial_baseline": baseline_diagnostics,
        "model_comparison_loo": comparison.reset_index().to_dict(orient="records"),
        "spatial_term_won_on_loo": bool(spatial_won),
        "caveats": [
            "Informational only. Does not validate the model clinically.",
            "CDC PLACES prevalence values are themselves modeled small-area "
            "estimates (BRFSS + county covariates), not raw counts -- this "
            "model's uncertainty is relative to CDC's already-modeled "
            "estimate, not to ground truth.",
            "Adjacency is derived from true tract boundary contiguity "
            "(Census TIGERweb), not a distance-based approximation.",
        ],
    }
    (MODELS_DIR / "diagnostics.json").write_text(
        json.dumps(_sanitize_for_json(diagnostics), indent=2)
    )

    print(f"\nWrote {MODELS_DIR / 'tract_lookup.json'}")
    print(f"Wrote {MODELS_DIR / 'diagnostics.json'}")
    print(
        f"\nSpatial term {'won' if spatial_won else 'did NOT win'} on PSIS-LOO "
        f"comparison against the non-spatial baseline."
    )


if __name__ == "__main__":
    main()
