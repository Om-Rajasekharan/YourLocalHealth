import { afterEach, describe, expect, it, vi } from "vitest";

const { rpcMock, supabaseMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return {
    rpcMock,
    supabaseMock: { rpc: rpcMock },
  };
});

vi.mock("./supabaseClient", () => ({
  get supabase() {
    return (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride ?? null;
  },
}));

import { clearRateLimitBuckets, rateLimit } from "./rateLimit";

function mockRpcResult(result: {
  data: { allowed: boolean; current_count: number; reset_at: string } | null;
  error: { message: string } | null;
}) {
  rpcMock.mockReturnValue({
    abortSignal: () => ({
      single: () => Promise.resolve(result),
    }),
  });
}

afterEach(() => {
  clearRateLimitBuckets();
  vi.useRealTimers();
  rpcMock.mockReset();
  delete (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride;
});

describe("rateLimit (in-memory fallback, Supabase not configured)", () => {
  it("allows requests until the configured limit", async () => {
    expect((await rateLimit({ key: "a", limit: 2, windowMs: 1000 })).allowed).toBe(true);
    expect((await rateLimit({ key: "a", limit: 2, windowMs: 1000 })).allowed).toBe(true);

    const blocked = await rateLimit({ key: "a", limit: 2, windowMs: 1000 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", async () => {
    vi.useFakeTimers();

    expect((await rateLimit({ key: "a", limit: 1, windowMs: 1000 })).allowed).toBe(true);
    expect((await rateLimit({ key: "a", limit: 1, windowMs: 1000 })).allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect((await rateLimit({ key: "a", limit: 1, windowMs: 1000 })).allowed).toBe(true);
  });
});

describe("rateLimit (Supabase-backed, cross-instance)", () => {
  it("uses the shared Postgres counter when the RPC call succeeds", async () => {
    (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride = supabaseMock;
    mockRpcResult({
      data: { allowed: true, current_count: 5, reset_at: new Date(Date.now() + 30_000).toISOString() },
      error: null,
    });

    const result = await rateLimit({ key: "shared", limit: 10, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "shared",
      p_limit: 10,
      p_window_seconds: 60,
    });
  });

  it("reports blocked once the shared counter exceeds the limit", async () => {
    (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride = supabaseMock;
    mockRpcResult({
      data: { allowed: false, current_count: 11, reset_at: new Date(Date.now() + 30_000).toISOString() },
      error: null,
    });

    const result = await rateLimit({ key: "shared", limit: 10, windowMs: 60_000 });

    expect(result.allowed).toBe(false);
  });

  it("falls back to in-memory limiting when the RPC call errors (e.g. migration not run yet)", async () => {
    (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride = supabaseMock;
    mockRpcResult({
      data: null,
      error: { message: 'function "check_rate_limit" does not exist' },
    });

    const result = await rateLimit({ key: "unseeded", limit: 5, windowMs: 60_000 });

    // Falls back to the in-memory path instead of throwing or blocking everything.
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
