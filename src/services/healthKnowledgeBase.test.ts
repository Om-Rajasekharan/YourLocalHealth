import { afterEach, describe, expect, it, vi } from "vitest";

const { rpcMock, supabaseMock, mockRpcResult } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  // The real supabase-js .rpc() call is chained with .abortSignal(signal)
  // in the implementation, so the mock needs to support that chain.
  const mockRpcResult = (result: { data: unknown; error: unknown }) => {
    rpcMock.mockReturnValue({
      abortSignal: () => Promise.resolve(result),
    });
  };
  return {
    rpcMock,
    supabaseMock: { rpc: rpcMock },
    mockRpcResult,
  };
});

vi.mock("../lib/supabaseClient", () => ({
  get supabase() {
    return (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride ?? supabaseMock;
  },
}));

import { retrieveKnowledgeSnippets } from "./healthKnowledgeBase";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  rpcMock.mockReset();
  delete (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride;
});

describe("retrieveKnowledgeSnippets", () => {
  it("returns matched snippets on a successful embed + rpc call", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      })
    );
    mockRpcResult({
      data: [
        {
          topic: "Air Quality Index (AQI)",
          source: "U.S. EPA -- Air Quality Index guidance",
          content: "The AQI is a 0-500 scale...",
          similarity: 0.87,
        },
      ],
      error: null,
    });

    const result = await retrieveKnowledgeSnippets("Is today's air quality bad?");

    expect(result).toHaveLength(1);
    expect(result?.[0].topic).toBe("Air Quality Index (AQI)");
    expect(rpcMock).toHaveBeenCalledWith("match_health_knowledge", {
      query_embedding: [0.1, 0.2, 0.3],
      match_count: 4,
    });
  });

  it("returns null when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await retrieveKnowledgeSnippets("What is PM2.5?");

    expect(result).toBeNull();
  });

  it("returns null when the embeddings request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await retrieveKnowledgeSnippets("What is ozone?");

    expect(result).toBeNull();
  });

  it("returns null when the Supabase RPC call errors (e.g. table not seeded yet)", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
      })
    );
    mockRpcResult({
      data: null,
      error: { message: 'relation "health_knowledge_base" does not exist' },
    });

    const result = await retrieveKnowledgeSnippets("What is UV index?");

    expect(result).toBeNull();
  });

  it("returns null when Supabase is not configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    (globalThis as { __supabaseOverride?: unknown }).__supabaseOverride = null;

    const result = await retrieveKnowledgeSnippets("What is wildfire smoke?");

    expect(result).toBeNull();
  });
});
