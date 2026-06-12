import { supabase } from "../lib/supabaseClient";

export type HealthSnapshotInput = {
  userId: string;
  zipCode: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  modelVersion: string;
  modelScore: number;
  healthRisk: string;
  respiratoryRisk: string;
  airQuality: string;
  aqi: number | null;
  dominantPollutant: string;
  pollutantRisk: string;
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  fluActivity: string;
  covidActivity: string;
  covidCoverage: string;
  forecastAverageScore: number | null;
  forecastPeakScore: number | null;
  forecastBestWindow: string | null;
  forecastWorstWindow: string | null;
  equityScore: number | null;
  equityLevel: string | null;
  profileSummary: string;
};

export type SavedHealthSnapshot = {
  id: string;
  created_at: string;
};

export type SymptomCheckinInput = {
  userId: string;
  snapshotId: string | null;
  zipCode: string;
  feltImpact: boolean;
  respiratorySymptoms: boolean;
  allergySymptoms: boolean;
  heatSymptoms: boolean;
  headacheOrFatigue: boolean;
  avoidedOutdoorActivity: boolean;
  usedRescueMedication: boolean;
  missedWorkSchoolActivity: boolean;
  symptomSeverity: number;
  notes: string;
};

export async function saveHealthSnapshot(
  snapshot: HealthSnapshotInput
): Promise<SavedHealthSnapshot> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("health_snapshots")
    .insert({
      user_id: snapshot.userId,
      zip_code: snapshot.zipCode,
      city: snapshot.city,
      state: snapshot.state,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      model_version: snapshot.modelVersion,
      model_score: snapshot.modelScore,
      health_risk: snapshot.healthRisk,
      respiratory_risk: snapshot.respiratoryRisk,
      air_quality: snapshot.airQuality,
      aqi: snapshot.aqi,
      dominant_pollutant: snapshot.dominantPollutant,
      pollutant_risk: snapshot.pollutantRisk,
      heat_risk: snapshot.heatRisk,
      uv_risk: snapshot.uvRisk,
      alert_risk: snapshot.alertRisk,
      flu_activity: snapshot.fluActivity,
      covid_activity: snapshot.covidActivity,
      covid_coverage: snapshot.covidCoverage,
      forecast_average_score: snapshot.forecastAverageScore,
      forecast_peak_score: snapshot.forecastPeakScore,
      forecast_best_window: snapshot.forecastBestWindow,
      forecast_worst_window: snapshot.forecastWorstWindow,
      equity_score: snapshot.equityScore,
      equity_level: snapshot.equityLevel,
      profile_summary: snapshot.profileSummary,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveSymptomCheckin(
  checkin: SymptomCheckinInput
) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("symptom_checkins").insert({
    user_id: checkin.userId,
    snapshot_id: checkin.snapshotId,
    zip_code: checkin.zipCode,
    felt_impact: checkin.feltImpact,
    respiratory_symptoms: checkin.respiratorySymptoms,
    allergy_symptoms: checkin.allergySymptoms,
    heat_symptoms: checkin.heatSymptoms,
    headache_or_fatigue: checkin.headacheOrFatigue,
    avoided_outdoor_activity: checkin.avoidedOutdoorActivity,
    used_rescue_medication: checkin.usedRescueMedication,
    missed_work_school_activity: checkin.missedWorkSchoolActivity,
    symptom_severity: checkin.symptomSeverity,
    notes: checkin.notes.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
