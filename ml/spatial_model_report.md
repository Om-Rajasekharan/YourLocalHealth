# MyLocalHealth Spatial Model Report (BYM2)

Generated at: `2026-07-18T18:50:51+00:00`
Region: Orange, Durham, Chatham counties, NC (128 census tracts)
Target variable: `diabetes_crudeprev_NUM` (CDC PLACES)

> This report describes a Bayesian hierarchical spatial model (BYM2)
> fit on public CDC PLACES / Census TIGERweb data. It is not clinical
> validation and should not be presented as medical advice.

## Why a spatial model

Each census tract's diabetes prevalence estimate is itself a modeled
small-area estimate (CDC PLACES: BRFSS survey data + county/state
covariates), not a raw count -- smaller-population tracts carry more
sampling noise. A BYM2 spatial model lets each tract's estimate borrow
statistical strength from its geographic neighbors, the standard
technique in disease mapping and small-area estimation.

## Adjacency graph

- Edges from true tract-boundary contiguity (Census TIGERweb polygons): 368
- Bridge edges added to repair connectivity: 0
- BYM2 scaling factor (Morris et al. 2019): 0.3535

## Model fit diagnostics

| Model | R-hat (max) | ESS bulk (min) | Divergences | Readiness |
| --- | ---: | ---: | ---: | --- |
| BYM2 spatial | 1.010 | 258 | 0 | usable, borderline ESS |
| Non-spatial baseline | 1.002 | 763 | 0 | -- |

R-hat close to 1.0 and zero divergences indicate the MCMC sampler
converged cleanly; this is a check on the fitting procedure, not on
whether the spatial term is actually useful (see below).

## Does the spatial term earn its keep?

| Model | Rank | ELPD (PSIS-LOO) | Effective params | Weight |
| --- | ---: | ---: | ---: | ---: |
| bym2_spatial | 0 | 50.0 | 104.2 | 0.74 |
| non_spatial_baseline | 1 | 42.0 | 107.2 | 0.26 |

The BYM2 spatial model has the higher expected log pointwise predictive density (ELPD) under leave-one-out cross-validation -- the spatial term measurably improves out-of-sample fit over the unstructured baseline on this data.

## Tracts with the largest raw-vs-smoothed shift

| Tract FIPS | County | Population | Raw prevalence | Smoothed prevalence | Shift |
| --- | --- | ---: | ---: | ---: | ---: |
| 37063002009 | Durham | 4800 | 18.7% | 17.4% | -1.27 pp |
| 37063001304 | Durham | 2781 | 19.8% | 18.9% | -0.85 pp |
| 37063001301 | Durham | 1432 | 20.3% | 19.5% | -0.81 pp |
| 37063001100 | Durham | 4151 | 18.1% | 17.5% | -0.64 pp |
| 37063001802 | Durham | 7548 | 16.1% | 15.6% | -0.50 pp |

The largest shifts are expected in lower-population tracts, where the raw small-area estimate carries the most sampling uncertainty and so gets pulled hardest toward its neighbors' values.

## Guardrails

- Informational only; does not validate any estimate clinically.
- CDC PLACES prevalence is itself a modeled small-area estimate, not
  a raw survey count -- this model's uncertainty is relative to CDC's
  already-modeled estimate, not to ground truth.
- Adjacency reflects true tract boundary contiguity, not a distance
  based approximation.
- Only covers the pilot region listed above; all other ZIPs fall back
  to the app's existing unmodified behavior.
