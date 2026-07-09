import { describe, expect, it } from "vitest";
import { evaluateRiskModel, type DataStatus } from "./riskModel";

const completeStatus: DataStatus = {
  airQuality: true,
  pollutants: true,
  heatUv: true,
  weatherAlerts: true,
  flu: true,
  covid: true,
  news: true,
};

describe("evaluateRiskModel", () => {
  it("keeps low signals low and reports high data confidence", () => {
    const result = evaluateRiskModel({
      aqi: 1,
      airQualityLabel: "Good",
      pollutantRisk: "Low",
      heatRisk: "Low",
      uvRisk: "Low",
      alertRisk: "Low",
      fluActivity: "Very Low",
      covidActivity: "Very Low",
      covidCoverage: "High Coverage",
      dataStatus: completeStatus,
      profile: null,
    });

    expect(result.healthRisk).toBe("Low");
    expect(result.respiratoryRisk).toBe("Low");
    expect(result.scoreBreakdown.scoreLabel).toBe("Low");
    expect(result.dataConfidence.label).toBe("High");
  });

  it("elevates health and respiratory risk when respiratory signals are high", () => {
    const result = evaluateRiskModel({
      aqi: 4,
      airQualityLabel: "Poor",
      pollutantRisk: "High",
      heatRisk: "Low",
      uvRisk: "Low",
      alertRisk: "Low",
      fluActivity: "High",
      covidActivity: "Moderate",
      covidCoverage: "High Coverage",
      dataStatus: completeStatus,
      profile: null,
    });

    expect(result.healthRisk).toBe("High");
    expect(result.respiratoryRisk).toBe("High");
    expect(result.scoreBreakdown.topDrivers[0]?.points).toBeGreaterThan(0);
  });

  it("records missing source groups as caveats", () => {
    const result = evaluateRiskModel({
      aqi: null,
      airQualityLabel: "Unknown",
      pollutantRisk: "Unknown",
      heatRisk: "Unknown",
      uvRisk: "Unknown",
      alertRisk: "Unknown",
      fluActivity: "Unknown",
      covidActivity: "Unknown",
      covidCoverage: "Limited Coverage",
      dataStatus: {
        airQuality: false,
        pollutants: false,
        heatUv: false,
        weatherAlerts: true,
        flu: false,
        covid: false,
        news: false,
      },
      profile: null,
    });

    expect(result.dataConfidence.label).toBe("Low");
    expect(result.dataConfidence.caveats).toContain("Air quality did not load.");
    expect(result.dataConfidence.caveats).toContain(
      "COVID wastewater coverage is limited for this area."
    );
  });
});
