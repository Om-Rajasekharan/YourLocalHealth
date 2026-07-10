#!/usr/bin/env node
// Embeds the curated public-health knowledge base (knowledge-base-content.mjs)
// and writes it into Supabase's health_knowledge_base table for the AI
// assistant's RAG retrieval (src/services/healthKnowledgeBase.ts).
//
// This is a one-time/occasional manual operation, run locally -- never by
// the deployed app. It needs elevated write access, so it uses the Supabase
// service role key rather than the public anon key the app itself uses.
//
// Setup:
//   1. Run supabase/health_knowledge_base.sql in the Supabase SQL editor.
//   2. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard ->
//      Project Settings -> API -> service_role key). This key bypasses row
//      level security -- never expose it to the browser or commit it.
//   3. Run: node --env-file=.env.local scripts/seed-knowledge-base.mjs
//      (or export the three required env vars another way)

import { createClient } from "@supabase/supabase-js";
import { knowledgeBaseEntries } from "./knowledge-base-content.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";

function requireEnv() {
  const missing = [
    !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !OPENAI_API_KEY && "OPENAI_API_KEY",
  ].filter(Boolean);

  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    console.error("See the setup steps at the top of this script.");
    process.exit(1);
  }
}

async function embed(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embeddings request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("Embeddings response did not include a vector.");
  }

  return embedding;
}

async function main() {
  requireEnv();

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log(`Embedding ${knowledgeBaseEntries.length} entries with ${EMBEDDING_MODEL}...`);

  const rows = [];
  for (const entry of knowledgeBaseEntries) {
    const embedding = await embed(entry.content);
    rows.push({ ...entry, embedding });
    console.log(`  embedded: ${entry.topic}`);
  }

  console.log("Clearing existing knowledge base rows...");
  const { error: deleteError } = await supabase
    .from("health_knowledge_base")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    throw new Error(`Failed to clear existing rows: ${deleteError.message}`);
  }

  console.log("Inserting embedded rows...");
  const { error: insertError } = await supabase
    .from("health_knowledge_base")
    .insert(rows);

  if (insertError) {
    throw new Error(`Failed to insert rows: ${insertError.message}`);
  }

  console.log(`Done. Seeded ${rows.length} knowledge base entries.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
