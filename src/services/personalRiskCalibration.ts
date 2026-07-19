import { supabase } from "../lib/supabaseClient";
import { encodeRiskLevel, type EnvironmentFactorKey } from "./symptomEnvironmentCorrelation";

// Matches the correlation feature's own bar -- a slope estimated from fewer
// points is too noisy for a Bayesian update to mean anything.
const MIN_CHECKINS_FOR_SLOPE = 10;

// Below this sample variance in the factor itself, the factor is
// effectively constant across a user's check-ins (e.g. AQI reported "Low"
// every single day) -- Sxx near zero would make the standard error collapse
// toward zero and silently inflate personal "trust" to ~100%, which is the
// opposite of honest. Treated as "not enough variation," not a valid slope.
const MIN_FACTOR_VARIANCE = 0.01;

export type OlsSlope = {
  beta: number;
  se: number;
  n: number;
};

export type PersonalRiskCalibration = {
  status: "ready" | "insufficient_variation";
  factorLabel: string;
  posteriorMean: number | null;
  posteriorSE: number | null;
  trustWeightPct: number | null;
  populationSource: "pooled" | "neutral_fallback";
  populationN: number;
};

export function ordinaryLeastSquaresSlope(
  xs: number[],
  ys: number[]
): OlsSlope | null {
  const n = xs.length;
  if (n < MIN_CHECKINS_FOR_SLOPE || n !== ys.length) return null;

  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    sxx += dx * dx;
    sxy += dx * (ys[i] - meanY);
  }

  const sampleVarianceX = sxx / (n - 1);
  if (sampleVarianceX < MIN_FACTOR_VARIANCE) return null;

  const beta = sxy / sxx;

  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = meanY + beta * (xs[i] - meanX);
    const residual = ys[i] - predicted;
    sse += residual * residual;
  }

  const residualVariance = sse / (n - 2);
  const se = Math.sqrt(residualVariance / sxx);

  return { beta, se, n };
}

export type FeatureRow = {
  aqi: number | null;
  pollutant_risk: string | null;
  heat_risk: string | null;
  uv_risk: string | null;
  forecast_allergy_peak_score: number | null;
  symptom_severity: number | null;
  checkin_created_at: string | null;
};

const FACTOR_EXTRACTORS: Record<
  EnvironmentFactorKey,
  (row: FeatureRow) => number | null
> = {
  aqi: (row) => row.aqi,
  pollutant_risk: (row) => encodeRiskLevel(row.pollutant_risk),
  heat_risk: (row) => encodeRiskLevel(row.heat_risk),
  uv_risk: (row) => encodeRiskLevel(row.uv_risk),
  forecast_allergy_peak_score: (row) => row.forecast_allergy_peak_score,
};

export const FEATURE_SNAPSHOT_COLUMNS =
  "aqi, pollutant_risk, heat_risk, uv_risk, forecast_allergy_peak_score, symptom_severity, checkin_created_at";

export function extractFactorPairs(
  rows: FeatureRow[],
  factor: EnvironmentFactorKey
): { xs: number[]; ys: number[] } {
  const extractor = FACTOR_EXTRACTORS[factor];
  const xs: number[] = [];
  const ys: number[] = [];

  rows.forEach((row) => {
    const x = extractor(row);
    if (x !== null && row.symptom_severity !== null) {
      xs.push(x);
      ys.push(row.symptom_severity);
    }
  });

  return { xs, ys };
}

/**
 * Exact conjugate Normal-Normal Bayesian update: a population prior
 * N(priorMean, priorVariance) combined with a user's own estimated slope
 * N(userSlope, userSE^2), precision-weighted. trustWeightPct is how much of
 * the posterior's precision comes from the user's own data rather than the
 * population prior -- it's meant to visibly grow toward 100% as a user
 * logs more check-ins, not a confidence or accuracy score.
 */
export function conjugateNormalUpdate(
  priorMean: number,
  priorVariance: number,
  userSlope: number,
  userSE: number
): { posteriorMean: number; posteriorVariance: number; trustWeightPct: number } {
  const priorPrecision = 1 / priorVariance;
  const userPrecision = 1 / (userSE * userSE);
  const posteriorPrecision = priorPrecision + userPrecision;
  const posteriorMean =
    (priorMean * priorPrecision + userSlope * userPrecision) /
    posteriorPrecision;
  const posteriorVariance = 1 / posteriorPrecision;
  const trustWeightPct = Math.round(
    (userPrecision / posteriorPrecision) * 100
  );

  return { posteriorMean, posteriorVariance, trustWeightPct };
}

export async function computeUserFactorSlope(
  userId: string,
  factor: EnvironmentFactorKey
): Promise<OlsSlope | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ml_feature_snapshots")
    .select(FEATURE_SNAPSHOT_COLUMNS)
    .eq("user_id", userId)
    .not("checkin_created_at", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as FeatureRow[];
  const { xs, ys } = extractFactorPairs(rows, factor);

  return ordinaryLeastSquaresSlope(xs, ys);
}
