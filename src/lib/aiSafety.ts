export type AiSafetyAudit = {
  blocked: boolean;
  urgent: boolean;
  reasons: string[];
  usedContext: string[];
  disclaimer: string;
};

const injectionPatterns = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /system prompt/i,
  /developer message/i,
  /reveal.*(prompt|instructions|policy)/i,
  /act as (a )?(doctor|clinician|physician) and diagnose/i,
  /bypass (safety|guardrails|rules)/i,
];

const urgentPatterns = [
  /chest pain/i,
  /can't breathe/i,
  /cannot breathe/i,
  /trouble breathing/i,
  /difficulty breathing/i,
  /blue lips/i,
  /confusion/i,
  /fainting/i,
  /stroke/i,
  /suicidal/i,
  /overdose/i,
];

export const healthDisclaimer =
  "MyLocalHealth is informational only and does not provide medical advice, diagnosis, or treatment.";

export function buildAiSafetyAudit(input: {
  question: string;
  contextLabels: string[];
}): AiSafetyAudit {
  const reasons: string[] = [];
  const blocked = injectionPatterns.some((pattern) => pattern.test(input.question));
  const urgent = urgentPatterns.some((pattern) => pattern.test(input.question));

  if (blocked) {
    reasons.push("Question matched prompt-injection or unsafe role-instruction patterns.");
  }

  if (urgent) {
    reasons.push("Question may describe urgent symptoms that require professional help.");
  }

  if (input.contextLabels.length === 0) {
    reasons.push("No dashboard context labels were supplied.");
  }

  return {
    blocked,
    urgent,
    reasons,
    usedContext: input.contextLabels,
    disclaimer: healthDisclaimer,
  };
}

export function urgentCareMessage() {
  return "If you are having severe symptoms, trouble breathing, chest pain, confusion, fainting, or another emergency, seek urgent medical care or call emergency services now.";
}

export function unsafeQuestionMessage() {
  return "I cannot follow instructions that try to override the assistant's safety rules or ask for hidden prompts. I can still answer general, informational questions using the dashboard context.";
}
