import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedJson, clearApiCache, getApiCacheSize } from "./apiCache";

afterEach(() => {
  clearApiCache();
  vi.restoreAllMocks();
});

describe("cachedJson", () => {
  it("reuses successful responses inside the ttl window", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 42 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await cachedJson<{ value: number }>("https://example.com/a", {
      ttlMs: 60_000,
    });
    const second = await cachedJson<{ value: number }>("https://example.com/a", {
      ttlMs: 60_000,
    });

    expect(first.value).toBe(42);
    expect(second.value).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getApiCacheSize()).toBe(1);
  });

  it("refetches when the ttl expires", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: 2 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const first = await cachedJson<{ value: number }>("https://example.com/a", {
      ttlMs: 10,
    });
    vi.advanceTimersByTime(11);
    const second = await cachedJson<{ value: number }>("https://example.com/a", {
      ttlMs: 10,
    });

    expect(first.value).toBe(1);
    expect(second.value).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("throws on unsuccessful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    await expect(cachedJson("https://example.com/b")).rejects.toThrow(
      "Request failed with status 500."
    );
  });
});
