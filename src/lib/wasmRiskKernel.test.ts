import { describe, expect, it } from "vitest";
import { crossCheckRiskScore } from "./wasmRiskKernel";

// These load and execute the real compiled WASM module (native/wasm/dist/
// risk_kernel_wasm.mjs) rather than mocking it -- it's a small, fast,
// deterministic, self-contained artifact, so there's more value in
// verifying the actual compiled output works than in mocking it away.
describe("crossCheckRiskScore", () => {
  const signals = [
    { value: "High", maxPoints: 18 },
    { value: "Moderate", maxPoints: 16 },
    { value: "Low", maxPoints: 14 },
    { value: "Low", maxPoints: 8 },
    { value: "Low", maxPoints: 12 },
    { value: "Moderate", maxPoints: 14 },
    { value: "High", maxPoints: 14 },
    { value: "", maxPoints: 10 },
  ];

  it("agrees with the correct expected score", async () => {
    // totalPoints = 18 + 8 + 0 + 0 + 0 + 7 + 14 + 0 = 47, totalMax = 106
    const expectedScore = Math.round((47 / 106) * 100);

    const result = await crossCheckRiskScore(signals, expectedScore);

    expect(result).not.toBeNull();
    expect(result?.wasmScore).toBe(expectedScore);
    expect(result?.agrees).toBe(true);
  });

  it("reports disagreement when the expected score is wrong", async () => {
    const result = await crossCheckRiskScore(signals, 999);

    expect(result).not.toBeNull();
    expect(result?.agrees).toBe(false);
  });

  it("handles an all-low, all-empty-weight edge case without throwing", async () => {
    const result = await crossCheckRiskScore(
      [{ value: "Low", maxPoints: 0 }],
      0
    );

    expect(result).not.toBeNull();
    expect(result?.wasmScore).toBe(0);
  });
});
