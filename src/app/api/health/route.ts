import { NextResponse } from "next/server";
import { getFeatureFlagSnapshot } from "../../../lib/featureFlags";

export async function GET() {
  const status = {
    ok: true,
    service: "MyLocalHealth",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "unknown",
    integrations: {
      supabase:
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      openweather: Boolean(process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY),
      census: Boolean(process.env.CENSUS_API_KEY),
    },
    featureFlags: getFeatureFlagSnapshot(),
    disclaimer:
      "Operational status only. MyLocalHealth is informational and not medical advice.",
  };

  return NextResponse.json(status);
}
