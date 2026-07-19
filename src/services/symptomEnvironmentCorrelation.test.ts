import { describe, expect, it } from "vitest";
import {
  emptySymptomEnvironmentCorrelation,
  encodeRiskLevel,
  pearson,
  permutationPValue,
  rankValues,
  spearman,
} from "./symptomEnvironmentCorrelation";

describe("rankValues", () => {
  it("assigns 1-based ranks in ascending order", () => {
    expect(rankValues([30, 10, 20])).toEqual([3, 1, 2]);
  });

  it("averages ranks across ties", () => {
    // 10 -> rank 1, the two 20s split ranks 2 and 3 -> 2.5 each, 30 -> rank 4
    expect(rankValues([20, 10, 20, 30])).toEqual([2.5, 1, 2.5, 4]);
  });
});

describe("pearson", () => {
  it("is 1 for a perfectly linear relationship", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it("is -1 for a perfectly inverse relationship", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it("is 0 when one variable has no variance", () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
  });
});

describe("spearman", () => {
  it("is 1 for any monotonically increasing relationship, linear or not", () => {
    // y = x^3 isn't linear, so Pearson wouldn't be exactly 1, but rank order is preserved
    expect(spearman([1, 2, 3, 4, 5], [1, 8, 27, 64, 125])).toBeCloseTo(1, 10);
  });

  it("is -1 for a monotonically decreasing relationship", () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 10);
  });

  it("is near 0 for values with no monotonic relationship", () => {
    // symmetric V-shape: rank order of y does not track rank order of x
    expect(Math.abs(spearman([1, 2, 3, 4, 5], [3, 1, 5, 2, 4]))).toBeLessThan(
      0.5
    );
  });
});

describe("permutationPValue", () => {
  it("gives a low p-value for a strong observed correlation", () => {
    const factor = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const outcome = [2, 3, 5, 4, 6, 8, 7, 9, 10, 12];
    const rho = spearman(factor, outcome);
    const pValue = permutationPValue(
      rankValues(factor),
      outcome,
      rho,
      2000
    );
    expect(pValue).toBeLessThan(0.05);
  });

  it("gives a high p-value when the outcome is shuffled independently of the factor", () => {
    const factor = [1, 2, 3, 4, 5, 6, 7, 8];
    // Deliberately unrelated to `factor`'s rank order.
    const outcome = [5, 1, 8, 2, 7, 3, 6, 4];
    const rho = spearman(factor, outcome);
    const pValue = permutationPValue(
      rankValues(factor),
      outcome,
      rho,
      2000
    );
    expect(pValue).toBeGreaterThan(0.05);
  });

  it("always returns a value in [0, 1]", () => {
    const factor = [1, 2, 3, 4, 5];
    const outcome = [5, 4, 3, 2, 1];
    const rho = spearman(factor, outcome);
    const pValue = permutationPValue(rankValues(factor), outcome, rho, 500);
    expect(pValue).toBeGreaterThan(0);
    expect(pValue).toBeLessThanOrEqual(1);
  });
});

describe("encodeRiskLevel", () => {
  it("maps known risk labels to an ordinal scale", () => {
    expect(encodeRiskLevel("Low")).toBe(0);
    expect(encodeRiskLevel("Moderate")).toBe(1);
    expect(encodeRiskLevel("High")).toBe(2);
  });

  it("returns null for unknown or missing labels", () => {
    expect(encodeRiskLevel("Unknown")).toBeNull();
    expect(encodeRiskLevel(null)).toBeNull();
  });
});

describe("emptySymptomEnvironmentCorrelation", () => {
  it("defaults to an insufficient-data state with no factors", () => {
    const result = emptySymptomEnvironmentCorrelation();
    expect(result.status).toBe("insufficient_data");
    expect(result.topFactor).toBeNull();
    expect(result.allFactors).toEqual([]);
    expect(result.totalCheckins).toBe(0);
  });
});
