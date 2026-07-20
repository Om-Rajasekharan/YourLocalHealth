import { Resend } from "resend";

// Server-only. Never import from client components -- RESEND_API_KEY has
// no NEXT_PUBLIC_ prefix so it can't end up in a client bundle, but this
// mirrors the same tripwire used in supabaseServiceRoleClient.ts.
if (typeof window !== "undefined") {
  throw new Error("email.ts must never be imported from client-side code.");
}

const FROM_ADDRESS = "MyLocalHealth Alerts <alerts@mylocalhealth.org>";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured -- cannot send alert emails."
    );
  }

  return new Resend(apiKey);
}

export async function sendRiskAlertEmail({
  to,
  locationLabel,
  city,
  state,
  dashboardUrl,
  unsubscribeUrl,
}: {
  to: string;
  locationLabel: string;
  city: string;
  state: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}): Promise<void> {
  const resend = getClient();

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a2332;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #b45309; font-weight: 600;">
        High risk alert
      </p>
      <h1 style="font-size: 22px; margin: 8px 0 16px;">
        ${locationLabel} (${city}, ${state}) just reached High risk
      </h1>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Local conditions for this saved location crossed into our High risk
        category. Open your dashboard for the details behind this reading.
      </p>
      <p style="margin: 24px 0;">
        <a href="${dashboardUrl}" style="background: #0f2a4a; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View dashboard
        </a>
      </p>
      <p style="font-size: 12px; line-height: 1.6; color: #94a3b8; margin-top: 32px;">
        MyLocalHealth is informational only and does not provide medical
        advice, diagnosis, or treatment.
      </p>
      <p style="font-size: 12px; color: #94a3b8;">
        <a href="${unsubscribeUrl}" style="color: #94a3b8;">Stop alerts for this location</a>
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `High risk alert for ${locationLabel}`,
    html,
  });

  if (error) {
    throw new Error(`Resend failed to send alert email: ${error.message}`);
  }
}
