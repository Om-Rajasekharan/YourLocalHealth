export function calculateHealthRisk(
  aqi: number | null,
  fluActivity: string,
  covidActivity: string
) {
  if (aqi === null || aqi === undefined)
    return "Unknown";

  // High risk
  if (
    aqi >= 4 ||
    fluActivity === "High" ||
    fluActivity === "Very High" ||
    covidActivity === "High" ||
    covidActivity === "Very High"
  ) {
    return "High";
  }

  // Moderate risk
  if (
    aqi === 3 ||
    fluActivity === "Moderate" ||
    covidActivity === "Moderate"
  ) {
    return "Moderate";
  }

  return "Low";
}

export function calculateRespiratoryRisk(
  aqi: number | null,
  fluActivity: string,
  covidActivity: string
) {
  if (aqi === null || aqi === undefined)
    return "Unknown";

  if (
    aqi >= 4 ||
    fluActivity === "High" ||
    fluActivity === "Very High" ||
    covidActivity === "High" ||
    covidActivity === "Very High"
  ) {
    return "High";
  }

  if (
    aqi === 3 ||
    fluActivity === "Moderate" ||
    covidActivity === "Moderate"
  ) {
    return "Moderate";
  }

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
