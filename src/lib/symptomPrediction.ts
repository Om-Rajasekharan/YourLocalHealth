import type { RiskModelConfidence, RiskModelItem } from "./riskModel";
import type { HealthEquityData } from "../services/healthEquity";
import type { HealthForecastData } from "../services/healthForecast";
import type { EnvironmentData } from "../services/environment";
import type { UserProfile } from "../services/userProfile";

export const SYMPTOM_MODEL_VERSION =
  "MyLocalHealth Experimental Symptom Signal Engine v0.1";

export type SymptomPredictionTarget =
  | "respiratory"
  | "allergy"
  | "heat"
  | "activity_disruption";

export type SymptomPrediction = {
  modelVersion: string;
  confidenceLabel: RiskModelConfidence["label"];
  overallProbability: number;
  targets: {
    id: SymptomPredictionTarget;
    label: string;
    probability: number;
    level: "Low" | "Moderate" | "High";
    plainLanguage: string;
    drivers: {
      label: string;
      impact: number;
      detail: string;
    }[];
  }[];
  topDrivers: {
    label: string;
    impact: number;
    detail: string;
  }[];
  caveats: string[];
};

type SymptomPredictionInput = {
  aqi: number | null;
  heatRisk: string;
  uvRisk: string;
  pollutantRisk: string;
  fluActivity: string;
  covidActivity: string;
  scoreBreakdown: {
    score: number;
    topDrivers: RiskModelItem[];
  };
  forecastData: HealthForecastData | null;
  environmentData: EnvironmentData | null;
  equityData: HealthEquityData | null;
  profile: UserProfile | null;
  dataConfidence: RiskModelConfidence;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function riskSignal(value: string) {
  if (["High", "Very High", "Poor", "Very Poor"].includes(value)) return 1;
  if (["Moderate", "Fair", "Limited Coverage"].includes(value)) return 0.55;
  if (value === "Low" || value === "Very Low" || value === "Good") return 0.15;
  return 0.35;
}

function percentFromLogit(logit: number) {
  return clamp(sigmoid(logit) * 100, 1, 92);
}

function probabilityLevel(probability: number): "Low" | "Moderate" | "High" {
  if (probability >= 45) return "High";
  if (probability >= 22) return "Moderate";
  return "Low";
}

function profileSignal(profile: UserProfile | null) {
  if (!profile) return 0;

  const outdoor =
    profile.outdoor_exposure === "High"
      ? 0.28
      : profile.outdoor_exposure === "Moderate"
      ? 0.14
      : 0;
  const commute =
    profile.commute_exposure === "High"
      ? 0.22
      : profile.commute_exposure === "Moderate"
      ? 0.1
      : 0;
  const sensitivity =
    profile.respiratory_sensitivity === "High"
      ? 0.42
      : profile.respiratory_sensitivity === "Mild"
      ? 0.2
      : 0;
  const activity =
    profile.activity_level === "High"
      ? 0.16
      : profile.activity_level === "Moderate"
      ? 0.08
      : 0;

  return outdoor + commute + sensitivity + activity;
}

function makeDriver(label: string, impact: number, detail: string) {
  return {
    label,
    impact: clamp(impact, 0, 100),
    detail,
  };
}

function rankDrivers(
  drivers: ReturnType<typeof makeDriver>[],
  limit = 3
) {
  return drivers
    .filter((driver) => driver.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit);
}

function targetCopy(label: string, probability: number) {
  const level = probabilityLevel(probability).toLowerCase();
  return `${level} relative signal for self-reported ${label.toLowerCase()} based on today's local context.`;
}

export function estimateSymptomPrediction(
  input: SymptomPredictionInput
): SymptomPrediction {
  const aqiSignal = input.aqi === null ? 0.25 : Math.min(input.aqi / 160, 1);
  const pollutionSignal = Math.max(
    aqiSignal,
    riskSignal(input.pollutantRisk)
  );
  const heatSignal = Math.max(
    riskSignal(input.heatRisk),
    Math.min(
      ((input.environmentData?.apparentTemperatureMax ??
        input.environmentData?.apparentTemperature ??
        72) -
        72) /
        34,
      1
    )
  );
  const uvSignal = Math.max(
    riskSignal(input.uvRisk),
    Math.min((input.environmentData?.uvIndexMax ?? 3) / 10, 1)
  );
  const illnessSignal = Math.max(
    riskSignal(input.fluActivity),
    riskSignal(input.covidActivity)
  );
  const pollenSignal = Math.min(
    (input.forecastData?.allergyPeakScore ?? 18) / 100,
    1
  );
  const forecastSignal = Math.min(
    (input.forecastData?.peakScore ?? input.scoreBreakdown.score) / 100,
    1
  );
  const chronicSignal = Math.min(
    (input.equityData?.cdcPlaces?.chronicBurdenScore ?? 28) / 100,
    1
  );
  const equitySignal = Math.min((input.equityData?.equityScore ?? 30) / 100, 1);
  const personalSignal = profileSignal(input.profile);

  const respiratoryDrivers = [
    makeDriver("Air pollution", pollutionSignal * 36, "AQI and pollutant-specific respiratory burden."),
    makeDriver("Respiratory illness", illnessSignal * 28, "CDC flu activity and COVID wastewater signal."),
    makeDriver("Baseline respiratory vulnerability", chronicSignal * 18, "CDC PLACES chronic disease context."),
    makeDriver("Personal sensitivity", personalSignal * 18, "Saved profile exposure and breathing sensitivity."),
  ];
  const allergyDrivers = [
    makeDriver("Pollen forecast", pollenSignal * 44, "Open-Meteo pollen forecast peak."),
    makeDriver("Air pollution", pollutionSignal * 20, "Pollution can worsen allergy-like irritation."),
    makeDriver("Outdoor time", personalSignal * 18, "Profile-based exposure modifier."),
    makeDriver("Forecast peak", forecastSignal * 12, "Highest local exposure window."),
  ];
  const heatDrivers = [
    makeDriver("Heat stress", heatSignal * 46, "Feels-like temperature and heat-risk label."),
    makeDriver("UV exposure", uvSignal * 18, "Peak UV forecast."),
    makeDriver("Activity / outdoor profile", personalSignal * 22, "Saved activity and outdoor exposure fields."),
    makeDriver("Equity context", equitySignal * 14, "Local vulnerability context from ACS/PLACES."),
  ];
  const disruptionDrivers = [
    makeDriver("Forecast peak", forecastSignal * 30, "Highest predicted exposure window."),
    makeDriver("Overall risk index", (input.scoreBreakdown.score / 100) * 28, "Transparent MyLocalHealth risk score."),
    makeDriver("Personal exposure", personalSignal * 22, "Profile-driven routine and sensitivity."),
    makeDriver("Local vulnerability", Math.max(equitySignal, chronicSignal) * 20, "Equity and chronic-burden context."),
  ];

  const respiratoryProbability = percentFromLogit(
    -2.15 +
      1.25 * pollutionSignal +
      0.95 * illnessSignal +
      0.75 * chronicSignal +
      0.8 * personalSignal
  );
  const allergyProbability = percentFromLogit(
    -2.35 +
      1.75 * pollenSignal +
      0.55 * pollutionSignal +
      0.55 * personalSignal
  );
  const heatProbability = percentFromLogit(
    -2.55 +
      1.85 * heatSignal +
      0.55 * uvSignal +
      0.65 * personalSignal +
      0.35 * equitySignal
  );
  const disruptionProbability = percentFromLogit(
    -2.7 +
      1.1 * forecastSignal +
      0.85 * (input.scoreBreakdown.score / 100) +
      0.55 * personalSignal +
      0.35 * Math.max(equitySignal, chronicSignal)
  );

  const targets: SymptomPrediction["targets"] = [
    {
      id: "respiratory",
      label: "Respiratory symptoms",
      probability: respiratoryProbability,
      level: probabilityLevel(respiratoryProbability),
      plainLanguage: targetCopy("respiratory symptoms", respiratoryProbability),
      drivers: rankDrivers(respiratoryDrivers),
    },
    {
      id: "allergy",
      label: "Allergy-like symptoms",
      probability: allergyProbability,
      level: probabilityLevel(allergyProbability),
      plainLanguage: targetCopy("allergy-like symptoms", allergyProbability),
      drivers: rankDrivers(allergyDrivers),
    },
    {
      id: "heat",
      label: "Heat discomfort",
      probability: heatProbability,
      level: probabilityLevel(heatProbability),
      plainLanguage: targetCopy("heat discomfort", heatProbability),
      drivers: rankDrivers(heatDrivers),
    },
    {
      id: "activity_disruption",
      label: "Changing outdoor plans",
      probability: disruptionProbability,
      level: probabilityLevel(disruptionProbability),
      plainLanguage: targetCopy("changing outdoor plans", disruptionProbability),
      drivers: rankDrivers(disruptionDrivers),
    },
  ];
  const overallProbability = clamp(
    targets.reduce((total, target) => total + target.probability, 0) /
      targets.length
  );
  const topDrivers = rankDrivers(
    targets.flatMap((target) => target.drivers),
    5
  );

  return {
    modelVersion: SYMPTOM_MODEL_VERSION,
    confidenceLabel: input.dataConfidence.label,
    overallProbability,
    targets,
    topDrivers,
    caveats: [
      "Experimental estimate from a transparent tabular scoring baseline.",
      "Not a diagnosis, clinical prediction, or validated probability of illness.",
      "Future versions can swap this engine for trained scikit-learn artifacts from user check-ins.",
    ],
  };
}
