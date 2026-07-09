create table if not exists public.health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zip_code text not null,
  city text not null,
  state text not null,
  latitude text not null,
  longitude text not null,
  model_version text not null,
  model_score integer not null,
  health_risk text not null,
  respiratory_risk text not null,
  air_quality text not null,
  aqi integer,
  dominant_pollutant text,
  pollutant_risk text,
  heat_risk text,
  uv_risk text,
  alert_risk text,
  flu_activity text,
  covid_activity text,
  covid_coverage text,
  forecast_average_score integer,
  forecast_peak_score integer,
  forecast_best_window text,
  forecast_worst_window text,
  forecast_allergy_peak_score integer,
  forecast_allergy_peak_window text,
  forecast_pollen_risk text,
  equity_score integer,
  equity_level text,
  places_chronic_burden_score integer,
  places_asthma numeric,
  places_copd numeric,
  places_smoking numeric,
  places_obesity numeric,
  places_diabetes numeric,
  profile_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.symptom_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid references public.health_snapshots(id) on delete set null,
  zip_code text not null,
  felt_impact boolean not null default false,
  respiratory_symptoms boolean not null default false,
  allergy_symptoms boolean not null default false,
  heat_symptoms boolean not null default false,
  headache_or_fatigue boolean not null default false,
  avoided_outdoor_activity boolean not null default false,
  used_rescue_medication boolean not null default false,
  missed_work_school_activity boolean not null default false,
  symptom_severity integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.health_snapshots enable row level security;
alter table public.symptom_checkins enable row level security;

alter table public.health_snapshots
add column if not exists forecast_allergy_peak_score integer,
add column if not exists forecast_allergy_peak_window text,
add column if not exists forecast_pollen_risk text;

alter table public.health_snapshots
add column if not exists places_chronic_burden_score integer,
add column if not exists places_asthma numeric,
add column if not exists places_copd numeric,
add column if not exists places_smoking numeric,
add column if not exists places_obesity numeric,
add column if not exists places_diabetes numeric;

drop policy if exists "Users can view their own health snapshots"
on public.health_snapshots;

create policy "Users can view their own health snapshots"
on public.health_snapshots
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own health snapshots"
on public.health_snapshots;

create policy "Users can insert their own health snapshots"
on public.health_snapshots
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can view their own symptom checkins"
on public.symptom_checkins;

create policy "Users can view their own symptom checkins"
on public.symptom_checkins
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own symptom checkins"
on public.symptom_checkins;

create policy "Users can insert their own symptom checkins"
on public.symptom_checkins
for insert
with check (auth.uid() = user_id);

create or replace view public.ml_feature_snapshots
with (security_invoker = true) as
select
  hs.id as snapshot_id,
  hs.user_id,
  hs.zip_code,
  hs.city,
  hs.state,
  hs.created_at,
  hs.model_version,
  hs.model_score,
  hs.health_risk,
  hs.respiratory_risk,
  hs.aqi,
  hs.air_quality,
  hs.dominant_pollutant,
  hs.pollutant_risk,
  hs.heat_risk,
  hs.uv_risk,
  hs.alert_risk,
  hs.flu_activity,
  hs.covid_activity,
  hs.covid_coverage,
  hs.forecast_average_score,
  hs.forecast_peak_score,
  hs.forecast_allergy_peak_score,
  hs.forecast_pollen_risk,
  hs.equity_score,
  hs.equity_level,
  hs.places_chronic_burden_score,
  hs.places_asthma,
  hs.places_copd,
  hs.places_smoking,
  hs.places_obesity,
  hs.places_diabetes,
  sc.felt_impact,
  sc.respiratory_symptoms,
  sc.allergy_symptoms,
  sc.heat_symptoms,
  sc.headache_or_fatigue,
  sc.avoided_outdoor_activity,
  sc.used_rescue_medication,
  sc.missed_work_school_activity,
  sc.symptom_severity,
  sc.created_at as checkin_created_at
from public.health_snapshots hs
left join public.symptom_checkins sc
  on sc.snapshot_id = hs.id;
