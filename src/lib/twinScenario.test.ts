import { describe, expect, it } from "vitest";
import {
  computeScenarioProjection,
  computeTwinScore,
  profileModifier,
} from "./twinScenario";
import type { UserProfile } from "../services/userProfile";
import type { ForecastHour, HealthForecastData } from "../services/healthForecast";

const highProfile: UserProfile = {
  id: "p1",
  user_id: "u1",
  full_name: "Test User",
  age_range: "18-34",
  place_of_birth: null,
  car_type: "None",
  outdoor_exposure: "High",
  activity_level: "High",
  commute_exposure: "High",
  respiratory_sensitivity: "High",
  updated_at: new Date().toISOString(),
};

const lowProfile: UserProfile = {
  ...highProfile,
  outdoor_exposure: "Low",
  activity_level: "Low",
  commute_exposure: "Low",
  respiratory_sensitivity: "None",
};

function makeHour(overrides: Partial<ForecastHour>): ForecastHour {
  return {
    time: "2026-01-01T06:00:00Z",
    displayTime: "6 AM",
    score: 20,
    risk: "Low",
    usAqi: 30,
    pm25: 5,
    ozone: 30,
    apparentTemperature: 65,
    uvIndex: 2,
    alderPollen: null,
    birchPollen: null,
    grassPollen: null,
    mugwortPollen: null,
    ragweedPollen: null,
    pollenIndex: null,
    pollenRisk: "Low",
    drivers: [],
    ...overrides,
  };
}

const forecastData: HealthForecastData = {
  hours: [],
  averageScore: 40,
  peakScore: 60,
  bestWindow: makeHour({ displayTime: "6 AM", score: 20 }),
  worstWindow: makeHour({ displayTime: "2 PM", score: 60 }),
  allergyPeakWindow: null,
  allergyPeakScore: null,
  trends: [],
  statistics: {
    mean: 40,
    median: 40,
    standardDeviation: 10,
    coefficientOfVariation: 0.25,
    scoreRange: { min: 20, max: 60 },
    variabilityBand: { low: 30, high: 50 },
    peakZScore: null,
    highRiskHours: 0,
    moderateRiskHours: 0,
    signalCompleteness: 1,
    driverCorrelations: [],
  },
  summary: "Test forecast summary.",
};

describe("profileModifier", () => {
  it("returns 0 for no profile", () => {
    expect(profileModifier(null)).toBe(0);
  });

  it("sums all four factors at their High tier", () => {
    expect(profileModifier(highProfile)).toBe(8 + 6 + 10 + 4);
  });

  it("returns 0 for a profile at the lowest tier of every factor", () => {
    expect(profileModifier(lowProfile)).toBe(0);
  });
});

describe("computeTwinScore", () => {
  it("blends base score and forecast peak per the weighted formula", () => {
    const score = computeTwinScore({
      baseScore: 50,
      peakForecastScore: 50,
      profile: null,
    });
    expect(score).toBe(Math.round(50 * 0.68 + 50 * 0.22));
  });

  it("adds the profile modifier on top of the blended environmental score", () => {
    const withoutProfile = computeTwinScore({
      baseScore: 50,
      peakForecastScore: 50,
      profile: null,
    });
    const withProfile = computeTwinScore({
      baseScore: 50,
      peakForecastScore: 50,
      profile: highProfile,
    });
    expect(withProfile - withoutProfile).toBe(profileModifier(highProfile));
  });
});

describe("computeScenarioProjection", () => {
  it("current scenario matches the real twin score exactly", () => {
    const projection = computeScenarioProjection({
      scenario: "current",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: highProfile,
    });
    expect(projection.available).toBe(true);
    expect(projection.projectedScore).toBe(
      computeTwinScore({ baseScore: 50, peakForecastScore: 60, profile: highProfile })
    );
  });

  it("shift scenario uses the real forecast best-window score, not a flat constant", () => {
    const projection = computeScenarioProjection({
      scenario: "shift",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: null,
    });
    expect(projection.available).toBe(true);
    expect(projection.projectedScore).toBe(
      computeTwinScore({ baseScore: 50, peakForecastScore: 20, profile: null })
    );
    expect(projection.explanation).toContain("6 AM");
  });

  it("shift scenario is unavailable when forecast data hasn't loaded", () => {
    const projection = computeScenarioProjection({
      scenario: "shift",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData: null,
      profile: null,
    });
    expect(projection.available).toBe(false);
  });

  it("reduce scenario steps down outdoor_exposure and activity_level, and lowers the score for a High-tier profile", () => {
    const current = computeScenarioProjection({
      scenario: "current",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: highProfile,
    });
    const reduced = computeScenarioProjection({
      scenario: "reduce",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: highProfile,
    });
    expect(reduced.available).toBe(true);
    expect(reduced.projectedScore).toBeLessThan(current.projectedScore);
  });

  it("reduce scenario is unavailable with no profile", () => {
    const projection = computeScenarioProjection({
      scenario: "reduce",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: null,
    });
    expect(projection.available).toBe(false);
  });

  it("reduce scenario is a no-op (not unavailable) when already at the lowest tier", () => {
    const current = computeScenarioProjection({
      scenario: "current",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: lowProfile,
    });
    const reduced = computeScenarioProjection({
      scenario: "reduce",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: lowProfile,
    });
    expect(reduced.available).toBe(true);
    expect(reduced.projectedScore).toBe(current.projectedScore);
  });

  it("protect scenario steps down commute_exposure and respiratory_sensitivity, and lowers the score for a High-tier profile", () => {
    const current = computeScenarioProjection({
      scenario: "current",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: highProfile,
    });
    const protected_ = computeScenarioProjection({
      scenario: "protect",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: highProfile,
    });
    expect(protected_.available).toBe(true);
    expect(protected_.projectedScore).toBeLessThan(current.projectedScore);
  });

  it("protect scenario is unavailable with no profile", () => {
    const projection = computeScenarioProjection({
      scenario: "protect",
      baseScore: 50,
      peakForecastScore: 60,
      forecastData,
      profile: null,
    });
    expect(projection.available).toBe(false);
  });
});
