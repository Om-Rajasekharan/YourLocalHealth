create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  location_type text not null default 'Other',
  zip_code text not null,
  city text not null,
  state text not null,
  latitude text not null,
  longitude text not null,
  created_at timestamptz not null default now()
);

alter table public.saved_locations
add column if not exists location_type text not null default 'Other';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_locations_location_type_check'
  ) then
    alter table public.saved_locations
    add constraint saved_locations_location_type_check
    check (location_type in ('Home', 'Work', 'School', 'Caregiving', 'Other'));
  end if;
end $$;

alter table public.saved_locations enable row level security;

drop policy if exists "Users can view their own saved locations"
on public.saved_locations;

create policy "Users can view their own saved locations"
on public.saved_locations
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own saved locations"
on public.saved_locations;

create policy "Users can insert their own saved locations"
on public.saved_locations
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved locations"
on public.saved_locations;

create policy "Users can update their own saved locations"
on public.saved_locations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved locations"
on public.saved_locations;

create policy "Users can delete their own saved locations"
on public.saved_locations
for delete
using (auth.uid() = user_id);
