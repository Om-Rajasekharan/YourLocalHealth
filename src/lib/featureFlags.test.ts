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

  it("defaults ml model serving to off since it depends on an external process", () => {
    delete process.env.ENABLE_ML_MODEL_SERVING;

    expect(isFeatureEnabled("mlModelServing")).toBe(false);
  });

  it("allows environment variables to enable ml model serving", () => {
    process.env.ENABLE_ML_MODEL_SERVING = "true";

    expect(isFeatureEnabled("mlModelServing")).toBe(true);
  });

  it("returns a complete feature snapshot", () => {
    const snapshot = getFeatureFlagSnapshot();

    expect(Object.keys(snapshot).sort()).toEqual([
      "aiAssistant",
      "aiPlan",
      "experimentalSymptomSignals",
      "mlModelServing",
      "modelEvaluation",
    ]);
  });
});
