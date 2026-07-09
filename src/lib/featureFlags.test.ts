import { afterEach, describe, expect, it } from "vitest";
import { getFeatureFlagSnapshot, isFeatureEnabled } from "./featureFlags";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("feature flags", () => {
  it("uses enabled defaults", () => {
    delete process.env.ENABLE_AI_ASSISTANT;

    expect(isFeatureEnabled("aiAssistant")).toBe(true);
  });

  it("allows environment variables to disable features", () => {
    process.env.ENABLE_AI_ASSISTANT = "false";

    expect(isFeatureEnabled("aiAssistant")).toBe(false);
  });

  it("returns a complete feature snapshot", () => {
    const snapshot = getFeatureFlagSnapshot();

    expect(Object.keys(snapshot).sort()).toEqual([
      "aiAssistant",
      "aiPlan",
      "experimentalSymptomSignals",
      "modelEvaluation",
    ]);
  });
});
