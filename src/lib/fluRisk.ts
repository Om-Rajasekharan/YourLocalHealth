export function getFluRiskLevel(activity: number) {
  if (activity >= 8) return "High";
  if (activity >= 4) return "Moderate";
  return "Low";
}