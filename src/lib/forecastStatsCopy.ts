// The Forecast page's "Statistical read" section used to show raw terms
// (coefficient of variation, peak z-score, standard deviation) with no
// plain-language translation -- someone who doesn't already know what a
// z-score is got nothing from that card. This computes a plain-English
// reading of the same underlying statistics, dynamically from the real
// numbers rather than a fixed caption, so the translation stays honest as
// the numbers change. The statistics themselves are untouched -- this only
// adds an interpretation layer in front of them.

import type { ForecastStatistics } from "../services/healthForecast";

// Coefficient-of-variation tiers. There's no universal cutoff for "steady"
// vs "variable" -- these thresholds are a judgment call, chosen so a
// single-digit-percent day (very common on a low-average-risk day) reads as
// steady, and only a genuinely choppy day reads as "highly variable".
function variabilityTier(
  coefficientOfVariation: number | null
): "unknown" | "steady" | "variable" | "highly-variable" {
  if (coefficientOfVariation === null) return "unknown";
  if (coefficientOfVariation < 20) return "steady";
  if (coefficientOfVariation < 45) return "variable";
  return "highly-variable";
}

// Peak z-score tiers -- how many standard deviations the worst hour sits
// above the mean. >=2 SD is the conventional "clear outlier" bar; 1-2 is a
// noticeable but not dramatic standout.
function peakStandoutTier(
  peakZScore: number | null
): "none" | "moderate" | "sharp" {
  if (peakZScore === null) return "none";
  if (peakZScore >= 2) return "sharp";
  if (peakZScore >= 1) return "moderate";
  return "none";
}

export function describeForecastStability(statistics: ForecastStatistics): {
  headline: string;
  meanMedianCaption: string;
  stdDeviationCaption: string;
  typicalBandCaption: string;
  peakZScoreCaption: string;
  variabilityLabel: string;
  correlationExplainer: string;
} {
  const cvTier = variabilityTier(statistics.coefficientOfVariation);
  const peakTier = peakStandoutTier(statistics.peakZScore);

  const variabilityLabel =
    cvTier === "unknown"
      ? "Not enough data to gauge steadiness"
      : cvTier === "steady"
      ? "Fairly steady day"
      : cvTier === "variable"
      ? "Noticeably variable day"
      : "Highly variable day";

  let headline: string;
  if (cvTier === "steady") {
    headline =
      "This forecast stays fairly steady all day -- timing your outdoor activity won't change your exposure much.";
  } else if (peakTier === "sharp") {
    headline =
      "This forecast swings a lot, and one hour stands out sharply from the rest -- picking the right time of day meaningfully lowers your exposure.";
  } else if (cvTier === "highly-variable" || peakTier === "moderate") {
    headline =
      "This forecast varies across the day, though no single hour is a dramatic outlier -- small timing changes add up gradually.";
  } else {
    headline =
      "This forecast has some hour-to-hour variation, but no hour stands out sharply from the rest.";
  }

  return {
    headline,
    meanMedianCaption: "Your typical risk level across the day, on average.",
    stdDeviationCaption: "How much the score swings from hour to hour.",
    typicalBandCaption: "Most hours today land in this range.",
    peakZScoreCaption:
      peakTier === "sharp"
        ? "The worst hour stands out sharply from a typical hour today."
        : peakTier === "moderate"
        ? "The worst hour is somewhat above a typical hour today."
        : "No hour is a dramatic outlier today.",
    variabilityLabel,
    correlationExplainer:
      "These show which local signals move most closely with your risk score through the day -- closer to 1.00 or -1.00 means a tighter link.",
  };
}
