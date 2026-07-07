# Lovable UI Handoff

Use this file when asking Lovable to redesign the app. The goal is to polish
the interface without replacing the working data/auth/model logic.

## Product Summary

MyLocalHealth is a ZIP-code public-health dashboard. A user enters a US ZIP code
and receives a local snapshot built from environmental risk, respiratory illness
activity, weather/heat/UV/pollen forecasts, health-equity context, local news,
personal profile factors, and symptom check-ins.

The app is informational only. It must not present itself as medical advice,
diagnosis, or treatment.

## Current Main Features

The UI should make these three features feel primary:

- Forecast: a 24-hour local health-risk forecast with best/worst windows.
- Exposure Twin: a personal exposure simulation using ZIP, forecast, profile,
  routine, and check-in context.
- Model & Data: a transparent model/data view with risk contributors,
  confidence, data sources, and a spider/radar-style explanation.

Secondary features:

- Today summary
- Air, heat, UV, pollutant, flu, COVID, and alert signals
- Health equity/local context
- Local health news
- AI daily plan
- Health assistant chat
- Symptom check-in
- Saved locations and profile/account pages
- Optional Tableau/Looker community trends embed

## Technical Guardrails

Do not replace the app's data layer. Keep these files and APIs as the source of
truth:

- `src/contexts/DashboardDataContext.tsx`
- `src/services/*`
- `src/lib/*`
- `src/app/api/*`
- `supabase/*.sql`
- `ml/*`

The design can replace or reorganize UI inside:

- `src/components/DashboardApp.tsx`
- `src/app/globals.css`
- `src/app/signup/page.tsx`
- `src/app/account/page.tsx`
- `src/app/(dashboard)/forecast/page.tsx`
- `src/app/(dashboard)/twin/page.tsx`
- `src/app/(dashboard)/model/page.tsx`

## Current Data Interface

Most dashboard UI should read from:

```tsx
import { useDashboardData } from "./src/contexts/DashboardDataContext";
```

The context provides:

- identity/search: `zipCode`, `city`, `state`, `latitude`, `longitude`,
  `searched`, `loading`, `error`
- auth/profile: `user`, `userProfile`, `checkinStreak`
- signals: `aqi`, `fluActivity`, `covidData`, `environmentData`,
  `weatherAlerts`, `airComponents`, `localNews`, `healthEquityData`,
  `healthForecastData`
- derived model values: `healthRisk`, `respiratoryRisk`, `airQualityLabel`,
  `heatRisk`, `uvRisk`, `alertRisk`, `pollutantRisk`, `dominantPollutant`,
  `scoreBreakdown`, `dataConfidence`, `mainTwinScore`, `mainTwinLevel`
- actions: `searchZipCode(zip)`, `resetSearch()`, `setZipCode(zip)`,
  `refreshCheckinStreak(userId)`

If Lovable creates mock data, keep it isolated in demo components only. The
final app should use `useDashboardData()` for real data.

## Existing Routes

- `/`: main search/dashboard page
- `/forecast?zipCode=80528`: standalone forecast page
- `/twin?zipCode=80528`: standalone Exposure Twin page
- `/model?zipCode=80528`: standalone model/data page
- `/signup`: sign-up and onboarding profile
- `/account`: sign-in/account/profile management
- `/details/[topic]`: detailed signal pages

The standalone dashboard routes should preserve `zipCode` in the query string.

## Desired Visual Direction

The design should feel like a polished public-health product, not a generic AI
dashboard.

Use:

- clear hierarchy
- fewer equal-weight cards
- confident empty space
- real map/forecast/data visual language
- accessible contrast
- strong mobile layouts
- restrained motion
- charts and visual explanations where useful

Avoid:

- fake medical claims
- excessive gradients
- random AI-looking illustrations
- too many same-size cards
- replacing real logic with mock data
- exposing API keys or environment values

## Recommended Lovable Prompt

```text
Redesign the UI for a Next.js TypeScript app called MyLocalHealth.

Keep the existing data layer and app logic. Do not replace the services,
API routes, Supabase logic, or model calculations. Use the existing
useDashboardData() context as the source of truth.

The app lets users enter a ZIP code and see a local public-health snapshot
built from air quality, heat, UV, pollen, flu, COVID wastewater, weather
alerts, health equity context, local news, personal profile fields, and symptom
check-ins.

Make Forecast, Exposure Twin, and Model & Data the most obvious product
experiences. Secondary features can be quieter.

Design direction: polished public-health product, clean editorial homepage,
strong ZIP search, real map/data/forecast visual language, accessible, mobile
responsive, not a generic AI dashboard. Keep medical disclaimers.

Return reusable React components and CSS that can be dropped into the current
Next.js project. Use placeholder visuals only where necessary, but preserve the
real data props/context wiring.
```

## Pre-Handoff Checks

Before sending to Lovable or deploying, run:

```bash
npm run lint
npm run build
```

