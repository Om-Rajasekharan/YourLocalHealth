export function calculateHealthRisk(aqi: number | null) {
  if (aqi === null || aqi === undefined) return "Unknown";

  if (aqi >= 4) return "High";
  if (aqi === 3) return "Moderate";
  return "Low";
}

export function getRiskColor(risk: string) {
  switch (risk) {
    case "Low":
      return "text-green-500";

    case "Moderate":
      return "text-yellow-500";

    case "High":
      return "text-red-500";

    default:
      return "text-gray-500";
  }
}