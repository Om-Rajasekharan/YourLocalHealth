import { describe, expect, it } from "vitest";
import { shouldSendAlert } from "./alertLogic";

describe("shouldSendAlert", () => {
  it("fires on a fresh crossing into High", () => {
    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "High",
        lastRiskLevel: "Moderate",
        lastSentAt: null,
      })
    ).toBe(true);
  });

  it("fires the first time a location is ever checked and is already High", () => {
    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "High",
        lastRiskLevel: null,
        lastSentAt: null,
      })
    ).toBe(true);
  });

  it("does not re-fire while risk stays High from the last check", () => {
    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "High",
        lastRiskLevel: "High",
        lastSentAt: null,
      })
    ).toBe(false);
  });

  it("does not fire when alerts are disabled for the location", () => {
    expect(
      shouldSendAlert({
        alertsEnabled: false,
        currentRisk: "High",
        lastRiskLevel: "Moderate",
        lastSentAt: null,
      })
    ).toBe(false);
  });

  it("does not fire when current risk is not High", () => {
    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "Moderate",
        lastRiskLevel: "Low",
        lastSentAt: null,
      })
    ).toBe(false);
  });

  it("fires again after risk drops out of High and re-crosses", () => {
    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "High",
        lastRiskLevel: "Low",
        lastSentAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        now: new Date("2026-01-05T00:00:00Z"),
      })
    ).toBe(true);
  });

  it("respects the 24h cooldown even on a fresh crossing", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "High",
        lastRiskLevel: "Moderate",
        lastSentAt: tenMinutesAgo,
        now,
      })
    ).toBe(false);
  });

  it("allows a new alert once the cooldown has fully elapsed", () => {
    const now = new Date("2026-01-02T12:00:01Z");
    const justOverADayAgo = new Date(
      now.getTime() - (24 * 60 * 60 * 1000 + 1000)
    ).toISOString();

    expect(
      shouldSendAlert({
        alertsEnabled: true,
        currentRisk: "High",
        lastRiskLevel: "Moderate",
        lastSentAt: justOverADayAgo,
        now,
      })
    ).toBe(true);
  });
});
