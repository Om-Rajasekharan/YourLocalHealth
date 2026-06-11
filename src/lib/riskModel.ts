import type { UserProfile } from "../services/userProfile";
import {
  calculateHealthRisk,
  calculateRespiratoryRisk,
} from "./healthRisk";
import { personalizeRisk } from "./personalizedRisk";

export const RISK_MODEL_VERSION = "YourLocalHealth Risk Model v1.1";

export type DataStatus = {
  airQuality: boolean;
  pollutants: boolean;
  heatUv: boolean;
  weatherAlerts: boolean;
  flu: boolean;
  covid: boolean;
  news: boolean;
};

export type RiskModelInput = {
  aqi: number | null;
  airQualityLabel: string;
  pollutantRisk: string;
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  fluActivity: string;
  covidActivity: string;
  covidCoverage: string;
  dataStatus: DataStatus;
  profile: UserProfile | null;
};

export type RiskModelItem = {
  label: string;
  points: number;
  detail: string;
  category: string;
  maxPoints: number;
  weight: string;
};

export type RiskCategoryScore = {
  label: string;
  score: number;
  detail: string;
};

export type RiskModelConfidence = {
  label: string;
  availableCount: number;
  totalCount: number;
  sources: {
    label: string;
    available: boolean;
    source: string;
  }[];
  caveats: string[];
};

function signalSeverity(value: string) {
  if (
    value === "High" ||
    value === "Very High" ||
    value === "Poor" ||
    value === "Very Poor"
  ) {
    return 1;
  }

  if (
    value === "Moderate" ||
    value === "Fair" ||
    value === "Limited Coverage"
  ) {
    return 0.5;
  }

  return 0;
}

function weightedPoints(value: string, maxPoints: number) {
  return Math.round(signalSeverity(value) * maxPoints);
}

function scoreToRisk(score: number) {
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

function weightedAverage(
  items: { value: string; maxPoints: number }[],
  extraPoints = 0,
  extraMaxPoints = 0
) {
  const points =
    items.reduce(
      (total, item) => total + weightedPoints(item.value, item.maxPoints),
      0
    ) + extraPoints;
  const maxPoints =
    items.reduce((total, item) => total + item.maxPoints, 0) +
    extraMaxPoints;

  if (maxPoints === 0) return 0;

  return Math.round((points / maxPoints) * 100);
}

function buildScoreBreakdown({
  airQualityLabel,
  pollutantRisk,
  heatRisk,
  uvRisk,
  alertRisk,
  fluActivity,
  covidActivity,
  personalizedRiskReasons,
}: {
  airQualityLabel: string;
  pollutantRisk: string;
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  fluActivity: string;
  covidActivity: string;
  personalizedRiskReasons: string[];
}) {
  const profilePoints = personalizedRiskReasons.length > 0 ? 10 : 0;
  const items: RiskModelItem[] = [
    {
      label: "Air quality",
      points: weightedPoints(airQualityLabel, 18),
      detail: airQualityLabel,
      category: "Respiratory / outdoor exposure",
      maxPoints: 18,
      weight: "Very high",
    },
    {
      label: "Pollutant signal",
      points: weightedPoints(pollutantRisk, 16),
      detail: pollutantRisk,
      category: "Respiratory / outdoor exposure",
      maxPoints: 16,
      weight: "Very high",
    },
    {
      label: "Heat",
      points: weightedPoints(heatRisk, 14),
      detail: heatRisk,
      category: "Heat stress",
      maxPoints: 14,
      weight: "High",
    },
    {
      label: "UV",
      points: weightedPoints(uvRisk, 8),
      detail: uvRisk,
      category: "Sun exposure",
      maxPoints: 8,
      weight: "Medium",
    },
    {
      label: "Official alerts",
      points: weightedPoints(alertRisk, 12),
      detail: alertRisk,
      category: "Acute local hazard",
      maxPoints: 12,
      weight: "High",
    },
    {
      label: "Flu activity",
      points: weightedPoints(fluActivity, 14),
      detail: fluActivity,
      category: "Infectious disease",
      maxPoints: 14,
      weight: "High",
    },
    {
      label: "COVID wastewater",
      points: weightedPoints(covidActivity, 14),
      detail: covidActivity,
      category: "Infectious disease",
      maxPoints: 14,
      weight: "High",
    },
    {
      label: "Profile factors",
      points: profilePoints,
      detail:
        personalizedRiskReasons.length > 0
          ? personalizedRiskReasons.join(", ")
          : "No added profile risk",
      category: "Personal vulnerability",
      maxPoints: 10,
      weight: "Personal modifier",
    },
  ];
  const totalPoints = items.reduce((total, item) => total + item.points, 0);
  const totalMaxPoints = items.reduce(
    (total, item) => total + item.maxPoints,
    0
  );
  const score = Math.round((totalPoints / totalMaxPoints) * 100);

  return {
    score,
    scoreLabel: scoreToRisk(score),
    items,
    topDrivers: items
      .filter((item) => item.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 4),
    categoryScores: [
      {
        label: "Respiratory",
        score: weightedAverage(
          [
            { value: airQualityLabel, maxPoints: 18 },
            { value: pollutantRisk, maxPoints: 16 },
            { value: fluActivity, maxPoints: 14 },
            { value: covidActivity, maxPoints: 14 },
            { value: alertRisk, maxPoints: 8 },
          ],
          profilePoints,
          10
        ),
        detail: "Air quality, pollutants, flu, COVID wastewater, alerts, and profile sensitivity.",
      },
      {
        label: "Infectious disease",
        score: weightedAverage([
          { value: fluActivity, maxPoints: 14 },
          { value: covidActivity, maxPoints: 14 },
        ]),
        detail: "Current CDC flu and wastewater COVID activity.",
      },
      {
        label: "Outdoor environment",
        score: weightedAverage([
          { value: airQualityLabel, maxPoints: 18 },
          { value: pollutantRisk, maxPoints: 16 },
          { value: heatRisk, maxPoints: 14 },
          { value: uvRisk, maxPoints: 8 },
          { value: alertRisk, maxPoints: 12 },
        ]),
        detail: "Air, pollutant, heat, UV, and official alert conditions.",
      },
      {
        label: "Personal modifier",
        score: Math.round((profilePoints / 10) * 100),
        detail: "Saved profile factors that may increase vulnerability or exposure.",
      },
    ] satisfies RiskCategoryScore[],
  };
}

function buildDataConfidence({
  status,
  covidCoverage,
}: {
  status: DataStatus;
  covidCoverage: string;
}): RiskModelConfidence {
  const sources = [
    {
      label: "Air quality",
      available: status.airQuality,
      source: "OpenWeather",
    },
    {
      label: "Pollutants",
      available: status.pollutants,
      source: "OpenWeather",
    },
    {
      label: "Heat and UV",
      available: status.heatUv,
      source: "Open-Meteo",
    },
    {
      label: "Official alerts",
      available: status.weatherAlerts,
      source: "National Weather Service",
    },
    {
      label: "Flu activity",
      available: status.flu,
      source: "CDC",
    },
    {
      label: "COVID wastewater",
      available: status.covid,
      source: "CDC NWSS",
    },
    {
      label: "Local news",
      available: status.news,
      source: "GDELT / Google News",
    },
  ];
  const availableCount = sources.filter((source) => source.available).length;
  const label =
    availableCount >= 6
      ? "High"
      : availableCount >= 4
      ? "Medium"
      : "Low";
  const caveats = [
    ...sources
      .filter((source) => !source.available)
      .map((source) => `${source.label} did not load.`),
    covidCoverage === "Limited Coverage"
      ? "COVID wastewater coverage is limited for this area."
      : "",
  ].filter(Boolean);

  return {
    label,
    availableCount,
    totalCount: sources.length,
    sources,
    caveats,
  };
}

export function evaluateRiskModel(input: RiskModelInput) {
  const baseHealthRisk = calculateHealthRisk(
    input.aqi,
    input.fluActivity,
    input.covidActivity,
    {
      heatRisk: input.heatRisk,
      uvRisk: input.uvRisk,
      alertRisk: input.alertRisk,
      pollutantRisk: input.pollutantRisk,
    }
  );
  const baseRespiratoryRisk = calculateRespiratoryRisk(
    input.aqi,
    input.fluActivity,
    input.covidActivity,
    {
      alertRisk: input.alertRisk,
      pollutantRisk: input.pollutantRisk,
    }
  );
  const personalizedRisk = personalizeRisk(
    baseHealthRisk,
    baseRespiratoryRisk,
    input.profile
  );
  const scoreBreakdown = buildScoreBreakdown({
    airQualityLabel: input.airQualityLabel,
    pollutantRisk: input.pollutantRisk,
    heatRisk: input.heatRisk,
    uvRisk: input.uvRisk,
    alertRisk: input.alertRisk,
    fluActivity: input.fluActivity,
    covidActivity: input.covidActivity,
    personalizedRiskReasons: personalizedRisk.reasons,
  });
  const dataConfidence = buildDataConfidence({
    status: input.dataStatus,
    covidCoverage: input.covidCoverage,
  });

  return {
    modelVersion: RISK_MODEL_VERSION,
    healthRisk: personalizedRisk.healthRisk,
    respiratoryRisk: personalizedRisk.respiratoryRisk,
    baseHealthRisk,
    baseRespiratoryRisk,
    personalizedRiskReasons: personalizedRisk.reasons,
    isPersonalized: personalizedRisk.isPersonalized,
    personalizationSummary: personalizedRisk.isPersonalized
      ? personalizedRisk.reasons.length > 0
        ? `Personalized based on ${personalizedRisk.reasons.join(", ")}.`
        : "Personalized with your saved profile. No added exposure factors were found."
      : "Based on public local data only.",
    scoreBreakdown,
    dataConfidence,
    methodology: [
      "Risk Model v1.1 uses weighted public-health signals instead of treating every source equally.",
      "Air quality, pollutant levels, flu activity, COVID wastewater, heat, official alerts, UV, and profile factors each contribute to the 0-100 index.",
      "The model is transparent and informational; it is not a clinically validated diagnostic or prediction tool.",
    ],
  };
}
