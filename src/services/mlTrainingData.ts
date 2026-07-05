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
  forecastAllergyPeakScore: number | null;
  forecastAllergyPeakWindow: string | null;
  forecastPollenRisk: string | null;
  equityScore: number | null;
  equityLevel: string | null;
  placesChronicBurdenScore: number | null;
  placesAsthma: number | null;
  placesCopd: number | null;
  placesSmoking: number | null;
  placesObesity: number | null;
  placesDiabetes: number | null;
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

export type CheckinStreakDay = {
  date: string;
  label: string;
  checkedIn: boolean;
  isToday: boolean;
};

export type CheckinStreak = {
  currentStreak: number;
  bestStreak: number;
  checkedInToday: boolean;
  lastCheckinDate: string | null;
  totalCheckins: number;
  nextMilestone: number;
  week: CheckinStreakDay[];
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function emptyCheckinStreak(): CheckinStreak {
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index - 6);

    return {
      date: dateKey(day),
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      checkedIn: false,
      isToday: index === 6,
    };
  });

  return {
    currentStreak: 0,
    bestStreak: 0,
    checkedInToday: false,
    lastCheckinDate: null,
    totalCheckins: 0,
    nextMilestone: 3,
    week,
  };
}

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
      forecast_allergy_peak_score: snapshot.forecastAllergyPeakScore,
      forecast_allergy_peak_window: snapshot.forecastAllergyPeakWindow,
      forecast_pollen_risk: snapshot.forecastPollenRisk,
      equity_score: snapshot.equityScore,
      equity_level: snapshot.equityLevel,
      places_chronic_burden_score: snapshot.placesChronicBurdenScore,
      places_asthma: snapshot.placesAsthma,
      places_copd: snapshot.placesCopd,
      places_smoking: snapshot.placesSmoking,
      places_obesity: snapshot.placesObesity,
      places_diabetes: snapshot.placesDiabetes,
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

export async function getSymptomCheckinStreak(
  userId: string
): Promise<CheckinStreak> {
  if (!supabase) {
    return emptyCheckinStreak();
  }

  const since = addDays(new Date(), -120);
  const { data, error } = await supabase
    .from("symptom_checkins")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const base = emptyCheckinStreak();
  const checkedDates = new Set(
    (data ?? []).map((row) => dateKey(new Date(row.created_at)))
  );
  const sortedDates = Array.from(checkedDates).sort();
  const today = new Date();
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(addDays(today, -1));
  const checkedInToday = checkedDates.has(todayKey);
  const lastCheckinDate = sortedDates.at(-1) ?? null;
  const week = base.week.map((day) => ({
    ...day,
    checkedIn: checkedDates.has(day.date),
  }));

  let currentStreak = 0;
  if (checkedInToday || checkedDates.has(yesterdayKey)) {
    let cursor = checkedInToday ? today : addDays(today, -1);
    while (checkedDates.has(dateKey(cursor))) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let bestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;

  sortedDates.forEach((key) => {
    const currentDate = new Date(`${key}T12:00:00`);
    const expectedPrevious = previousDate
      ? dateKey(addDays(currentDate, -1))
      : null;

    runningStreak =
      previousDate && expectedPrevious === dateKey(previousDate)
        ? runningStreak + 1
        : 1;
    bestStreak = Math.max(bestStreak, runningStreak);
    previousDate = currentDate;
  });

  const nextMilestone =
    [3, 7, 14, 30, 60].find((milestone) => milestone > currentStreak) ??
    currentStreak + 30;

  return {
    currentStreak,
    bestStreak,
    checkedInToday,
    lastCheckinDate,
    totalCheckins: data?.length ?? 0,
    nextMilestone,
    week,
  };
}
