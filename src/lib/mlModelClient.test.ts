import { afterEach, describe, expect, it, vi } from "vitest";
import { getMlPredictions } from "./mlModelClient";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getMlPredictions", () => {
  it("returns parsed predictions with SHAP top drivers on a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        predictions: {
          felt_impact: {
            probability: 0.82,
            trainingPositiveRate: 0.8,
            topDrivers: [{ feature: "heat_risk", impact: 0.05 }],
          },
        },
        modelsAvailable: ["felt_impact"],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMlPredictions({ aqi: 3, city: "Los Angeles" });

    expect(result?.predictions.felt_impact.probability).toBe(0.82);
    expect(result?.predictions.felt_impact.topDrivers).toEqual([
      { feature: "heat_risk", impact: 0.05 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the service responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    const result = await getMlPredictions({ aqi: 3 });

    expect(result).toBeNull();
  });

  it("returns null when the service is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"))
    );

    const result = await getMlPredictions({ aqi: 3 });

    expect(result).toBeNull();
  });

  it("returns null when the response shape is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: "shape" }),
      })
    );

    const result = await getMlPredictions({ aqi: 3 });

    expect(result).toBeNull();
  });
});
