-- Shared, cross-instance rate limit storage. The previous implementation
-- (src/lib/rateLimit.ts) used a plain in-memory Map, which only enforces
-- correctly within a single server process -- it silently fails to limit
-- correctly across multiple serverless invocations/container replicas, and
-- resets on every deploy or restart. This makes rate limiting actually work
-- in production while keeping the exact same call signature.
--
-- Setup: run this whole file in the Supabase SQL editor. No app code
-- changes needed beyond what's already shipped -- src/lib/rateLimit.ts
-- calls check_rate_limit() and falls back to in-memory limiting if this
-- table/function isn't set up yet or Supabase is unreachable.

create table if not exists public.rate_limit_buckets (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

alter table public.rate_limit_buckets enable row level security;

-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies: the anon key used
-- by the running app can only touch this table through the function below,
-- which is narrowly scoped to "increment one counter, return whether it's
-- over the limit" -- it cannot be used to read or tamper with other keys'
-- state directly via the REST API.

create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns table (
  allowed boolean,
  current_count int,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count int;
  v_reset_at timestamptz;
begin
  -- Atomic upsert: concurrent calls for the same key are serialized by
  -- Postgres at the row level, so this does not have the classic
  -- read-then-write race condition a naive "select, check, update" would.
  insert into public.rate_limit_buckets (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case
          when public.rate_limit_buckets.reset_at > v_now
            then public.rate_limit_buckets.count + 1
          else 1
        end,
        reset_at = case
          when public.rate_limit_buckets.reset_at > v_now
            then public.rate_limit_buckets.reset_at
          else v_now + make_interval(secs => p_window_seconds)
        end
  returning public.rate_limit_buckets.count, public.rate_limit_buckets.reset_at
    into v_count, v_reset_at;

  return query select (v_count <= p_limit), v_count, v_reset_at;
end;
$$;

grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;

-- Cheap periodic cleanup so this table doesn't grow unbounded. Not scheduled
-- automatically here (would need pg_cron or an external trigger) -- run
-- manually or wire up pg_cron if the table grows large:
--   delete from public.rate_limit_buckets where reset_at < now() - interval '1 day';
