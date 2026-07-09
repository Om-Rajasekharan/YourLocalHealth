import { z } from "zod";
import { traceAsync } from "./observability";

const DEFAULT_SERVICE_URL = "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 1500;

export const ML_MODEL_TARGETS = [
  "felt_impact",
  "respiratory_symptoms",
  "allergy_symptoms",
  "heat_symptoms",
  "headache_or_fatigue",
  "avoided_outdoor_activity",
  "used_rescue_medication",
  "missed_work_school_activity",
  "severe_symptoms",
] as const;

export type MlModelTarget = (typeof ML_MODEL_TARGETS)[number];

const predictResponseSchema = z.object({
  predictions: z.record(
    z.string(),
    z.object({
      probability: z.number().min(0).max(1).nullable(),
      trainingPositiveRate: z.number().min(0).max(1).nullable().optional(),
      topDrivers: z
        .array(
          z.object({
            feature: z.string(),
            impact: z.number(),
          })
        )
        .nullable()
        .optional(),
    })
  ),
  modelsAvailable: z.array(z.string()),
});

export type MlPredictionResult = z.infer<typeof predictResponseSchema>;

export type MlFeatureSnapshotInput = {
  model_score?: number | null;
  aqi?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  forecast_average_score?: number | null;
  forecast_peak_score?: number | null;
  forecast_allergy_peak_score?: number | null;
  equity_score?: number | null;
  places_chronic_burden_score?: number | null;
  places_asthma?: number | null;
  places_copd?: number | null;
  places_smoking?: number | null;
  places_obesity?: number | null;
  places_diabetes?: number | null;
  checkin_month?: number | null;
  checkin_day_of_week?: number | null;
  zip_prefix?: number | null;
  city?: string | null;
  state?: string | null;
  model_version?: string | null;
  health_risk?: string | null;
  respiratory_risk?: string | null;
  air_quality?: string | null;
  dominant_pollutant?: string | null;
  pollutant_risk?: string | null;
  heat_risk?: string | null;
  uv_risk?: string | null;
  alert_risk?: string | null;
  flu_activity?: string | null;
  covid_activity?: string | null;
  covid_coverage?: string | null;
  forecast_best_window?: string | null;
  forecast_worst_window?: string | null;
  forecast_allergy_peak_window?: string | null;
  forecast_pollen_risk?: string | null;
  equity_level?: string | null;
};

function getServiceUrl() {
  return process.env.ML_SERVICE_URL ?? DEFAULT_SERVICE_URL;
}

/**
 * Calls the Python model-serving microservice (ml/serve_models.py) with a
 * short timeout. Returns null on any failure -- timeout, network error, the
 * service being down, or an unexpected response shape -- so callers can
 * always fall back to the existing heuristic in symptomPrediction.ts.
 */
export async function getMlPredictions(
  features: MlFeatureSnapshotInput
): Promise<MlPredictionResult | null> {
  try {
    return await traceAsync(
      "ml_model_client.predict",
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
          const response = await fetch(`${getServiceUrl()}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(features),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`ML service responded with status ${response.status}.`);
          }

          const payload = await response.json();
          return predictResponseSchema.parse(payload);
        } finally {
          clearTimeout(timeout);
        }
      },
      { serviceUrl: getServiceUrl() }
    );
  } catch {
    return null;
  }
}
