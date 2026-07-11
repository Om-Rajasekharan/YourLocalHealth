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
- AI health assistant and AI daily health plan, optionally grounded in a
  curated public-health knowledge base via RAG (retrieval-augmented
  generation)
- Password reset flow
- Synthetic ML training pipeline with 9 trained, explainable, calibrated
  symptom-risk models (scikit-learn, SHAP, Platt scaling, bootstrap
  confidence intervals), served via a FastAPI microservice with graceful
  fallback
- Python model reporting for ML transparency
- Native C++ risk scoring kernel, including a WebAssembly build that
  cross-checks the TypeScript risk model in production
- Cross-instance rate limiting backed by Postgres
- Real distributed tracing via OpenTelemetry

## Tech Stack

- **TypeScript / Next.js** -- the app itself: UI, API routes, feature flags,
  observability, rate limiting.
- **Python** (pandas, scikit-learn, FastAPI, SHAP) -- the ML pipeline:
  training, calibration, explainability, and a serving microservice
  (`ml/`). Not experiments-only -- it's wired into the live app via
  `src/lib/mlModelClient.ts`, gated behind a feature flag.
- **C++17 / WebAssembly** -- an independent reimplementation of the risk
  scoring math, compiled with Emscripten and called from the risk API at
  request time to cross-check the TypeScript implementation (`native/`).
- **SQL (PostgreSQL / pgvector)** -- not just table definitions: atomic
  upsert functions for cross-instance rate limiting and cosine-similarity
  search for the RAG knowledge base (`supabase/*.sql`).
- **Supabase** -- Postgres, pgvector, auth, row-level security.
- **OpenTelemetry** -- real distributed tracing (not just log lines) across
  every external call: ML serving, RAG retrieval, the WASM cross-check, and
  rate limiting.
- OpenWeather / Open-Meteo / CDC public datasets.

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

Five candidate model types are raced against each other per target:
logistic regression, random forest, extra trees, gradient boosting, and
XGBoost (XGBoost needs an OpenMP runtime -- `brew install libomp` on macOS,
`apt-get install libgomp1` on Linux; it degrades gracefully to the other
four candidates if that's not available rather than failing training).

Training outputs are written to:

```bash
ml/models/
```

Generated datasets and model artifacts are ignored by git.

### Tuning Hyperparameters

The hyperparameters in `candidate_models()` aren't hand-guessed -- they're
the consensus from an offline `RandomizedSearchCV` sweep, scored on ROC AUC,
run separately against three targets spanning the dataset's range of class
balance. Re-run it if you change the feature set or want to re-tune:

```bash
.venv/bin/python ml/train_symptom_model.py data/synthetic_checkins.csv \
  --target felt_impact --tune --tune-iterations 15
```

This is a manual/offline tool, not something that runs as part of normal
training -- a full hyperparameter search on every push would make CI (which
retrains from scratch every time) far too slow. Run it, review the printed
best parameters, and hand-update `candidate_models()`'s defaults if they
look better than the current ones.

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

### Serving Predictions in Production

Trained models are served by a small FastAPI microservice
(`ml/serve_models.py`) rather than baked into the Next.js app. It loads every
`ml/models/*.joblib` pipeline at startup and exposes a `/predict` endpoint
that returns, per symptom target, a probability and its top contributing
features (via `shap.TreeExplainer`) so a prediction is explainable, not a
black box.

```bash
.venv/bin/pip install -r ml/requirements.txt
.venv/bin/uvicorn ml.serve_models:app --host 127.0.0.1 --port 8000
```

The Next.js app calls this service from `/api/risk` through
`src/lib/mlModelClient.ts`, with a short timeout and a hard fallback: if the
service is slow, down, or returns something unexpected, `mlPredictions` in the
API response is simply `null` and the rest of the response is unaffected. This
path is gated behind the `ENABLE_ML_MODEL_SERVING` feature flag, which
defaults to `false` since it depends on an external process -- set it to
`true` and point `ML_SERVICE_URL` at the running service to enable it.

CI (`.github/workflows/ci.yml`, `verify-ml` job) regenerates synthetic data,
retrains all 9 targets, boots this service, and asserts every target returns
both a probability and a SHAP explanation on every push, so a broken model or
a silently-dropped explanation can't ship unnoticed.

## Native Risk Kernel

The repo includes two C++17 implementations of the transparent risk-index
math in `native/`: a standalone CLI tool for scoring experiments, and a
WebAssembly module that's actually wired into the deployed app.

### CLI tool (standalone, experimental)

```bash
clang++ -std=c++17 -O2 -Wall -Wextra native/risk_kernel.cpp -o /tmp/mylocalhealth-risk

/tmp/mylocalhealth-risk \
  --aqi 72 --heat 61 --uv 55 --pollen 44 --illness 38 \
  --equity 52 --chronic 48 --profile 12 --forecast 67
```

Outputs compact JSON with a score, risk level, dominant contributor, and
data-confidence estimate.

### WebAssembly cross-check (live in production)

`native/wasm/risk_kernel_wasm.cpp` is a second, independent C++
implementation of the same weighted-scoring math used in
`src/lib/riskModel.ts`, compiled to WebAssembly with Emscripten and called
from `/api/risk` on every request (`src/lib/wasmRiskKernel.ts`). It
recomputes the overall score and compares it against the TypeScript result
-- purely a verification signal, never the source of truth, and never able
to affect the actual API response -- so if the two independently-written
implementations of the same math ever silently drift apart, it shows up as
a `wasm_risk_kernel.disagreement` trace event instead of shipping a wrong
score unnoticed.

Rebuilding after a change to the C++ source:

```bash
brew install emscripten   # one-time; the compiled output is committed
./native/wasm/build.sh
```

The compiled `native/wasm/dist/risk_kernel_wasm.mjs` is committed like any
other build artifact -- the deployed app doesn't have `emcc` available, so
this isn't run as part of `npm run build`.

## Distributed Tracing (OpenTelemetry)

`src/instrumentation.ts` registers a real OpenTelemetry `NodeTracerProvider`
at server startup (`src/lib/otel.ts`). `traceAsync()`
(`src/lib/observability.ts`) -- already used for every external call: ML
serving, RAG retrieval, the WASM cross-check, rate limiting -- wraps each
one in a proper OTel span (trace ID, span ID, parent/child correlation,
status, exceptions) in addition to its existing structured console log, so
every one of those call sites got real distributed tracing for free without
any of them needing to change.

With no backend configured, spans export to stdout via `ConsoleSpanExporter`
-- genuine OpenTelemetry output, just without a hosted collector. Point
`OTEL_EXPORTER_OTLP_ENDPOINT` at a real backend (Honeycomb, Grafana Cloud,
etc. -- both have free tiers) to switch with zero code changes.

## Load Testing

`scripts/load-test.mjs` benchmarks two routes against a local production
build, deliberately not combined into one number since they measure
different things: the home page (static, no rate limit, no external calls)
reflects the Next.js server's own raw serving capacity, while `/api/risk`
(rate-limited to 30/min by design, ~7 parallel external API calls, risk-model
computation, ML feature snapshot, WASM cross-check) is measured with a
bounded request count for realistic per-request latency rather than
sustained high RPS.

```bash
npm run build && npm run start   # in one terminal
node scripts/load-test.mjs       # in another
```

Representative results from a local run (Apple Silicon, single instance):

| Route | Requests | Throughput | p50 | p97.5 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` (static) | 51,410 in 15s | 3,428 req/s | 4ms | 12ms | 15ms |
| `/api/risk?zipCode=90001` | 20 sequential | 6.7 req/s | 79ms | 876ms | 876ms |

The `/api/risk` numbers reflect `src/lib/apiCache.ts` in effect -- most
requests for a recently-queried ZIP hit cache and return in well under
100ms; the p97.5/p99/max are all the same single slower request, a cache
miss that had to call external APIs. Re-run against a cold cache (a ZIP
that hasn't been queried recently) for uncached latency instead.

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
ENABLE_ML_MODEL_SERVING=false
ENABLE_RAG_KNOWLEDGE_BASE=false
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

## AI Assistant Knowledge Base (RAG)

The health assistant's general (non-personalized) answers can be grounded in
a small curated set of public-health reference snippets via retrieval-
augmented generation, instead of relying only on the LLM's raw training
knowledge. This reduces hallucination risk on factual claims and gives the
assistant citable sources (`src/services/healthKnowledgeBase.ts`).

How it works: each snippet is embedded with OpenAI's
`text-embedding-3-small` and stored in a Supabase table with a `pgvector`
column; a Postgres function does cosine-similarity search to find the most
relevant snippets for a question, which get injected into the assistant's
prompt with citations.

Setup (one-time):

```bash
# 1. In the Supabase SQL editor, run:
supabase/health_knowledge_base.sql

# 2. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard ->
#    Project Settings -> API). This key bypasses row-level security --
#    never commit it or expose it to the browser. It is only read by the
#    seeding script below, never by the deployed app.

# 3. Seed the knowledge base:
node --env-file=.env.local scripts/seed-knowledge-base.mjs

# 4. Turn it on:
ENABLE_RAG_KNOWLEDGE_BASE=true
```

Retrieval is gated behind `ENABLE_RAG_KNOWLEDGE_BASE`, which defaults to
`false` -- like `ENABLE_ML_MODEL_SERVING`, it depends on a manual setup step
(running the SQL migration and seeding script above) that hasn't happened
yet on a fresh clone, and attempting retrieval before that step is done adds
several seconds of latency to every chat request for no benefit. Once
enabled, retrieval still fails closed with a 2.5s timeout at every step: if
Supabase isn't configured, the table hasn't been seeded, or the embeddings
call fails or is slow, `/api/health-chat` falls back to answering from
dashboard context alone -- exactly as it did before this existed. The
knowledge base content itself lives in `scripts/knowledge-base-content.mjs`
for easy review and editing.

## External API Resilience

`src/lib/apiCache.ts` -- the shared wrapper nearly every external call in
the app goes through (OpenWeather, Open-Meteo, NWS alerts, CDC wastewater,
the forecast engine) -- retries a failed request with exponential backoff
and jitter (default: 2 retries, 200ms base delay) before giving up. Only
retries what's actually worth retrying: a network error, a 429, or a 5xx --
never a 4xx client error, which will just fail identically every time.
Every retry attempt is recorded as an `api_cache.retry` trace event, so a
flaky upstream shows up in observability instead of only surfacing as an
occasional user-facing error.

## Cross-Instance Rate Limiting

API rate limiting (`src/lib/rateLimit.ts`) is backed by a shared Postgres
counter (`supabase/rate_limit_buckets.sql`) instead of a plain in-memory
counter. A plain in-memory `Map` only enforces correctly within a single
server process -- across multiple serverless invocations or container
replicas (the normal shape of a production deployment) each instance has
its own memory, so limits silently don't hold, and everything resets on
every deploy.

The Postgres-backed check is a single atomic upsert RPC
(`check_rate_limit`), so concurrent requests for the same key can't race
each other into an incorrect count. It's `security definer`-scoped: the
app's public API key can call the function to check/increment a counter,
but cannot read or write the underlying table directly, so it can't be used
to inspect or tamper with other keys' rate-limit state via the REST API.

Setup: run `supabase/rate_limit_buckets.sql` in the Supabase SQL editor. No
app code or environment changes needed -- if the migration hasn't been run
yet, or the RPC call is slow (1s timeout) or fails for any reason,
`rateLimit()` falls back to the original in-memory counter rather than
breaking the API, so this degrades gracefully rather than being a hard
dependency.

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
