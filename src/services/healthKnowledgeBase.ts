import { supabase } from "../lib/supabaseClient";
import { traceAsync } from "../lib/observability";

const EMBEDDINGS_API_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_MATCH_COUNT = 4;
const DEFAULT_TIMEOUT_MS = 2500;

export type KnowledgeSnippet = {
  topic: string;
  source: string;
  content: string;
  similarity: number;
};

async function embedQuestion(
  question: string,
  signal: AbortSignal
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(EMBEDDINGS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: question }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Embeddings request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error("Embeddings response did not include a vector.");
  }

  return embedding;
}

/**
 * Retrieves the most semantically relevant curated public-health snippets
 * for a question, via pgvector cosine similarity search. Returns null on
 * any failure -- missing config, the knowledge base not seeded yet, an
 * embeddings API error, a Supabase error, or a slow response past the
 * timeout -- so /api/health-chat can always fall back to answering from
 * dashboard context alone, exactly as it did before this existed, without
 * adding meaningful latency to that fallback path.
 */
export async function retrieveKnowledgeSnippets(
  question: string,
  matchCount: number = DEFAULT_MATCH_COUNT
): Promise<KnowledgeSnippet[] | null> {
  const client = supabase;
  if (!client) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await traceAsync(
      "health_knowledge_base.retrieve",
      async () => {
        const embedding = await embedQuestion(question, controller.signal);
        const { data, error } = await client
          .rpc("match_health_knowledge", {
            query_embedding: embedding,
            match_count: matchCount,
          })
          .abortSignal(controller.signal);

        if (error) {
          throw new Error(error.message);
        }

        return (data ?? []) as KnowledgeSnippet[];
      },
      { matchCount }
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
