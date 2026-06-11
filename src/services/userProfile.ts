import { supabase } from "../lib/supabaseClient";

export type AgeRange =
  | "Under 18"
  | "18-34"
  | "35-49"
  | "50-64"
  | "65+";

export type ExposureLevel = "Low" | "Moderate" | "High";
export type ActivityLevel = "Low" | "Moderate" | "High";
export type RespiratorySensitivity = "None" | "Mild" | "High";

export type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  age_range: AgeRange;
  place_of_birth: string | null;
  car_type: string;
  outdoor_exposure: ExposureLevel;
  activity_level: ActivityLevel;
  commute_exposure: ExposureLevel;
  respiratory_sensitivity: RespiratorySensitivity;
  updated_at: string;
};

export type UpsertUserProfile = {
  userId: string;
  fullName: string;
  ageRange: AgeRange;
  placeOfBirth: string;
  carType: string;
  outdoorExposure: ExposureLevel;
  activityLevel: ActivityLevel;
  commuteExposure: ExposureLevel;
  respiratorySensitivity: RespiratorySensitivity;
};

export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveUserProfile(
  profile: UpsertUserProfile
): Promise<UserProfile> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Please confirm your email and sign in before saving your profile.");
  }

  if (authData.user.id !== profile.userId) {
    throw new Error("Please sign in again before saving your profile.");
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: profile.userId,
        full_name: profile.fullName,
        age_range: profile.ageRange,
        place_of_birth: profile.placeOfBirth.trim() || null,
        car_type: profile.carType,
        outdoor_exposure: profile.outdoorExposure,
        activity_level: profile.activityLevel,
        commute_exposure: profile.commuteExposure,
        respiratory_sensitivity: profile.respiratorySensitivity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
