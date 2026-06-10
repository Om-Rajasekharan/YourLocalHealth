create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  zip_code text not null,
  city text not null,
  state text not null,
  latitude text not null,
  longitude text not null,
  created_at timestamptz not null default now()
);

alter table public.saved_locations enable row level security;

create policy "Users can view their own saved locations"
on public.saved_locations
for select
using (auth.uid() = user_id);

create policy "Users can insert their own saved locations"
on public.saved_locations
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own saved locations"
on public.saved_locations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own saved locations"
on public.saved_locations
for delete
using (auth.uid() = user_id);
