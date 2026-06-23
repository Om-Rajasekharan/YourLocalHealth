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
- Personalized account/profile fields through Supabase
- Saved locations
- Symptom check-ins for future model training
- AI health assistant and AI daily health plan
- Synthetic ML training pipeline for demo/testing

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- OpenWeather / Open-Meteo / CDC public datasets
- Python, pandas, scikit-learn, joblib for ML experiments

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
OPENWEATHER_API_KEY=
CENSUS_API_KEY=
```

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
