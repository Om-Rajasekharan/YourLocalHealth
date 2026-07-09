# MyLocalHealth Data Validation Report

- Source file: `data/synthetic_checkins.csv`
- Rows: 1500
- Status: **Review needed**
- Check-in date range: 2025-10-25 to 2026-06-23

## Warnings
- used_rescue_medication is highly imbalanced.
- missed_work_school_activity is highly imbalanced.

## Label Balance
- `felt_impact`: true=1199 (79.9%), false=301 (20.1%)
- `respiratory_symptoms`: true=712 (47.5%), false=788 (52.5%)
- `allergy_symptoms`: true=531 (35.4%), false=969 (64.6%)
- `heat_symptoms`: true=414 (27.6%), false=1086 (72.4%)
- `headache_or_fatigue`: true=192 (12.8%), false=1308 (87.2%)
- `avoided_outdoor_activity`: true=397 (26.5%), false=1103 (73.5%)
- `used_rescue_medication`: true=124 (8.3%), false=1376 (91.7%)
- `missed_work_school_activity`: true=78 (5.2%), false=1422 (94.8%)

## Numeric Summaries
- `symptom_severity`: min=0, median=3, mean=2.68, max=9, sd=1.72
- `model_score`: min=3, median=38, mean=38.41, max=75, sd=10.22
- `aqi`: min=5, median=45, mean=45.29, max=108, sd=18.48
- `forecast_average_score`: min=0, median=29, mean=29.67, max=68, sd=11.89
- `forecast_peak_score`: min=0, median=42.50, mean=42.58, max=90, sd=13.93
- `equity_score`: min=5, median=54, mean=51.72, max=100, sd=19.62
- `places_chronic_burden_score`: min=3, median=51, mean=49.52, max=86, sd=15.03
- `places_asthma`: min=4.80, median=10.50, mean=10.51, max=15.80, sd=1.73
- `places_copd`: min=2.50, median=6.50, mean=6.47, max=10.90, sd=1.38
- `places_smoking`: min=4.60, median=13.50, mean=13.45, max=21.50, sd=2.69
- `places_obesity`: min=12.40, median=29, mean=28.95, max=41.50, sd=4.37
- `places_diabetes`: min=3.60, median=9.40, mean=9.40, max=14.20, sd=1.80

## Missingness
- `checkin_id`: 0 missing (0.0%)
- `user_id`: 0 missing (0.0%)
- `snapshot_id`: 0 missing (0.0%)
- `checkin_zip_code`: 0 missing (0.0%)
- `felt_impact`: 0 missing (0.0%)
- `respiratory_symptoms`: 0 missing (0.0%)
- `allergy_symptoms`: 0 missing (0.0%)
- `heat_symptoms`: 0 missing (0.0%)
- `headache_or_fatigue`: 0 missing (0.0%)
- `avoided_outdoor_activity`: 0 missing (0.0%)
- `used_rescue_medication`: 0 missing (0.0%)
- `missed_work_school_activity`: 0 missing (0.0%)
- `symptom_severity`: 0 missing (0.0%)
- `checkin_created_at`: 0 missing (0.0%)
- `zip_code`: 0 missing (0.0%)
- `city`: 0 missing (0.0%)
- `state`: 0 missing (0.0%)
- `latitude`: 0 missing (0.0%)
- `longitude`: 0 missing (0.0%)
- `model_version`: 0 missing (0.0%)

## Geographic Coverage
- Top states: AZ=207, CA=201, CO=193, WA=184, NC=183, NY=183, TX=177, IL=172
- Top ZIPs: 85004=207, 90011=201, 80528=193, 98101=184, 27516=183, 10001=183, 77002=177, 60623=172

## Interpretation

This report checks data quality and training-readiness. It does not validate clinical accuracy. Synthetic rows should be used only for pipeline testing, not for real-world performance claims.
