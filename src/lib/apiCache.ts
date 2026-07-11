import { recordEvent } from "./observability";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CachedJsonOptions = RequestInit & {
  cacheKey?: string;
  ttlMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
};

const defaultTtlMs = 15 * 60 * 1000;
const defaultMaxRetries = 2;
const defaultRetryBaseDelayMs = 200;
const memoryCache = new Map<string, CacheEntry<unknown>>();

function stableRequestKey(url: string, options?: RequestInit) {
  const method = options?.method ?? "GET";
  const headers =
    options?.headers && typeof options.headers === "object"
      ? JSON.stringify(options.headers)
      : "";

  return `${method}:${url}:${headers}`;
}

export function clearApiCache() {
  memoryCache.clear();
}

export function getApiCacheSize() {
  return memoryCache.size;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 5xx and 429 are the status codes where retrying might actually help --
// they signal a transient upstream problem, not a request that will never
// succeed. A 404/400/etc. means retrying is pointless at best and hammers
// an already-struggling upstream at worst.
function isRetriableStatus(status: number) {
  return status === 429 || status >= 500;
}

/**
 * Fetches a URL with retry-on-transient-failure: a failed network request
 * or a 429/5xx response is retried with exponential backoff and jitter
 * (up to maxRetries times) before giving up, since these are exactly the
 * failure modes that are often transient with the free/public APIs this
 * app depends on (OpenWeather, CDC, NWS, etc.) -- a single dropped request
 * shouldn't have to surface as an error to the user if retrying a moment
 * later would have succeeded.
 */
async function fetchWithRetry(
  url: string,
  fetchOptions: RequestInit,
  maxRetries: number,
  retryBaseDelayMs: number
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.ok || !isRetriableStatus(response.status) || attempt === maxRetries) {
        return response;
      }

      lastError = new Error(`Request failed with status ${response.status}.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      lastError = error;
      if (attempt === maxRetries) {
        throw lastError;
      }
    }

    recordEvent({
      name: "api_cache.retry",
      status: "error",
      durationMs: 0,
      attributes: { url, attempt: attempt + 1, maxRetries },
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });

    const backoff = retryBaseDelayMs * 2 ** attempt;
    const jitter = Math.random() * retryBaseDelayMs;
    await sleep(backoff + jitter);
  }

  throw lastError;
}

export async function cachedJson<T>(
  url: string,
  options: CachedJsonOptions = {}
): Promise<T> {
  const {
    cacheKey,
    ttlMs = defaultTtlMs,
    maxRetries = defaultMaxRetries,
    retryBaseDelayMs = defaultRetryBaseDelayMs,
    ...fetchOptions
  } = options;
  const key = cacheKey ?? stableRequestKey(url, fetchOptions);
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const response = await fetchWithRetry(
    url,
    fetchOptions,
    maxRetries,
    retryBaseDelayMs
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  const value = (await response.json()) as T;

  memoryCache.set(key, {
    expiresAt: now + ttlMs,
    value,
  });

  return value;
}
