// The Exposure Twin's "what-if" simulator used to just subtract a flat,
// hardcoded constant per scenario regardless of the actual ZIP, forecast, or
// profile -- this recomputes a real projected score for each scenario using
// the same inputs (and the same profileModifier formula) that produce the
// real twin score, so a "shift outdoor time" projection is an actual
// forecast-window lookup, not a made-up number.

import type {
  ActivityLevel,
  ExposureLevel,
  RespiratorySensitivity,
  UserProfile,
} from "../services/userProfile";
import type { HealthForecastData } from "../services/healthForecast";

export type TwinScenario = "current" | "shift" | "reduce" | "protect";

export type ScenarioProjection = {
  scenario: TwinScenario;
  projectedScore: number;
  available: boolean;
  explanation: string;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function profileModifier(profile: UserProfile | null): number {
  if (!profile) return 0;

  const exposure =
    profile.outdoor_exposure === "High"
      ? 8
      : profile.outdoor_exposure === "Moderate"
      ? 4
      : 0;
  const commute =
    profile.commute_exposure === "High"
      ? 6
      : profile.commute_exposure === "Moderate"
      ? 3
      : 0;
  const sensitivity =
    profile.respiratory_sensitivity === "High"
      ? 10
      : profile.respiratory_sensitivity === "Mild"
      ? 5
      : 0;
  const activity =
    profile.activity_level === "High"
      ? 4
      : profile.activity_level === "Moderate"
      ? 2
      : 0;

  return exposure + commute + sensitivity + activity;
}

export function computeTwinScore({
  baseScore,
  peakForecastScore,
  profile,
}: {
  baseScore: number;
  peakForecastScore: number;
  profile: UserProfile | null;
}): number {
  return clampScore(
    baseScore * 0.68 + peakForecastScore * 0.22 + profileModifier(profile)
  );
}

const EXPOSURE_STEP_DOWN: Record<ExposureLevel, ExposureLevel> = {
  High: "Moderate",
  Moderate: "Low",
  Low: "Low",
};

const ACTIVITY_STEP_DOWN: Record<ActivityLevel, ActivityLevel> = {
  High: "Moderate",
  Moderate: "Low",
  Low: "Low",
};

const SENSITIVITY_STEP_DOWN: Record<
  RespiratorySensitivity,
  RespiratorySensitivity
> = {
  High: "Mild",
  Mild: "None",
  None: "None",
};

type ScenarioInput = {
  scenario: TwinScenario;
  baseScore: number;
  peakForecastScore: number;
  forecastData: HealthForecastData | null;
  profile: UserProfile | null;
};

export function computeScenarioProjection({
  scenario,
  baseScore,
  peakForecastScore,
  forecastData,
  profile,
}: ScenarioInput): ScenarioProjection {
  const currentScore = computeTwinScore({ baseScore, peakForecastScore, profile });

  if (scenario === "current") {
    return {
      scenario,
      projectedScore: currentScore,
      available: true,
      explanation:
        "Uses your current profile, location, and forecast without any behavior change.",
    };
  }

  if (scenario === "shift") {
    if (!forecastData?.bestWindow) {
      return {
        scenario,
        projectedScore: currentScore,
        available: false,
        explanation:
          "Forecast data didn't load for this search, so this can't be simulated yet.",
      };
    }

    const projectedScore = computeTwinScore({
      baseScore,
      peakForecastScore: forecastData.bestWindow.score,
      profile,
    });

    return {
      scenario,
      projectedScore,
      available: true,
      explanation: `Models moving flexible outdoor time to ${forecastData.bestWindow.displayTime}, currently forecast at ${forecastData.bestWindow.score}/100 versus today's peak of ${peakForecastScore}/100.`,
    };
  }

  if (scenario === "reduce") {
    if (!profile) {
      return {
        scenario,
        projectedScore: currentScore,
        available: false,
        explanation: "Set up your profile to simulate reducing your exposure.",
      };
    }

    const hypothetical: UserProfile = {
      ...profile,
      outdoor_exposure: EXPOSURE_STEP_DOWN[profile.outdoor_exposure],
      activity_level: ACTIVITY_STEP_DOWN[profile.activity_level],
    };

    return {
      scenario,
      projectedScore: computeTwinScore({
        baseScore,
        peakForecastScore,
        profile: hypothetical,
      }),
      available: true,
      explanation:
        "Models one step down in outdoor time and activity intensity from your current profile -- a shorter high-exposure block or fewer outdoor errands.",
    };
  }

  // protect
  if (!profile) {
    return {
      scenario,
      projectedScore: currentScore,
      available: false,
      explanation: "Set up your profile to simulate added protection.",
    };
  }

  const hypothetical: UserProfile = {
    ...profile,
    commute_exposure: EXPOSURE_STEP_DOWN[profile.commute_exposure],
    respiratory_sensitivity: SENSITIVITY_STEP_DOWN[profile.respiratory_sensitivity],
  };

  return {
    scenario,
    projectedScore: computeTwinScore({
      baseScore,
      peakForecastScore,
      profile: hypothetical,
    }),
    available: true,
    explanation:
      "Models one step down in commute exposure and effective respiratory sensitivity -- indoor breaks, filtered air, or lower exertion.",
  };
}

export function scenarioLabel(scenario: TwinScenario): string {
  switch (scenario) {
    case "shift":
      return "Shift outdoor time";
    case "reduce":
      return "Shorten exposure";
    case "protect":
      return "Add protection";
    default:
      return "Current routine";
  }
}
