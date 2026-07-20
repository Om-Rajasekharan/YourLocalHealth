import { createHmac, timingSafeEqual } from "crypto";

// Server-only. Signs/verifies the one-click unsubscribe link in alert
// emails -- HMAC over the location id, no login required to use the link
// (that's what makes it one-click), but a tampered/guessed locationId
// can't produce a valid token without this secret.
if (typeof window !== "undefined") {
  throw new Error(
    "alertUnsubscribeToken.ts must never be imported from client-side code."
  );
}

function getSecret(): string {
  const secret = process.env.ALERT_UNSUBSCRIBE_SECRET;

  if (!secret) {
    throw new Error("ALERT_UNSUBSCRIBE_SECRET is not configured.");
  }

  return secret;
}

export function signUnsubscribeToken(locationId: string): string {
  return createHmac("sha256", getSecret()).update(locationId).digest("hex");
}

export function verifyUnsubscribeToken(
  locationId: string,
  token: string
): boolean {
  const expected = signUnsubscribeToken(locationId);
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(token, "hex");

  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
