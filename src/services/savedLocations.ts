import { supabase } from "../lib/supabaseClient";

export type SavedLocation = {
  id: string;
  user_id: string;
  label: string;
  zip_code: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  created_at: string;
};

export type NewSavedLocation = {
  userId: string;
  label: string;
  zipCode: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
};

export async function getSavedLocations(
  userId: string
): Promise<SavedLocation[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("saved_locations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function saveLocation(
  location: NewSavedLocation
): Promise<SavedLocation> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("saved_locations")
    .insert({
      user_id: location.userId,
      label: location.label,
      zip_code: location.zipCode,
      city: location.city,
      state: location.state,
      latitude: location.latitude,
      longitude: location.longitude,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSavedLocation(id: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase
    .from("saved_locations")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
