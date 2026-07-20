import { NextResponse } from "next/server";
import {
  isSupabaseServiceRoleConfigured,
  supabaseServiceRole,
} from "../../../../lib/supabaseServiceRoleClient";
import { shouldSendAlert } from "../../../../lib/alertLogic";
import { sendRiskAlertEmail } from "../../../../lib/email";
import { signUnsubscribeToken } from "../../../../lib/alertUnsubscribeToken";

type AlertableLocation = {
  id: string;
  user_id: string;
  label: string;
  zip_code: string;
  city: string;
  state: string;
  alerts_enabled: boolean;
  last_alert_risk_level: string | null;
  last_alert_sent_at: string | null;
};

function getSiteUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function processLocation(
  location: AlertableLocation,
  siteUrl: string
): Promise<{ sent: boolean }> {
  if (!supabaseServiceRole) {
    throw new Error("Service role client is not configured.");
  }

  const riskResponse = await fetch(
    `${siteUrl}/api/risk?zipCode=${encodeURIComponent(location.zip_code)}`
  );

  if (!riskResponse.ok) {
    throw new Error(`risk lookup failed (${riskResponse.status})`);
  }

  const riskData = (await riskResponse.json()) as {
    risk?: { overall?: string };
  };
  const currentRisk = riskData.risk?.overall ?? "Unknown";

  const fire = shouldSendAlert({
    alertsEnabled: location.alerts_enabled,
    currentRisk,
    lastRiskLevel: location.last_alert_risk_level,
    lastSentAt: location.last_alert_sent_at,
  });

  if (fire) {
    const { data: userData, error: userError } =
      await supabaseServiceRole.auth.admin.getUserById(location.user_id);

    if (userError || !userData.user?.email) {
      throw new Error(
        `could not resolve email for user ${location.user_id}`
      );
    }

    const token = signUnsubscribeToken(location.id);

    await sendRiskAlertEmail({
      to: userData.user.email,
      locationLabel: location.label,
      city: location.city,
      state: location.state,
      dashboardUrl: `${siteUrl}/?zipCode=${location.zip_code}`,
      unsubscribeUrl: `${siteUrl}/api/alerts/unsubscribe?locationId=${location.id}&token=${token}`,
    });
  }

  // Always record the level just observed, even when no email was sent --
  // that's what lets the next run detect a genuine new crossing rather
  // than reusing a stale value from before this check.
  const update: Record<string, unknown> = {
    last_alert_risk_level: currentRisk,
  };
  if (fire) {
    update.last_alert_sent_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseServiceRole
    .from("saved_locations")
    .update(update)
    .eq("id", location.id);

  if (updateError) {
    throw new Error(`failed to update location state: ${updateError.message}`);
  }

  return { sent: fire };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseServiceRoleConfigured || !supabaseServiceRole) {
    return NextResponse.json(
      { error: "Service role client is not configured." },
      { status: 503 }
    );
  }

  const { data: locations, error } = await supabaseServiceRole
    .from("saved_locations")
    .select(
      "id, user_id, label, zip_code, city, state, alerts_enabled, last_alert_risk_level, last_alert_sent_at"
    )
    .eq("alerts_enabled", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const siteUrl = getSiteUrl();
  const errors: string[] = [];
  let sent = 0;

  // Sequential, not Promise.all -- this hits /api/risk's own 30 req/min
  // rate limit, and a slow/failed location must never take down the rest
  // of the batch's chance to run.
  for (const location of (locations ?? []) as AlertableLocation[]) {
    try {
      const result = await processLocation(location, siteUrl);
      if (result.sent) sent += 1;
    } catch (locationError) {
      errors.push(
        `${location.id}: ${
          locationError instanceof Error
            ? locationError.message
            : "unknown error"
        }`
      );
    }
  }

  return NextResponse.json({
    checked: locations?.length ?? 0,
    sent,
    errors,
  });
}
