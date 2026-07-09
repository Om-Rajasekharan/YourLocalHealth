# MyLocalHealth

MyLocalHealth is a public-health dashboard that turns local environmental,
respiratory, forecast, and community context into a plain-language health
snapshot for a ZIP code.

The goal is not to diagnose or replace medical care. The app is an
informational tool that helps people understand local signals that may affect
breathing, heat exposure, allergies, outdoor activity, and community health
vulnerability.

## Current Features

- ZIP code lookup with city, state, latitude, and longitude
- Air quality and pollutant context
- CDC flu activity by state
- COVID wastewater activity
- Weather, heat, UV, pollen, and air-quality forecast signals
- Interactive map with center-point ZIP lookup
- Local health news context
- Health equity overlay using Census/CDC-style social determinants
- CDC PLACES chronic disease context
- Optional Tableau or Looker Studio community trends embed
- Personalized account/profile fields through Supabase
- Saved locations
- Symptom check-ins for future model training
- AI health assistant and AI daily health plan
- Synthetic ML training pipeline for demo/testing
- Python model reporting for ML transparency
- Native C++ risk scoring kernel for scoring experiments

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- OpenWeather / Open-Meteo / CDC public datasets
- Python, pandas, scikit-learn, joblib for ML experiments
- C++17 for portable risk-scoring experiments

## Run Locally

Install JavaScript dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Environment Variables

Create `.env.local` locally and add the API keys used by the app. Do not commit
`.env.local`.

Common variables include:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_OPENWEATHER_API_KEY=
CENSUS_API_KEY=
NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL=
NEXT_PUBLIC_TABLEAU_EMBED_URL=
```

The Tableau/Looker variables are optional. If neither is set, the app still
works and shows a setup panel in the Community Trends page.

## ML Pipeline

The app can save health snapshots and user symptom check-ins. Over time, those
check-ins can become outcome labels for a real symptom-risk model.

For now, the project includes a synthetic data generator so the ML pipeline can
be tested before enough real check-ins exist.

### Important Note

Synthetic data is for development and demos only. It proves that the pipeline
works, but it does not prove clinical or real-world accuracy.

### Set Up Python ML Environment

Create and use a local virtual environment:

```bash
python3 -m venv .venv
.venv/bin/pip install -r ml/requirements.txt
```

### Generate Synthetic Check-Ins

```bash
python3 ml/generate_synthetic_checkins.py --rows 1500 --output data/synthetic_checkins.csv
```

### Train Demo Models

```bash
.venv/bin/python ml/train_symptom_model.py data/synthetic_checkins.csv --all-targets
```

Training outputs are written to:

```bash
ml/models/
```

Generated datasets and model artifacts are ignored by git.

### Generate a Model Report

After training, create a human-readable report from the local model artifacts:

```bash
python3 ml/generate_model_report.py --output ml/model_report.md
```

The report summarizes trained targets, holdout metrics, top predictors, and
guardrails. It is useful for demos and project review, but it is not clinical
validation.

For a concise review of the current statistical status, outcome-label design,
and next validation steps, see:

```bash
docs/statistical_validation_notes.md
```

## Native Risk Kernel

The repo also includes a small C++17 scoring kernel in `native/`. It mirrors the
transparent risk-index idea outside the UI and can later become a backend or
WebAssembly scoring component.

Build it locally:

```bash
clang++ -std=c++17 -O2 -Wall -Wextra native/risk_kernel.cpp -o /tmp/mylocalhealth-risk
```

Run a sample score:

```bash
/tmp/mylocalhealth-risk \
  --aqi 72 \
  --heat 61 \
  --uv 55 \
  --pollen 44 \
  --illness 38 \
  --equity 52 \
  --chronic 48 \
  --profile 12 \
  --forecast 67
```

The output is compact JSON with a score, risk level, dominant contributor, and
data-confidence estimate.

## Tableau or Looker Studio

The app includes a Community Trends page that can embed a BI dashboard.

Recommended use:

1. Export aggregate, de-identified data from Supabase.
2. Build charts in Looker Studio or Tableau, such as symptom check-ins over
   time, risk by ZIP/state, environmental signals vs outcomes, and model
   performance.
3. Copy the report's embed URL.
4. Add one of these environment variables locally and in Vercel:

```bash
NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL=
NEXT_PUBLIC_TABLEAU_EMBED_URL=
```

Only one is needed. If both are set, Looker Studio is used first.

Do not embed tables containing names, emails, notes, precise medical histories,
or account-level records. Use aggregate counts, rates, and model metrics.

## Production Container

The app includes a Dockerfile that builds the Next.js standalone production
server. This is useful for reproducible deployments and professor/demo
discussion around production readiness.

Build the container:

```bash
docker build -t mylocalhealth .
```

Run it locally:

```bash
docker run --env-file .env.local -p 3000:3000 mylocalhealth
```

Open:

```bash
http://localhost:3000
```

## API Contract

The internal API routes are documented in:

```bash
docs/api/openapi.yaml
```

This OpenAPI spec describes the local news, health equity, reverse geocoding,
flu, health assistant, and daily plan endpoints. It is documentation for the app
contract, not a clinical decision-support API.

## Observability, AI Safety, and Feature Flags

The app includes lightweight structured trace logging for AI API calls and a
small feature-flag layer for experimental features.

Feature flags:

```bash
ENABLE_AI_ASSISTANT=true
ENABLE_AI_PLAN=true
ENABLE_MODEL_EVALUATION=true
ENABLE_EXPERIMENTAL_SYMPTOM_SIGNALS=true
```

The health assistant route also includes basic AI guardrails:

- prompt-injection pattern detection
- urgent symptom language detection
- source/context audit metadata returned with responses
- deterministic fallback behavior when AI features are disabled or unavailable

Trace events are written as structured JSON logs with the prefix:

```bash
[mylocalhealth:trace]
```

These logs intentionally exclude API keys, tokens, and secrets.

## Security Scanning

GitHub Actions includes:

- CI lint/test/build verification
- CodeQL static analysis for JavaScript and TypeScript
- Dependency review for pull requests

These checks support safer iteration before deploying public-facing changes.

## Data Quality Validation

Before training or presenting model results, validate the exported training CSV:

```bash
npm run validate:data
```

The command writes:

```bash
docs/data_validation_report.md
```

The report checks required columns, missingness, duplicate check-ins, label
balance, score ranges, date coverage, geographic coverage, and numeric feature
summaries. This is data QA, not clinical validation.

### Train On Real Check-Ins Later

When enough real users have submitted check-ins:

1. Run `supabase/export_ml_training_data.sql` in the Supabase SQL editor.
2. Export the results as CSV.
3. Save the file locally as `data/checkins.csv`.
4. Train with:

```bash
.venv/bin/python ml/train_symptom_model.py data/checkins.csv --all-targets
```

## Supabase SQL Files

- `supabase/saved_locations.sql`: saved locations table and policies
- `supabase/user_profiles.sql`: user profile table and policies
- `supabase/ml_training_data.sql`: health snapshots and symptom check-ins
- `supabase/export_ml_training_data.sql`: export query for ML training data

## Development Checks

Run lint:

```bash
npm run lint
```

Build production bundle:

```bash
npm run build
```

## Safe Commit Command

The generated ML data, model artifacts, local virtual environment, env files,
and Next build output are ignored. After reviewing `git status`, this is safe:

```bash
git add .
git commit -m "Add ML training pipeline and polish UI"
git push
```

## Medical Disclaimer

MyLocalHealth is informational only. It does not provide medical advice,
diagnosis, or treatment. People with serious or urgent symptoms should contact
emergency services or a medical professional.
