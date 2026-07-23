import { describe, expect, it } from "vitest";
import { describeForecastStability } from "./forecastStatsCopy";
import type { ForecastStatistics } from "../services/healthForecast";

function makeStatistics(overrides: Partial<ForecastStatistics>): ForecastStatistics {
  return {
    mean: 30,
    median: 30,
    standardDeviation: 10,
    coefficientOfVariation: 30,
    scoreRange: { min: 15, max: 54 },
    variabilityBand: { low: 20, high: 40 },
    peakZScore: 1.2,
    highRiskHours: 0,
    moderateRiskHours: 5,
    signalCompleteness: 90,
    driverCorrelations: [],
    ...overrides,
  };
}

describe("describeForecastStability", () => {
  it("labels a low coefficient of variation as a fairly steady day", () => {
    const result = describeForecastStability(makeStatistics({ coefficientOfVariation: 10 }));
    expect(result.variabilityLabel).toBe("Fairly steady day");
    expect(result.headline).toContain("won't change your exposure much");
  });

  it("labels a very high coefficient of variation as highly variable", () => {
    const result = describeForecastStability(makeStatistics({ coefficientOfVariation: 60 }));
    expect(result.variabilityLabel).toBe("Highly variable day");
  });

  it("leads with the sharp-peak headline when the peak z-score is a clear outlier", () => {
    const result = describeForecastStability(
      makeStatistics({ coefficientOfVariation: 50, peakZScore: 2.5 })
    );
    expect(result.headline).toContain("stands out sharply");
    expect(result.peakZScoreCaption).toContain("stands out sharply");
  });

  it("does not claim a sharp peak when the peak z-score is null", () => {
    const result = describeForecastStability(
      makeStatistics({ coefficientOfVariation: 50, peakZScore: null })
    );
    expect(result.headline).not.toContain("stands out sharply");
    expect(result.peakZScoreCaption).toBe("No hour is a dramatic outlier today.");
  });

  it("handles a null coefficient of variation without throwing", () => {
    const result = describeForecastStability(
      makeStatistics({ coefficientOfVariation: null, peakZScore: null })
    );
    expect(result.variabilityLabel).toBe("Not enough data to gauge steadiness");
    expect(result.headline).toBeTruthy();
  });

  it("always returns a non-empty correlation explainer", () => {
    const result = describeForecastStability(makeStatistics({}));
    expect(result.correlationExplainer.length).toBeGreaterThan(0);
  });
});
