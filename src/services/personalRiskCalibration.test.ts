import { describe, expect, it } from "vitest";
import {
  conjugateNormalUpdate,
  ordinaryLeastSquaresSlope,
} from "./personalRiskCalibration";

describe("ordinaryLeastSquaresSlope", () => {
  it("recovers the exact slope from a perfectly linear relationship", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = xs.map((x) => 3 * x + 7);
    const result = ordinaryLeastSquaresSlope(xs, ys);

    expect(result).not.toBeNull();
    expect(result!.beta).toBeCloseTo(3, 8);
    expect(result!.se).toBeCloseTo(0, 6);
    expect(result!.n).toBe(10);
  });

  it("recovers a negative slope from a perfectly inverse relationship", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = xs.map((x) => 100 - 4 * x);
    const result = ordinaryLeastSquaresSlope(xs, ys);

    expect(result).not.toBeNull();
    expect(result!.beta).toBeCloseTo(-4, 8);
  });

  it("returns a near-zero slope for symmetric data with no real relationship", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [5, 3, 6, 2, 7, 1, 8, 4, 6, 3];
    const result = ordinaryLeastSquaresSlope(xs, ys);

    expect(result).not.toBeNull();
    expect(Math.abs(result!.beta)).toBeLessThan(0.5);
  });

  it("refuses to compute below the minimum sample size", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ys = [2, 4, 6, 8, 10, 12, 14, 16, 18];
    expect(ordinaryLeastSquaresSlope(xs, ys)).toBeNull();
  });

  it("refuses to compute when the factor is effectively constant", () => {
    const xs = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const ys = [2, 4, 5, 4, 5, 2, 4, 5, 4, 5];
    expect(ordinaryLeastSquaresSlope(xs, ys)).toBeNull();
  });

  it("returns null when xs and ys have mismatched lengths", () => {
    expect(ordinaryLeastSquaresSlope([1, 2, 3], [1, 2])).toBeNull();
  });
});

describe("conjugateNormalUpdate", () => {
  it("splits the difference evenly when prior and user precision are equal", () => {
    // priorVariance = 4 -> priorPrecision = 0.25; userSE = 2 -> userPrecision = 0.25
    const result = conjugateNormalUpdate(0, 4, 2, 2);

    expect(result.posteriorMean).toBeCloseTo(1, 8);
    expect(result.trustWeightPct).toBe(50);
  });

  it("converges to the user's own slope as their SE shrinks toward zero", () => {
    const result = conjugateNormalUpdate(0, 100, 5, 0.01);

    expect(result.posteriorMean).toBeCloseTo(5, 2);
    expect(result.trustWeightPct).toBe(100);
  });

  it("converges to the population prior as the user's SE grows large", () => {
    const result = conjugateNormalUpdate(3, 1, 10, 100);

    expect(result.posteriorMean).toBeCloseTo(3, 2);
    expect(result.trustWeightPct).toBe(0);
  });

  it("weights the posterior toward whichever side has higher precision", () => {
    // userPrecision (1/1=1) is 4x priorPrecision (1/4=0.25) -> user should dominate
    const result = conjugateNormalUpdate(0, 4, 8, 1);

    expect(result.trustWeightPct).toBeGreaterThan(50);
    expect(result.posteriorMean).toBeGreaterThan(4);
  });

  it("stays finite when priorVariance is degenerate (near zero)", () => {
    const result = conjugateNormalUpdate(0, 0, 5, 2);

    expect(Number.isFinite(result.posteriorMean)).toBe(true);
    expect(Number.isFinite(result.posteriorVariance)).toBe(true);
    expect(Number.isFinite(result.trustWeightPct)).toBe(true);
  });

  it("stays finite when userSE is degenerate (near zero)", () => {
    const result = conjugateNormalUpdate(0, 4, 5, 0);

    expect(Number.isFinite(result.posteriorMean)).toBe(true);
    expect(Number.isFinite(result.posteriorVariance)).toBe(true);
    expect(Number.isFinite(result.trustWeightPct)).toBe(true);
  });
});
