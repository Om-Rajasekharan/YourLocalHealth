import { describe, expect, it } from "vitest";
import {
  buildFeatureSnapshot,
  featureSnapshotSummary,
  profileModifierForSnapshot,
} from "./featureSnapshot";

describe("buildFeatureSnapshot", () => {
  it("summarizes model-ready predictors and source coverage", () => {
    const snapshot = buildFeatureSnapshot({
      zipCode: "27516",
      city: "Chapel Hill",
      state: "NC",
      latitude: "35.9",
      longitude: "-79.0",
      aqi: 2,
      airComponents: { pm2_5: 6.4, o3: 68.2 },
      heatRisk: "Moderate",
      uvRisk: "High",
      alertRisk: "None",
      fluActivity: "Low",
      covidData: {
        activity: "Very Low",
        value: 1.2,
        numberOfSites: 6,
        coverage: "Standard",
        timePeriod: "Latest",
        updatedAt: "Today",
        weekEnd: "Today",
      },
      forecastData: null,
      equityData: null,
      profileModifier: 10,
      dataStatus: {
        airQuality: true,
        pollutants: true,
        heatUv: true,
        weatherAlerts: true,
        flu: true,
        covid: true,
        news: false,
      },
    });

    expect(snapshot.modelInputs.pm25).toBe(6.4);
    expect(snapshot.modelInputs.ozone).toBe(68.2);
    expect(snapshot.sourceCoverage.percent).toBe(86);
    expect(snapshot.mlReadiness).toBe("Ready");
    expect(snapshot.missingSources).toEqual(["local news"]);
    expect(featureSnapshotSummary(snapshot)).toContain("Ready ML feature snapshot");
  });

  it("turns profile fields into a numeric feature", () => {
    const modifier = profileModifierForSnapshot({
      id: "profile-1",
      user_id: "user-1",
      full_name: "Test User",
      age_range: "18-34",
      place_of_birth: null,
      car_type: "Gas",
      outdoor_exposure: "High",
      activity_level: "Moderate",
      commute_exposure: "Moderate",
      respiratory_sensitivity: "Mild",
      updated_at: "today",
    });

    expect(modifier).toBe(18);
  });
});
