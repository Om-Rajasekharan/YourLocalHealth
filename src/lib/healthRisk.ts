export function calculateHealthRisk(
  aqi: number | null,
  fluActivity: string,
  covidActivity: string,
  context?: {
    heatRisk?: string;
    uvRisk?: string;
    alertRisk?: string;
    pollutantRisk?: string;
  }
) {
  if (aqi === null || aqi === undefined)
    return "Unknown";

  // High risk
  if (
    aqi >= 4 ||
    fluActivity === "High" ||
    fluActivity === "Very High" ||
    covidActivity === "High" ||
    covidActivity === "Very High" ||
    context?.heatRisk === "High" ||
    context?.uvRisk === "High" ||
    context?.alertRisk === "High" ||
    context?.pollutantRisk === "High"
  ) {
    return "High";
  }

  // Moderate risk
  if (
    aqi === 3 ||
    fluActivity === "Moderate" ||
    covidActivity === "Moderate" ||
    context?.heatRisk === "Moderate" ||
    context?.uvRisk === "Moderate" ||
    context?.alertRisk === "Moderate" ||
    context?.pollutantRisk === "Moderate"
  ) {
    return "Moderate";
  }

  return "Low";
}

export function calculateRespiratoryRisk(
  aqi: number | null,
  fluActivity: string,
  covidActivity: string,
  context?: {
    alertRisk?: string;
    pollutantRisk?: string;
  }
) {
  if (aqi === null || aqi === undefined)
    return "Unknown";

  if (
    aqi >= 4 ||
    fluActivity === "High" ||
    fluActivity === "Very High" ||
    covidActivity === "High" ||
    covidActivity === "Very High" ||
    context?.alertRisk === "High" ||
    context?.pollutantRisk === "High"
  ) {
    return "High";
  }

  if (
    aqi === 3 ||
    fluActivity === "Moderate" ||
    covidActivity === "Moderate" ||
    context?.alertRisk === "Moderate" ||
    context?.pollutantRisk === "Moderate"
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
