import { NextResponse } from "next/server";
import {
  isSupabaseServiceRoleConfigured,
  supabaseServiceRole,
} from "../../../lib/supabaseServiceRoleClient";
import {
  conjugateNormalUpdate,
  extractFactorPairs,
  ordinaryLeastSquaresSlope,
  FEATURE_SNAPSHOT_COLUMNS,
  type FeatureRow,
  type OlsSlope,
  type PersonalRiskCalibration,
} from "../../../services/personalRiskCalibration";
import type { EnvironmentFactorKey } from "../../../services/symptomEnvironmentCorrelation";

// A pooled cross-user slope below this many rows is too thin to trust as a
// population baseline -- ordinaryLeastSquaresSlope already refuses to
// compute below 10 rows or below a minimal-variance floor, but the
// population estimate needs a stricter bar than any single user's own
// slope, since it's meant to anchor everyone's prior.
const MIN_POOLED_ROWS_FOR_TRUST = 30;

const KNOWN_FACTORS: EnvironmentFactorKey[] = [
  "aqi",
  "pollutant_risk",
  "heat_risk",
  "uv_risk",
  "forecast_allergy_peak_score",
];

type RequestBody = {
  factor: EnvironmentFactorKey;
  userSlope: number;
  userSE: number;
  userN: number;
};

type CalibrationResponse = Omit<PersonalRiskCalibration, "factorLabel">;

// Supabase/PostgREST caps rows per request (1000 by default) if a query has
// no explicit limit -- without this, a pooled cross-user query would
// silently truncate once real check-in volume grows past that cap, biasing
// the population estimate toward whichever rows happen to sort first
// rather than erroring. This limit makes that ceiling explicit rather than
// an invisible platform default. Revisit with a proper SQL-side aggregate
// (sums computed in Postgres, not row-by-row transfer) once real volume
// approaches it -- fetching every row just to sum them stops scaling well
// well before this cap does.
const MAX_POOLED_ROWS = 5000;

async function fetchPooledSlope(
  factor: EnvironmentFactorKey
): Promise<OlsSlope | null> {
  if (!supabaseServiceRole) return null;

  // Bypasses RLS by design (service-role client) -- safe here because only
  // a pooled slope/SE/n is ever computed from this data and returned; no
  // individual row is ever exposed to any caller.
  const { data, error } = await supabaseServiceRole
    .from("ml_feature_snapshots")
    .select(FEATURE_SNAPSHOT_COLUMNS)
    .not("checkin_created_at", "is", null)
    .limit(MAX_POOLED_ROWS);

  if (error) {
    console.error("personal-risk-calibration pooled query failed", error);
    return null;
  }

  const rows = (data ?? []) as FeatureRow[];
  const { xs, ys } = extractFactorPairs(rows, factor);

  return ordinaryLeastSquaresSlope(xs, ys);
}

function isValidBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;

  return (
    typeof candidate.factor === "string" &&
    KNOWN_FACTORS.includes(candidate.factor as EnvironmentFactorKey) &&
    typeof candidate.userSlope === "number" &&
    Number.isFinite(candidate.userSlope) &&
    typeof candidate.userSE === "number" &&
    Number.isFinite(candidate.userSE) &&
    typeof candidate.userN === "number" &&
    Number.isInteger(candidate.userN)
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "factor, userSlope, userSE, and userN are required." },
      { status: 400 }
    );
  }

  const { factor, userSlope, userSE, userN } = body;

  if (userSE <= 0 || userN < 10) {
    const response: CalibrationResponse = {
      status: "insufficient_variation",
      posteriorMean: null,
      posteriorSE: null,
      trustWeightPct: null,
      populationSource: "neutral_fallback",
      populationN: 0,
    };
    return NextResponse.json(response);
  }

  try {
    const pooledSlope = isSupabaseServiceRoleConfigured
      ? await fetchPooledSlope(factor)
      : null;

    const usePooled =
      pooledSlope !== null && pooledSlope.n >= MIN_POOLED_ROWS_FOR_TRUST;

    // Neutral prior when population data isn't trustworthy yet (whether
    // because the service-role key isn't configured, there aren't enough
    // pooled rows, or the pooled factor barely varies): centered at zero,
    // with a variance scaled to the user's own SE (2x their SD) rather than
    // an arbitrary constant, so it's weak enough that a user's own evidence
    // dominates almost immediately when there's no real population signal.
    const priorMean = usePooled ? pooledSlope!.beta : 0;
    const priorVariance = usePooled
      ? pooledSlope!.se * pooledSlope!.se
      : 4 * userSE * userSE;

    const { posteriorMean, posteriorVariance, trustWeightPct } =
      conjugateNormalUpdate(priorMean, priorVariance, userSlope, userSE);

    const response: CalibrationResponse = {
      status: "ready",
      posteriorMean,
      posteriorSE: Math.sqrt(posteriorVariance),
      trustWeightPct,
      populationSource: usePooled ? "pooled" : "neutral_fallback",
      populationN: pooledSlope?.n ?? 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to compute personal risk calibration.",
      },
      { status: 500 }
    );
  }
}
