import { createClient } from "@supabase/supabase-js";

// Server-only. Bypasses Row-Level Security -- only use for aggregate/pooled
// queries that never expose one user's raw rows to another. Never import
// this from a client component; SUPABASE_SERVICE_ROLE_KEY has no
// NEXT_PUBLIC_ prefix so Next.js won't bundle it client-side, but this
// tripwire catches an accidental import during development regardless.
if (typeof window !== "undefined") {
  throw new Error(
    "supabaseServiceRoleClient must never be imported from client-side code."
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServiceRoleConfigured =
  Boolean(supabaseUrl) && Boolean(serviceRoleKey);

export const supabaseServiceRole = isSupabaseServiceRoleConfigured
  ? createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false },
    })
  : null;
