export type FeatureFlag =
  | "aiAssistant"
  | "aiPlan"
  | "modelEvaluation"
  | "experimentalSymptomSignals"
  | "mlModelServing"
  | "ragKnowledgeBase";

const flagEnv: Record<FeatureFlag, string> = {
  aiAssistant: "ENABLE_AI_ASSISTANT",
  aiPlan: "ENABLE_AI_PLAN",
  modelEvaluation: "ENABLE_MODEL_EVALUATION",
  experimentalSymptomSignals: "ENABLE_EXPERIMENTAL_SYMPTOM_SIGNALS",
  mlModelServing: "ENABLE_ML_MODEL_SERVING",
  ragKnowledgeBase: "ENABLE_RAG_KNOWLEDGE_BASE",
};

const defaults: Record<FeatureFlag, boolean> = {
  aiAssistant: true,
  aiPlan: true,
  modelEvaluation: true,
  experimentalSymptomSignals: true,
  mlModelServing: false,
  ragKnowledgeBase: false,
};

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function isFeatureEnabled(flag: FeatureFlag) {
  return parseBoolean(process.env[flagEnv[flag]], defaults[flag]);
}

export function getFeatureFlagSnapshot() {
  return Object.fromEntries(
    (Object.keys(flagEnv) as FeatureFlag[]).map((flag) => [
      flag,
      isFeatureEnabled(flag),
    ])
  ) as Record<FeatureFlag, boolean>;
}
