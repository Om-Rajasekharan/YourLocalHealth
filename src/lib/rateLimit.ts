import { supabase } from "./supabaseClient";
import { traceAsync } from "./observability";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const RPC_TIMEOUT_MS = 1000;

function buildResult(
  limit: number,
  count: number,
  resetAt: number,
  now: number
): RateLimitResult {
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function rateLimitInMemory({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + windowMs,
        };

  bucket.count += 1;
  buckets.set(key, bucket);

  return buildResult(limit, bucket.count, bucket.resetAt, now);
}

/**
 * Rate limits a request key against a shared, cross-instance Postgres-backed
 * counter (supabase/rate_limit_buckets.sql), using an atomic upsert RPC so
 * limits actually hold across multiple server instances or serverless
 * invocations, not just within one process -- a plain in-memory Map (the
 * previous implementation) silently fails to enforce correctly once the app
 * runs as more than one instance, and resets on every deploy.
 *
 * Falls back to a per-process in-memory counter -- the old behavior -- if
 * Supabase isn't configured, the migration hasn't been run yet, or the call
 * is slow (1s timeout) or fails for any reason, so a Supabase hiccup
 * degrades rate limiting rather than breaking the API entirely.
 */
export async function rateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const client = supabase;
  if (!client) return rateLimitInMemory({ key, limit, windowMs });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    return await traceAsync(
      "rate_limit.check",
      async () => {
        const { data, error } = await client
          .rpc("check_rate_limit", {
            p_key: key,
            p_limit: limit,
            p_window_seconds: Math.ceil(windowMs / 1000),
          })
          .abortSignal(controller.signal)
          .single();

        if (error) {
          throw new Error(error.message);
        }
        if (!data) {
          throw new Error("check_rate_limit returned no row.");
        }

        const row = data as {
          allowed: boolean;
          current_count: number;
          reset_at: string;
        };
        const resetAt = new Date(row.reset_at).getTime();
        return buildResult(limit, row.current_count, resetAt, Date.now());
      },
      { key, limit }
    );
  } catch {
    return rateLimitInMemory({ key, limit, windowMs });
  } finally {
    clearTimeout(timeout);
  }
}

export function getRateLimitKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";

  return `${scope}:${ip}`;
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
