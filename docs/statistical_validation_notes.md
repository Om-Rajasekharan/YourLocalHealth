# MyLocalHealth Statistical Validation Notes

This document summarizes how to describe the current model honestly during a
review or demo.

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

`ml/generate_model_report.py` surfaces both of these in its "Baseline
Comparison & Calibration" section. As of the last synthetic-data run, every
target shows positive ROC AUC lift over baseline (0.08-0.25), and
`headache_or_fatigue` has a notably high calibration error (~0.31) despite a
positive lift -- its probabilities rank-order better than chance but should
not yet be read as literal percentages.

Synthetic check-ins are for pipeline testing only. Synthetic performance should
not be reported as real-world accuracy.

## Recommended Next Validation Steps

1. Collect enough real check-ins across multiple ZIP codes and seasons.
2. Separate synthetic rows from real user labels in all reports.
3. Stratify performance by geography, season, respiratory-virus period, and
   data-confidence level.
4. Test whether adding equity and chronic-disease context improves out-of-sample
   performance over environmental signals alone.
5. Add prospective validation before making strong prediction claims.
6. Keep all user-facing wording informational and avoid medical advice.
7. Report cross-validation fold variance (mean ± std), not just a point
   estimate, once real check-in volume makes per-fold sample sizes stable
   enough to be meaningful.

## Demo Language

Good wording:

> This is an explainable public-health risk snapshot. The current score is a
> transparent index, and the symptom layer is an experimental self-reported
> signal model that we can validate once real check-ins accumulate.

Avoid:

> This predicts whether someone will get sick.

> This tells users what medical decision to make.
