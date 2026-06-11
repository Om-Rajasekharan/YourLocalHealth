export function getAirQualityLabel(aqi: number | null) {
  switch (aqi) {
    case 1:
      return "Good";
    case 2:
      return "Fair";
    case 3:
      return "Moderate";
    case 4:
      return "Poor";
    case 5:
      return "Very Poor";
    default:
      return "Unavailable";
  }
}

const pollutantLabels: Record<string, string> = {
  co: "Carbon monoxide",
  no: "Nitric oxide",
  no2: "Nitrogen dioxide",
  o3: "Ozone",
  so2: "Sulfur dioxide",
  pm2_5: "PM2.5",
  pm10: "PM10",
  nh3: "Ammonia",
};

const moderateThresholds: Record<string, number> = {
  no2: 53,
  o3: 70,
  so2: 75,
  pm2_5: 12,
  pm10: 54,
};

const highThresholds: Record<string, number> = {
  no2: 100,
  o3: 100,
  so2: 185,
  pm2_5: 35,
  pm10: 150,
};

export function getPollutantRiskLabel(
  components: Record<string, number> | undefined
) {
  if (!components) return "Unknown";

  const hasHighPollutant = Object.entries(highThresholds).some(
    ([pollutant, threshold]) =>
      (components[pollutant] ?? 0) >= threshold
  );

  if (hasHighPollutant) return "High";

  const hasModeratePollutant = Object.entries(moderateThresholds).some(
    ([pollutant, threshold]) =>
      (components[pollutant] ?? 0) >= threshold
  );

  return hasModeratePollutant ? "Moderate" : "Low";
}

export function getDominantPollutant(
  components: Record<string, number> | undefined
) {
  if (!components) return "Unavailable";

  const scoredPollutants = Object.entries(moderateThresholds)
    .map(([pollutant, threshold]) => ({
      pollutant,
      value: components[pollutant] ?? 0,
      score: (components[pollutant] ?? 0) / threshold,
    }))
    .sort((a, b) => b.score - a.score);

  const dominant = scoredPollutants[0];

  if (!dominant || dominant.value === 0) {
    return "Unavailable";
  }

  return `${pollutantLabels[dominant.pollutant] ?? dominant.pollutant} (${dominant.value.toFixed(
    1
  )})`;
}
