// Proactive risk alerts should fire once, at the moment a saved location's
// risk newly crosses into "High" -- not on every check while it stays
// High (that would mean an email every 30 minutes during a multi-day heat
// wave). This module is the pure decision logic, kept separate from the
// fetch/send side effects so it can be unit-tested directly.

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function shouldSendAlert({
  alertsEnabled,
  currentRisk,
  lastRiskLevel,
  lastSentAt,
  now = new Date(),
}: {
  alertsEnabled: boolean;
  currentRisk: string;
  lastRiskLevel: string | null;
  lastSentAt: string | null;
  now?: Date;
}): boolean {
  if (!alertsEnabled) return false;
  if (currentRisk !== "High") return false;

  // Only a genuine new crossing into High counts -- if it was already
  // High last time this location was checked, this isn't a fresh alert.
  if (lastRiskLevel === "High") return false;

  if (lastSentAt) {
    const elapsed = now.getTime() - new Date(lastSentAt).getTime();
    if (elapsed < ALERT_COOLDOWN_MS) return false;
  }

  return true;
}
