import { supabase } from "../lib/supabaseClient";

// A correlation at n below this is too noisy to say anything useful --
// Spearman's standard error scales with 1/sqrt(n-1), so single-digit n
// swings wildly with one new check-in.
const MIN_CHECKINS_FOR_CORRELATION = 10;
const PERMUTATION_ITERATIONS = 2000;

export type EnvironmentFactorKey =
  | "aqi"
  | "pollutant_risk"
  | "heat_risk"
  | "uv_risk"
  | "forecast_allergy_peak_score";

export type EnvironmentFactorCorrelation = {
  factor: EnvironmentFactorKey;
  label: string;
  rho: number;
  pValue: number;
  n: number;
};

export type SymptomEnvironmentCorrelation = {
  status: "ready" | "insufficient_data";
  totalCheckins: number;
  minRequired: number;
  topFactor: EnvironmentFactorCorrelation | null;
  allFactors: EnvironmentFactorCorrelation[];
  summary: string;
  caveats: string[];
};

const FACTOR_LABELS: Record<EnvironmentFactorKey, string> = {
  aqi: "air quality index",
  pollutant_risk: "pollutant risk level",
  heat_risk: "heat risk level",
  uv_risk: "UV risk level",
  forecast_allergy_peak_score: "peak allergy forecast score",
};

const RISK_ORDER: Record<string, number> = { Low: 0, Moderate: 1, High: 2 };

export function encodeRiskLevel(value: string | null): number | null {
  if (!value || !(value in RISK_ORDER)) return null;
  return RISK_ORDER[value];
}

export function rankValues(values: number[]): number[] {
  const order = values.map((_, index) => index).sort(
    (a, b) => values[a] - values[b]
  );
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) {
      j += 1;
    }
    // Ties share the average of the ranks they'd otherwise occupy.
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) {
      ranks[order[k]] = averageRank;
    }
    i = j + 1;
  }
  return ranks;
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((sum, value) => sum + value, 0) / n;
  const meanB = b.reduce((sum, value) => sum + value, 0) / n;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;

  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }

  if (varianceA === 0 || varianceB === 0) return 0;
  return covariance / Math.sqrt(varianceA * varianceB);
}

export function spearman(a: number[], b: number[]): number {
  return pearson(rankValues(a), rankValues(b));
}

// Spearman rho has no simple closed-form p-value at small n, so this
// estimates significance directly: shuffle the outcome relative to the
// factor many times and see how often chance alone produces a |rho| at
// least this large. Same logic as the permutation-importance check
// already used in ml/train_symptom_model.py, just applied to a correlation
// instead of a feature-importance drop.
export function permutationPValue(
  rankedFactor: number[],
  outcome: number[],
  observedRho: number,
  iterations: number
): number {
  const shuffled = [...outcome];
  let countAsExtreme = 0;

  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const rho = pearson(rankedFactor, rankValues(shuffled));
    if (Math.abs(rho) >= Math.abs(observedRho) - 1e-9) {
      countAsExtreme += 1;
    }
  }

  return (countAsExtreme + 1) / (iterations + 1);
}

export function emptySymptomEnvironmentCorrelation(): SymptomEnvironmentCorrelation {
  return {
    status: "insufficient_data",
    totalCheckins: 0,
    minRequired: MIN_CHECKINS_FOR_CORRELATION,
    topFactor: null,
    allFactors: [],
    summary: `Log at least ${MIN_CHECKINS_FOR_CORRELATION} check-ins to unlock a personalized environment-symptom correlation.`,
    caveats: [],
  };
}

type FeatureRow = {
  aqi: number | null;
  pollutant_risk: string | null;
  heat_risk: string | null;
  uv_risk: string | null;
  forecast_allergy_peak_score: number | null;
  symptom_severity: number | null;
  checkin_created_at: string | null;
};

function buildSummary(
  topFactor: EnvironmentFactorCorrelation | null,
  totalCheckins: number
): string {
  if (!topFactor) {
    return `Logged ${totalCheckins} check-ins, but no environmental factor shows a clear relationship with your symptom severity yet.`;
  }

  const direction = topFactor.rho > 0 ? "higher" : "lower";
  const magnitude = Math.abs(topFactor.rho);
  const strength =
    magnitude >= 0.5 ? "strong" : magnitude >= 0.3 ? "moderate" : "weak";
  const significant = topFactor.pValue < 0.05;
  const base =
    `Your symptom severity tends to be ${direction} on days with a higher ` +
    `${topFactor.label} (ρ = ${topFactor.rho.toFixed(2)}, based on ${topFactor.n} check-ins)`;

  if (!significant) {
    return (
      `${base}. That's a ${strength} pattern, but not yet statistically ` +
      `significant (p = ${topFactor.pValue.toFixed(2)}) -- keep checking in to see if it holds.`
    );
  }

  return `${base}, a ${strength} and statistically significant pattern (p = ${topFactor.pValue.toFixed(2)}).`;
}

export async function getSymptomEnvironmentCorrelation(
  userId: string
): Promise<SymptomEnvironmentCorrelation> {
  if (!supabase) return emptySymptomEnvironmentCorrelation();

  const { data, error } = await supabase
    .from("ml_feature_snapshots")
    .select(
      "aqi, pollutant_risk, heat_risk, uv_risk, forecast_allergy_peak_score, symptom_severity, checkin_created_at"
    )
    .eq("user_id", userId)
    .not("checkin_created_at", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as FeatureRow[];
  const totalCheckins = rows.length;

  if (totalCheckins < MIN_CHECKINS_FOR_CORRELATION) {
    return { ...emptySymptomEnvironmentCorrelation(), totalCheckins };
  }

  const severities = rows.map((row) => row.symptom_severity ?? 0);
  const factorExtractors: Record<
    EnvironmentFactorKey,
    (row: FeatureRow) => number | null
  > = {
    aqi: (row) => row.aqi,
    pollutant_risk: (row) => encodeRiskLevel(row.pollutant_risk),
    heat_risk: (row) => encodeRiskLevel(row.heat_risk),
    uv_risk: (row) => encodeRiskLevel(row.uv_risk),
    forecast_allergy_peak_score: (row) => row.forecast_allergy_peak_score,
  };

  const allFactors: EnvironmentFactorCorrelation[] = [];

  for (const factor of Object.keys(
    factorExtractors
  ) as EnvironmentFactorKey[]) {
    const extractor = factorExtractors[factor];
    const xs: number[] = [];
    const ys: number[] = [];

    rows.forEach((row, index) => {
      const x = extractor(row);
      if (x !== null) {
        xs.push(x);
        ys.push(severities[index]);
      }
    });

    if (xs.length < MIN_CHECKINS_FOR_CORRELATION) continue;

    const rho = spearman(xs, ys);
    const pValue = permutationPValue(
      rankValues(xs),
      ys,
      rho,
      PERMUTATION_ITERATIONS
    );

    allFactors.push({
      factor,
      label: FACTOR_LABELS[factor],
      rho: Math.round(rho * 1000) / 1000,
      pValue: Math.round(pValue * 1000) / 1000,
      n: xs.length,
    });
  }

  allFactors.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
  const topFactor = allFactors[0] ?? null;

  return {
    status: topFactor ? "ready" : "insufficient_data",
    totalCheckins,
    minRequired: MIN_CHECKINS_FOR_CORRELATION,
    topFactor,
    allFactors,
    summary: buildSummary(topFactor, totalCheckins),
    caveats: [
      "Correlation, not causation -- based only on your own logged check-ins, not a clinical study.",
      "The p-value is a rough guide (via permutation test), not proof; more check-ins sharpen it.",
    ],
  };
}
