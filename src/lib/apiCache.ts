type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CachedJsonOptions = RequestInit & {
  cacheKey?: string;
  ttlMs?: number;
};

const defaultTtlMs = 15 * 60 * 1000;
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

export async function cachedJson<T>(
  url: string,
  options: CachedJsonOptions = {}
): Promise<T> {
  const { cacheKey, ttlMs = defaultTtlMs, ...fetchOptions } = options;
  const key = cacheKey ?? stableRequestKey(url, fetchOptions);
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const response = await fetch(url, fetchOptions);

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
