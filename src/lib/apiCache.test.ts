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

  it("throws on unsuccessful responses once retries are exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    await expect(
      cachedJson("https://example.com/b", { maxRetries: 0 })
    ).rejects.toThrow("Request failed with status 500.");
  });

  it("retries a 500 response and succeeds on the second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 7 }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await cachedJson<{ value: number }>("https://example.com/c", {
      maxRetries: 1,
      retryBaseDelayMs: 1,
    });

    expect(result.value).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a rejected fetch (network error) and succeeds on the second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 9 }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await cachedJson<{ value: number }>("https://example.com/d", {
      maxRetries: 1,
      retryBaseDelayMs: 1,
    });

    expect(result.value).toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retriable client error status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cachedJson("https://example.com/e", { maxRetries: 2, retryBaseDelayMs: 1 })
    ).rejects.toThrow("Request failed with status 404.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an intentionally aborted request", async () => {
    const abortError = new DOMException("aborted", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cachedJson("https://example.com/f", { maxRetries: 2, retryBaseDelayMs: 1 })
    ).rejects.toThrow("aborted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
