import type { DataStatus } from "../lib/riskModel";
import type { UserProfile } from "./userProfile";
import type { CovidActivityData } from "./covid";
import type { HealthEquityData } from "./healthEquity";
import type { HealthForecastData } from "./healthForecast";

export type FeatureSnapshot = {
  generatedAt: string;
  zipCode: string;
  location: {
    city: string;
    state: string;
    latitude: string;
    longitude: string;
  };
  modelInputs: {
    aqi: number | null;
    pm25: number | null;
    ozone: number | null;
    heatRisk: string;
    uvRisk: string;
    alertRisk: string;
    fluActivity: string;
    covidActivity: string;
    covidCoverage: string;
    forecastAverageScore: number | null;
    forecastPeakScore: number | null;
    forecastSignalCompleteness: number | null;
    equityScore: number | null;
    chronicBurdenScore: number | null;
    profileModifier: number;
  };
  sourceCoverage: {
    loaded: number;
    total: number;
    percent: number;
  };
  missingSources: string[];
  mlReadiness: "Ready" | "Partial" | "Insufficient";
};

const sourceLabels: Record<keyof DataStatus, string> = {
  airQuality: "air quality",
  pollutants: "pollutants",
  heatUv: "heat and UV",
  weatherAlerts: "weather alerts",
  flu: "flu activity",
  covid: "COVID wastewater",
  news: "local news",
};

function sourceCoverage(dataStatus: DataStatus) {
  const entries = Object.entries(dataStatus) as [keyof DataStatus, boolean][];
  const loaded = entries.filter(([, available]) => available).length;
  const total = entries.length;

  return {
    loaded,
    total,
    percent: total === 0 ? 0 : Math.round((loaded / total) * 100),
  };
}

function readiness(percent: number): FeatureSnapshot["mlReadiness"] {
  if (percent >= 80) return "Ready";
  if (percent >= 50) return "Partial";
  return "Insufficient";
}

export function buildFeatureSnapshot(input: {
  zipCode: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  aqi: number | null;
  airComponents: Record<string, number> | undefined;
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  fluActivity: string;
  covidData: CovidActivityData | null;
  forecastData: HealthForecastData | null;
  equityData: HealthEquityData | null;
  profileModifier: number;
  dataStatus: DataStatus;
}): FeatureSnapshot {
  const coverage = sourceCoverage(input.dataStatus);
  const missingSources = (
    Object.entries(input.dataStatus) as [keyof DataStatus, boolean][]
  )
    .filter(([, available]) => !available)
    .map(([source]) => sourceLabels[source]);

  return {
    generatedAt: new Date().toISOString(),
    zipCode: input.zipCode,
    location: {
      city: input.city,
      state: input.state,
      latitude: input.latitude,
      longitude: input.longitude,
    },
    modelInputs: {
      aqi: input.aqi,
      pm25: input.airComponents?.pm2_5 ?? null,
      ozone: input.airComponents?.o3 ?? null,
      heatRisk: input.heatRisk,
      uvRisk: input.uvRisk,
      alertRisk: input.alertRisk,
      fluActivity: input.fluActivity,
      covidActivity: input.covidData?.activity ?? "Unknown",
      covidCoverage: input.covidData?.coverage ?? "Unknown",
      forecastAverageScore: input.forecastData?.averageScore ?? null,
      forecastPeakScore: input.forecastData?.peakScore ?? null,
      forecastSignalCompleteness:
        input.forecastData?.statistics.signalCompleteness ?? null,
      equityScore: input.equityData?.equityScore ?? null,
      chronicBurdenScore:
        input.equityData?.cdcPlaces?.chronicBurdenScore ?? null,
      profileModifier: input.profileModifier,
    },
    sourceCoverage: coverage,
    missingSources,
    mlReadiness: readiness(coverage.percent),
  };
}

export function featureSnapshotSummary(snapshot: FeatureSnapshot) {
  const missing =
    snapshot.missingSources.length === 0
      ? "all source groups loaded"
      : `missing ${snapshot.missingSources.slice(0, 2).join(", ")}`;

  return `${snapshot.mlReadiness} ML feature snapshot: ${snapshot.sourceCoverage.percent}% source coverage, ${missing}.`;
}

export function profileModifierForSnapshot(profile: UserProfile | null) {
  if (!profile) return 0;

  return [
    profile.outdoor_exposure === "High" ? 8 : profile.outdoor_exposure === "Moderate" ? 4 : 0,
    profile.commute_exposure === "High" ? 6 : profile.commute_exposure === "Moderate" ? 3 : 0,
    profile.respiratory_sensitivity === "High" ? 10 : profile.respiratory_sensitivity === "Mild" ? 5 : 0,
    profile.activity_level === "High" ? 4 : profile.activity_level === "Moderate" ? 2 : 0,
  ].reduce((total, value) => total + value, 0);
}
