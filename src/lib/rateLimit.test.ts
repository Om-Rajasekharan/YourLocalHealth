import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRateLimitBuckets, rateLimit } from "./rateLimit";

afterEach(() => {
  clearRateLimitBuckets();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests until the configured limit", () => {
    expect(rateLimit({ key: "a", limit: 2, windowMs: 1000 }).allowed).toBe(true);
    expect(rateLimit({ key: "a", limit: 2, windowMs: 1000 }).allowed).toBe(true);

    const blocked = rateLimit({ key: "a", limit: 2, windowMs: 1000 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();

    expect(rateLimit({ key: "a", limit: 1, windowMs: 1000 }).allowed).toBe(true);
    expect(rateLimit({ key: "a", limit: 1, windowMs: 1000 }).allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(rateLimit({ key: "a", limit: 1, windowMs: 1000 }).allowed).toBe(true);
  });
});
