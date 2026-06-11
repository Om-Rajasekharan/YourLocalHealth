create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  age_range text not null default '18-34',
  place_of_birth text,
  car_type text not null default 'Other',
  outdoor_exposure text not null default 'Moderate',
  activity_level text not null default 'Moderate',
  commute_exposure text not null default 'Moderate',
  respiratory_sensitivity text not null default 'None',
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_age_range_check'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_age_range_check
    check (age_range in ('Under 18', '18-34', '35-49', '50-64', '65+'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_outdoor_exposure_check'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_outdoor_exposure_check
    check (outdoor_exposure in ('Low', 'Moderate', 'High'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_activity_level_check'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_activity_level_check
    check (activity_level in ('Low', 'Moderate', 'High'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_commute_exposure_check'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_commute_exposure_check
    check (commute_exposure in ('Low', 'Moderate', 'High'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_respiratory_sensitivity_check'
  ) then
    alter table public.user_profiles
    add constraint user_profiles_respiratory_sensitivity_check
    check (respiratory_sensitivity in ('None', 'Mild', 'High'));
  end if;
end $$;

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view their own profile"
on public.user_profiles;

create policy "Users can view their own profile"
on public.user_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile"
on public.user_profiles;

create policy "Users can insert their own profile"
on public.user_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile"
on public.user_profiles;

create policy "Users can update their own profile"
on public.user_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
