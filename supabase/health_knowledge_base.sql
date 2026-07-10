-- Curated public-health reference snippets, embedded for semantic retrieval.
-- Grounds the AI health assistant's general (non-personalized) answers in
-- citable source text instead of the LLM's raw training knowledge, reducing
-- hallucination risk on factual health claims.
--
-- Setup:
--   1. In the Supabase dashboard, enable the "vector" extension
--      (Database > Extensions > vector), or run the line below.
--   2. Run this whole file in the SQL editor.
--   3. Seed it: see scripts/seed-knowledge-base.mjs.

create extension if not exists vector;

create table if not exists public.health_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  source text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Approximate nearest-neighbor index for cosine similarity search. ivfflat
-- needs data present to build well; safe to (re)run this after seeding if
-- the planner isn't using it.
create index if not exists health_knowledge_base_embedding_idx
  on public.health_knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.health_knowledge_base enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_knowledge_base'
      and policyname = 'health_knowledge_base_public_read'
  ) then
    create policy health_knowledge_base_public_read
      on public.health_knowledge_base
      for select
      using (true);
  end if;
end $$;

-- No insert/update/delete policy is defined, so only the service role (used
-- by scripts/seed-knowledge-base.mjs, never by the deployed app) can write
-- to this table. The anon key used by the running app can only read.

create or replace function match_health_knowledge (
  query_embedding vector(1536),
  match_count int default 4
)
returns table (
  id uuid,
  topic text,
  source text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    topic,
    source,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from public.health_knowledge_base
  order by embedding <=> query_embedding
  limit match_count;
$$;
