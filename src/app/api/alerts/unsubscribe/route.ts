import { NextResponse } from "next/server";
import {
  isSupabaseServiceRoleConfigured,
  supabaseServiceRole,
} from "../../../../lib/supabaseServiceRoleClient";
import { verifyUnsubscribeToken } from "../../../../lib/alertUnsubscribeToken";

// One-click unsubscribe from an alert email -- deliberately no login
// required (that's what makes it one-click), so the HMAC token is what
// proves the request actually came from a link this app sent rather than
// someone guessing a locationId.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const token = searchParams.get("token");

  if (!locationId || !token) {
    return NextResponse.json(
      { error: "locationId and token are required." },
      { status: 400 }
    );
  }

  let validToken: boolean;
  try {
    validToken = verifyUnsubscribeToken(locationId, token);
  } catch {
    return NextResponse.json(
      { error: "Unsubscribe is not configured." },
      { status: 503 }
    );
  }

  if (!validToken) {
    return NextResponse.json({ error: "Invalid token." }, { status: 403 });
  }

  if (!isSupabaseServiceRoleConfigured || !supabaseServiceRole) {
    return NextResponse.json(
      { error: "Service role client is not configured." },
      { status: 503 }
    );
  }

  const { error } = await supabaseServiceRole
    .from("saved_locations")
    .update({ alerts_enabled: false })
    .eq("id", locationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(
    "<html><body style=\"font-family: -apple-system, sans-serif; padding: 40px; text-align: center;\">" +
      "<p>Alerts for this location have been turned off.</p>" +
      "</body></html>",
    { headers: { "Content-Type": "text/html" } }
  );
}
