import { describe, expect, it } from "vitest";
import {
  buildForecastStatistics,
  type ForecastHour,
} from "./healthForecast";

function hour(
  score: number,
  overrides: Partial<ForecastHour> = {}
): ForecastHour {
  return {
    time: `2026-07-09T${String(score).padStart(2, "0")}:00`,
    displayTime: `${score}:00`,
    score,
    risk: score >= 67 ? "High" : score >= 34 ? "Moderate" : "Low",
    usAqi: score,
    pm25: score / 2,
    ozone: 100 - score,
    apparentTemperature: 70 + score / 10,
    uvIndex: score / 10,
    alderPollen: null,
    birchPollen: null,
    grassPollen: null,
    mugwortPollen: null,
    ragweedPollen: null,
    pollenIndex: null,
    pollenRisk: "Unknown",
    drivers: [],
    ...overrides,
  };
}

describe("buildForecastStatistics", () => {
  it("summarizes the hourly risk-score distribution", () => {
    const statistics = buildForecastStatistics([
      hour(20),
      hour(40),
      hour(60),
      hour(80),
    ]);

    expect(statistics.mean).toBe(50);
    expect(statistics.median).toBe(50);
    expect(statistics.standardDeviation).toBe(25.8);
    expect(statistics.scoreRange).toEqual({ min: 20, max: 80 });
    expect(statistics.variabilityBand).toEqual({ low: 24, high: 76 });
    expect(statistics.peakZScore).toBe(1.16);
    expect(statistics.highRiskHours).toBe(1);
    expect(statistics.moderateRiskHours).toBe(2);
  });

  it("tracks signal completeness from available hourly fields", () => {
    const statistics = buildForecastStatistics([
      hour(35, { pollenIndex: 10 }),
      hour(45, { usAqi: null, pm25: null, ozone: null, pollenIndex: null }),
    ]);

    expect(statistics.signalCompleteness).toBe(67);
  });

  it("computes descriptive driver correlations", () => {
    const statistics = buildForecastStatistics([
      hour(20, { usAqi: 20, ozone: 80 }),
      hour(40, { usAqi: 40, ozone: 60 }),
      hour(60, { usAqi: 60, ozone: 40 }),
      hour(80, { usAqi: 80, ozone: 20 }),
    ]);

    const aqiCorrelation = statistics.driverCorrelations.find(
      (driver) => driver.label === "AQI"
    );
    const ozoneCorrelation = statistics.driverCorrelations.find(
      (driver) => driver.label === "Ozone"
    );

    expect(aqiCorrelation).toMatchObject({
      coefficient: 1,
      direction: "Positive",
      n: 4,
    });
    expect(ozoneCorrelation).toMatchObject({
      coefficient: -1,
      direction: "Negative",
      n: 4,
    });
  });

  it("handles sparse data without pretending correlation exists", () => {
    const statistics = buildForecastStatistics([
      hour(30, { pollenIndex: null }),
      hour(50, { pollenIndex: 12 }),
    ]);
    const pollenCorrelation = statistics.driverCorrelations.find(
      (driver) => driver.label === "Pollen index"
    );

    expect(pollenCorrelation).toMatchObject({
      coefficient: null,
      direction: "Insufficient data",
      n: 1,
    });
  });
});
