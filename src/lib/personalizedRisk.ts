import type { UserProfile } from "../services/userProfile";

type RiskLevel = "Low" | "Moderate" | "High" | "Unknown";

function normalizeRisk(risk: string): RiskLevel {
  if (risk === "Low" || risk === "Moderate" || risk === "High") {
    return risk;
  }

  return "Unknown";
}

function increaseRisk(risk: RiskLevel) {
  if (risk === "Low") return "Moderate";
  if (risk === "Moderate") return "High";
  return risk;
}

export function personalizeRisk(
  baseHealthRisk: string,
  baseRespiratoryRisk: string,
  profile: UserProfile | null
) {
  if (!profile) {
    return {
      healthRisk: baseHealthRisk,
      respiratoryRisk: baseRespiratoryRisk,
      reasons: [] as string[],
      isPersonalized: false,
    };
  }

  const reasons: string[] = [];
  let healthScore = 0;
  let respiratoryScore = 0;

  if (profile.age_range === "65+") {
    healthScore += 2;
    respiratoryScore += 2;
    reasons.push("age range may increase risk from respiratory illness");
  } else if (profile.age_range === "50-64") {
    healthScore += 1;
    respiratoryScore += 1;
    reasons.push("age range may modestly increase respiratory risk");
  }

  if (profile.respiratory_sensitivity === "High") {
    healthScore += 2;
    respiratoryScore += 2;
    reasons.push("higher respiratory sensitivity");
  } else if (profile.respiratory_sensitivity === "Mild") {
    healthScore += 1;
    respiratoryScore += 1;
    reasons.push("mild respiratory sensitivity");
  }

  if (profile.outdoor_exposure === "High") {
    healthScore += 1;
    respiratoryScore += 1;
    reasons.push("more time spent outdoors");
  }

  if (profile.commute_exposure === "High") {
    healthScore += 1;
    respiratoryScore += 1;
    reasons.push("higher commute or traffic exposure");
  }

  if (
    profile.activity_level === "High" &&
    profile.outdoor_exposure !== "Low"
  ) {
    respiratoryScore += 1;
    reasons.push("higher activity level can increase breathing exposure");
  }

  let healthRisk = normalizeRisk(baseHealthRisk);
  let respiratoryRisk = normalizeRisk(baseRespiratoryRisk);

  if (healthScore >= 2) {
    healthRisk = increaseRisk(healthRisk);
  }

  if (respiratoryScore >= 2) {
    respiratoryRisk = increaseRisk(respiratoryRisk);
  }

  return {
    healthRisk,
    respiratoryRisk,
    reasons,
    isPersonalized: true,
  };
}
