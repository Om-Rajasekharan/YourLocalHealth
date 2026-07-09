import { describe, expect, it, vi } from "vitest";
import { recordEvent, traceAsync } from "./observability";

describe("observability", () => {
  it("redacts secret-like attributes from logs", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordEvent({
      name: "test.event",
      status: "error",
      durationMs: 3,
      attributes: {
        zipCode: "27516",
        apiKey: "secret",
        tokenValue: "secret",
      },
      error: "failed",
    });

    const payload = warnSpy.mock.calls[0][1] as string;

    expect(payload).toContain("27516");
    expect(payload).not.toContain("secret");
    warnSpy.mockRestore();
  });

  it("returns the operation result from traceAsync", async () => {
    const result = await traceAsync("test.async", async () => 42);

    expect(result).toBe(42);
  });
});
