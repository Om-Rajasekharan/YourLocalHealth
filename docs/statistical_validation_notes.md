# MyLocalHealth Statistical Validation Notes

This document summarizes how to describe the current model honestly during a
review or demo. It covers four separate statistical components -- the
symptom-risk ML pipeline, the Bayesian spatial model, the personalized
environment-symptom correlation, and the personal Bayesian risk calibration
that chains the last two together -- plus an independent correctness
cross-check. Each has a different evidence standard, and this doc is
explicit about which is which.

## Current Status

MyLocalHealth is an informational public-health dashboard. It combines local
signals from air quality, weather, respiratory illness activity, wastewater,
health-equity context, and optional user profile/check-in data.

The current dashboard score is a transparent rule-based index. It is useful for
explainability and product testing, but it is not a clinically validated
prediction model.

The symptom signal layer is experimental. It estimates relative self-reported
symptom signals from the available context. It should not be described as a
diagnosis, disease forecast, or validated probability of becoming ill.

These components have real evidence behind them today, but each a different
kind: the symptom-risk models are validated on synthetic data only (real
performance is unknown); the Bayesian spatial model is fit and validated on
real public CDC/Census data, but has nothing to do with any individual user;
the environment-symptom correlation runs on a real user's own real
check-ins, but only ever describes that one person, never the population;
and the personal calibration combines a (currently mostly theoretical,
data-permitting) population baseline with that same person's own evidence.
None of these should be conflated with the others when describing this
project.

## Forecast Statistics

The 24-hour forecast now reports descriptive statistics over the hourly risk
score distribution:

- mean and median hourly score
- sample standard deviation
- coefficient of variation
- min/max range
- typical variability band, calculated as mean plus/minus one sample standard
  deviation
- peak-hour z-score, calculated as `(peak score - mean) / standard deviation`
- count of high-risk and moderate-risk hours
- hourly signal completeness
- Pearson correlations between the hourly score and each raw forecast driver

These statistics summarize the forecast window and are not causal estimates.
The driver correlations show co-movement across the next 24 hours, not proof
that a driver caused the score to change.

## Outcome Labels

The app can save two linked records:

- `health_snapshots`: the local risk context shown to a user at search time
- `symptom_checkins`: optional self-reported outcomes after exposure

This creates a future training set where the predictors are the environmental,
public-health, equity, forecast, and profile signals, and the labels are
self-reported symptoms or behavior changes.

## ML Training Guardrails

The Python training script uses:

- five candidate model types raced against each other per target: logistic
  regression, random forest, extra trees, gradient boosting, and XGBoost
  (XGBoost degrades gracefully if its native OpenMP dependency isn't
  available, rather than failing training entirely)
- hyperparameters for the four tree/boosting candidates aren't hand-guessed
  -- they're the consensus from running `--tune` (RandomizedSearchCV,
  scored on ROC AUC) against three targets spanning the dataset's range of
  class balance (~80%, ~35%, ~5% positive). `--tune` is a manual/offline
  tool (see `train_symptom_model.py --help`), not something that runs on
  every training call, since a full search on every push would make CI --
  which retrains from scratch every time -- far too slow
- stratified train/test splitting
- model selection by cross-validation on the training split only
- untouched holdout metrics
- ROC AUC, average precision, balanced accuracy, precision, recall, F1, Brier
  score, and confusion matrix
- feature importance export for transparency
- a `DummyClassifier(strategy="prior")` baseline, evaluated through the same
  cross-validation and holdout path as every real candidate, so "the model
  beats guessing the average rate" is a checked number (`baseline` in
  `ml/models/<target>_metrics.json`) rather than an assumption
- calibration reporting on the holdout split (`holdout_metrics.calibration`):
  predicted-probability bins compared against observed outcome rate, plus an
  Expected Calibration Error summary. This matters more than accuracy-style
  metrics for this product specifically, since the app only ever shows users a
  probability, never a thresholded yes/no decision.
- calibration *correction*, not just measurement: a Platt-scaling calibrator
  (a 1D logistic regression mapping raw probability to observed outcome,
  fit on cross-validated out-of-fold probabilities so it never sees the same
  rows twice) is saved per target (`ml/models/<target>_calibrator.joblib`)
  and applied by `ml/serve_models.py` before a probability is returned. Both
  `holdout_metrics.calibration` (raw) and `holdout_metrics.calibrated.calibration`
  (after Platt scaling) are reported so the improvement is provable, not
  assumed. Platt scaling preserves rank order, so ROC AUC is identical before
  and after -- only Brier score and calibration error change.
- 95% bootstrap confidence intervals (`holdout_metrics.roc_auc_ci95`,
  `holdout_metrics.brier_score_ci95`) from 1,000 resamples of the holdout
  split, so a metric is reported as a range, not a single number that implies
  more precision than a few-hundred-row holdout can support.
- permutation importance (`ml/models/<target>_permutation_importance.csv`,
  `permutation_importance` in the metrics JSON) alongside the existing
  built-in feature importance. Built-in importance (impurity-based for tree
  models, coefficient magnitude for logistic regression) is known to be
  biased toward high-cardinality one-hot-encoded categorical features;
  permutation importance instead measures the actual holdout ROC AUC drop
  when a feature is shuffled, and is comparable across all five candidate
  model types.

`ml/generate_model_report.py` surfaces all of this in its "Trained Targets",
"Baseline Comparison & Calibration", and "Permutation Importance" sections.
As of the last synthetic-data run: every target shows positive ROC AUC lift
over baseline (0.08-0.25) in this particular run, though `missed_work_school_activity`
(5.2% positive rate) has shown a *negative* lift on other random draws, and
its 95% ROC AUC CI dips below 0.5 -- both honestly reported rather than
hidden. Calibration correction produced large, real improvements: e.g.
`headache_or_fatigue`'s Expected Calibration Error dropped from ~0.31 (raw)
to ~0.01 (calibrated) in the same run, meaning its raw probabilities were
badly overconfident and are now corrected before being served.

Synthetic check-ins are for pipeline testing only. Synthetic performance should
not be reported as real-world accuracy.

## Bayesian Spatial Model (BYM2)

`ml/spatial_model.py` fits a genuine Bayesian hierarchical spatial model --
BYM2 (Besag-York-Mollié, Riebler et al. 2016 parameterization) -- over CDC
PLACES diabetes prevalence for a 128-census-tract pilot region (Orange,
Durham, and Chatham counties, NC; ZIP 27514 sits inside it). Unlike the
symptom-risk models above, this is fit and validated on real public data
(CDC PLACES, Census TIGERweb), not synthetic rows -- but it says nothing
about any individual user, and it is intentionally offline/precomputed, not
served live per-request.

Design choices, and why:

- **Adjacency is true polygon contiguity, not a distance approximation.**
  Rook/queen adjacency is computed directly from Census TIGERweb tract
  boundary ring vertices (128 tracts, 368 edges from true shared borders in
  the production run -- the graph was already fully connected, so no
  connectivity-repair bridge edges were needed).
- **Likelihood is a Normal measurement-error model on the logit scale, not
  Binomial.** CDC PLACES prevalence is itself the output of a separate
  small-area model (BRFSS + county/state covariates), not a raw sample
  count. Treating it as a Binomial count would assert a sampling SE that
  shrinks with tract population, which CDC's own reported confidence
  intervals don't do. Instead, each tract's SE is backed out of CDC's
  reported 95% CI and propagated to the logit scale via the delta method.
- **BYM2's mixing weight and scaling factor follow the literature, not a
  guess.** PyMC's `pm.ICAR` provides the spatially-structured component;
  the scaling factor (so the mixing weight `rho` is interpretable as "share
  of variance that's spatial") is the geometric mean of the diagonal of the
  Moore-Penrose pseudo-inverse of the graph Laplacian, per Morris et al.
  2019 -- not a naive jittered matrix inverse, which was tried first and
  gave a nonsensical scaling factor (~71,000 instead of the correct 0.35)
  before being caught and fixed.
- **A non-spatial baseline (`rho` fixed at 0) is fit for honest comparison,**
  not assumed to lose.

Production run results (4 chains x 2,000 draws, seed 42): both models sampled
cleanly (R-hat 1.010 spatial / 1.002 baseline, zero divergences either way).
On PSIS-LOO cross-validation, the spatial model won (74% vs. 26% model
weight) -- the spatial term measurably improved out-of-sample fit here, but
this was checked, not assumed; a "the spatial term didn't help" result would
have been reported just as directly. Full diagnostics:
`ml/models/spatial/diagnostics.json`; full report: `ml/spatial_model_report.md`.

This only covers the 128-tract pilot region. Every other ZIP code falls back
to the app's unmodified CDC PLACES display -- there is no spatial smoothing
outside the pilot region, and the UI only shows the smoothed estimate when
one exists.

## Personalized Environment-Symptom Correlation

`src/services/symptomEnvironmentCorrelation.ts` is the one component of the
three that runs on a real signed-in user's own real data -- it correlates
that user's logged symptom severity against the environmental conditions
(AQI, pollutant/heat/UV risk, allergy forecast score) recorded at the time of
each of their check-ins, joined via the existing `ml_feature_snapshots` view.
No synthetic data and no other users are involved.

- **Spearman rank correlation, not Pearson.** Several of the factors
  (pollutant/heat/UV risk) are ordinal categories (Low/Moderate/High), not
  continuous values, so rank correlation is the honest choice -- it doesn't
  assume linearity or a numeric scale that isn't really there.
- **Significance is a permutation test, not a closed-form p-value.** Spearman
  rho has no simple standard-error formula at small, real-world per-user
  sample sizes, so significance is estimated directly: the outcome is
  reshuffled relative to the factor 2,000 times, and the p-value is how
  often chance alone produces a correlation at least this strong. This is
  the same logic as the permutation importance already used in
  `ml/train_symptom_model.py`, just applied to a correlation instead of a
  feature-importance drop.
- **The math is unit-tested independently of any live data,** not just wired
  up and trusted: 14 tests in
  `src/services/symptomEnvironmentCorrelation.test.ts` check that known
  monotonic relationships recover rho near +/-1, unrelated shuffles produce
  p > 0.05, and tie-handling in the ranking is exact.
- **A minimum of 10 check-ins is required before reporting anything.** Below
  that threshold the UI shows an honest "log N more check-ins" message
  instead of a correlation computed from too few points to mean anything.

This never claims causation, only correlates two things the user themselves
logged. It also never pools across users -- one person's pattern is never
used to describe anyone else's.

## Personal Bayesian Risk Calibration

This is the feature that actually chains the spatial model and the personal
correlation together: for whichever factor the correlation feature above
already identified as a user's `topFactor`, `personal-risk-calibration`
computes a genuine two-level Bayesian hierarchy -- a precision-weighted
blend of "what the whole population shows" and "what this specific person's
own check-ins show" -- via exact conjugate Normal-Normal updating (the same
textbook update used throughout Bayesian statistics, not an approximation).

- **The user's own slope.** `src/services/personalRiskCalibration.ts`
  computes an ordinary least squares regression slope of symptom severity on
  the `topFactor`'s value, from that user's own check-ins only, client-side,
  respecting the same RLS rules as every other per-user feature. Requires
  at least 10 check-ins (matching the correlation feature's bar) and a
  minimum sample variance in the factor itself -- a factor that's barely
  changed across a user's check-ins (e.g. AQI logged "Low" every day) is
  refused rather than silently producing a near-zero standard error, which
  would otherwise inflate personal "trust" to nearly 100% for the wrong
  reason (no real signal, not strong signal).
- **The population baseline.** `src/app/api/personal-risk-calibration/route.ts`
  computes the same OLS slope, pooled across *all* users' check-ins for
  that factor. This is the first feature in the app that needs to read
  across users, so it's the first to use a service-role Supabase client
  (`src/lib/supabaseServiceRoleClient.ts`, server-only, bypasses Row-Level
  Security) -- but the only thing that ever leaves this boundary is an
  aggregate slope/SE/row-count, never any individual's row. This pooled
  estimate is only trusted once there are at least 30 pooled rows *and*
  meaningful variance in the pooled factor values; below either bar
  (including simply not having `SUPABASE_SERVICE_ROLE_KEY` configured,
  which is the actual state today), the route falls back to a neutral
  prior (mean zero, variance scaled to 4x the user's own variance, i.e. a
  prior standard deviation of 2x the user's own SE) rather than a fabricated
  population number. This fallback is the realistic path right now, and is
  reported honestly (`populationSource: "neutral_fallback"`), not hidden.
- **The combination.** Exact conjugate Normal-Normal Bayesian update:
  `posteriorPrecision = 1/priorVariance + 1/userSE^2`, with the posterior
  mean and the "trust weight" (the share of posterior precision coming from
  the user's own data) computed directly from that. This is what visibly
  shifts from mostly-population toward mostly-personal as a user logs more
  check-ins -- the number the UI surfaces as "we're weighting your own
  check-in history at X%."
- **Both the OLS slope math and the conjugate update are unit-tested
  independently of any live data**, all 10 in
  `src/services/personalRiskCalibration.test.ts`: exact recovery of known
  slopes, refusal below the sample-size and variance floors, an
  equal-precision 50/50 split, convergence to the user's own slope as their
  SE shrinks, and convergence to the prior as their SE grows.

Two honesty gaps worth naming explicitly, both surfaced directly in the UI,
not just in code comments:

- **Winner's-curse bias.** The correlation feature picks `topFactor` as the
  strongest of five tested per user -- that selection itself inflates the
  apparent strength of whatever wins, and this feature builds directly on
  top of that already-optimistic estimate.
- **Simpson's-paradox risk in the pooled baseline.** The population estimate
  is a simple marginal regression across all users, not a true multilevel
  model with per-user random effects. Pooling this way can produce a slope
  that doesn't match what's true for most individuals if there's
  between-user confounding. It's a real limitation, not just a caveat for
  its own sake -- upgrading to a true multilevel/random-effects population
  model is the natural next step once real check-in volume justifies it.

The `trustWeightPct` this feature surfaces is explicitly *not* a confidence
or accuracy score -- it's "how much this estimate leans on your own data
versus the general population," and should always be described that way.

## Independent Correctness Cross-Check (WASM)

Separately from the statistical work above, `src/lib/wasmRiskKernel.ts`
recomputes the dashboard's weighted risk score using an independent C++
implementation (`native/wasm/risk_kernel_wasm.cpp`) compiled to WebAssembly,
and compares it against the TypeScript result on every request. This is a
software-correctness check (do two independent implementations of the same
arithmetic agree), not a statistical validation -- but a persistent
disagreement would indicate a real bug in one of the two implementations, so
it's logged as a distinct, searchable OpenTelemetry event
(`wasm_risk_kernel.disagreement`) rather than silently ignored. A WASM
failure never blocks or changes the served score; it's a signal, not a gate.

## Recommended Next Validation Steps

1. Collect enough real check-ins across multiple ZIP codes and seasons.
2. Separate synthetic rows from real user labels in all reports.
3. Stratify performance by geography, season, respiratory-virus period, and
   data-confidence level.
4. Test whether adding equity and chronic-disease context improves out-of-sample
   performance over environmental signals alone.
5. Add prospective validation before making strong prediction claims.
6. Keep all user-facing wording informational and avoid medical advice.
7. Revisit Platt scaling vs. isotonic regression for calibration once real
   check-in volume is large enough per target -- isotonic is more flexible
   but needs more data per probability bin to avoid overfitting, which is why
   Platt scaling (parametric, robust on small samples) was chosen for now.
8. Compare built-in vs. permutation feature importance rankings once real
   data accumulates; a persistent disagreement between the two is a signal
   worth investigating before trusting either for product claims.
9. Extend the BYM2 spatial model to additional CDC PLACES indicators (asthma,
   obesity, etc.) and additional pilot regions once the diabetes/tri-county
   result holds up under scrutiny -- don't generalize from one target and one
   region.
10. Revisit the environment-symptom correlation's 10-check-in minimum once
    real usage data shows what sample size actually produces stable,
    reproducible correlations for this population -- 10 is a reasonable
    floor, not a number derived from this app's own data yet.
11. Set `SUPABASE_SERVICE_ROLE_KEY` in production once there's enough real
    check-in volume to make a pooled population baseline meaningful -- the
    personal calibration feature is built and tested, but its population
    half is inert (neutral-prior fallback only) until that key exists and
    real cross-user data clears the 30-row/variance gate.
12. Upgrade the personal calibration's pooled population estimate from a
    marginal regression to a true multilevel/random-effects model once
    real data volume justifies it, to remove the Simpson's-paradox risk
    named above.
13. Track whether `trustWeightPct` actually climbs toward personal-dominant
    over real usage, the way the mechanism is designed to -- if it doesn't
    move as check-in volume grows, that's a sign the neutral-prior
    variance (4x the user's own variance) needs recalibrating.

## Demo Language

Good wording:

> This is an explainable public-health risk snapshot. The current score is a
> transparent index, and the symptom layer is an experimental self-reported
> signal model that we can validate once real check-ins accumulate.

> The spatial model is a real Bayesian hierarchical model fit on real CDC
> data for one pilot region -- it's validated with standard diagnostics
> (R-hat, PSIS-LOO), but it's about census tracts, not individuals, and it
> only covers 128 tracts today.

> The environment-symptom correlation is about one person's own logged
> history -- it needs at least 10 of their check-ins, and it's correlation,
> not causation, checked with a permutation test rather than assumed
> significant.

> The personal calibration is exact Bayesian updating -- a real conjugate
> Normal-Normal model, not an approximation -- blending a population
> baseline with a user's own evidence. Right now the population half
> defaults to a neutral prior because the pooled data isn't configured yet,
> which is an honestly-reported state, not a hidden gap.

Avoid:

> This predicts whether someone will get sick.

> The spatial model personalizes your risk. (It doesn't -- it's a
> tract-level population model. The correlation feature and the personal
> calibration are the personalized ones.)

> The personal calibration is already using real population data. (It isn't
> yet -- `SUPABASE_SERVICE_ROLE_KEY` isn't configured in production, so it's
> currently running on the neutral-prior fallback.)

> This tells users what medical decision to make.
