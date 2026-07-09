import { cachedJson } from "../lib/apiCache";

export type ForecastHour = {
  time: string;
  displayTime: string;
  score: number;
  risk: "Low" | "Moderate" | "High";
  usAqi: number | null;
  pm25: number | null;
  ozone: number | null;
  apparentTemperature: number | null;
  uvIndex: number | null;
  alderPollen: number | null;
  birchPollen: number | null;
  grassPollen: number | null;
  mugwortPollen: number | null;
  ragweedPollen: number | null;
  pollenIndex: number | null;
  pollenRisk: "Low" | "Moderate" | "High" | "Unknown";
  drivers: string[];
};

export type ForecastDriverCorrelation = {
  label: string;
  coefficient: number | null;
  n: number;
  direction: "Positive" | "Negative" | "None" | "Insufficient data";
};

export type ForecastStatistics = {
  mean: number;
  median: number;
  standardDeviation: number;
  coefficientOfVariation: number | null;
  scoreRange: {
    min: number;
    max: number;
  };
  variabilityBand: {
    low: number;
    high: number;
  };
  peakZScore: number | null;
  highRiskHours: number;
  moderateRiskHours: number;
  signalCompleteness: number;
  driverCorrelations: ForecastDriverCorrelation[];
};

export type HealthForecastData = {
  hours: ForecastHour[];
  averageScore: number;
  peakScore: number;
  bestWindow: ForecastHour | null;
  worstWindow: ForecastHour | null;
  allergyPeakWindow: ForecastHour | null;
  allergyPeakScore: number | null;
  trends: ForecastTrend[];
  statistics: ForecastStatistics;
  summary: string;
};

export type ForecastTrend = {
  label: string;
  unit: string;
  values: (number | null)[];
  min: number | null;
  max: number | null;
  peakTime: string;
  direction: "Rising" | "Falling" | "Stable" | "Mixed";
};

type WeatherForecastResponse = {
  hourly?: {
    time?: string[];
    apparent_temperature?: number[];
    uv_index?: number[];
  };
};

type AirQualityForecastResponse = {
  hourly?: {
    time?: string[];
    us_aqi?: number[];
    pm2_5?: number[];
    ozone?: number[];
    alder_pollen?: (number | null)[];
    birch_pollen?: (number | null)[];
    grass_pollen?: (number | null)[];
    mugwort_pollen?: (number | null)[];
    ragweed_pollen?: (number | null)[];
  };
};

function riskFromScore(score: number): ForecastHour["risk"] {
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

function componentScore(
  value: number | null,
  moderateThreshold: number,
  highThreshold: number
) {
  if (value === null) return 0;
  if (value >= highThreshold) return 100;
  if (value >= moderateThreshold) return 55;
  return 15;
}

function pollenRiskFromIndex(
  pollenIndex: number | null
): ForecastHour["pollenRisk"] {
  if (pollenIndex === null) return "Unknown";
  if (pollenIndex >= 50) return "High";
  if (pollenIndex >= 15) return "Moderate";
  return "Low";
}

function getPollenIndex(values: (number | null)[]) {
  const knownValues = values.filter((value) => value !== null);

  if (knownValues.length === 0) return null;

  return Math.round(Math.max(...knownValues));
}

function formatForecastTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
  });
}

function buildDrivers(hour: {
  usAqi: number | null;
  pm25: number | null;
  ozone: number | null;
  apparentTemperature: number | null;
  uvIndex: number | null;
  pollenIndex: number | null;
  pollenRisk: ForecastHour["pollenRisk"];
}) {
  return [
    hour.usAqi !== null && hour.usAqi > 100
      ? "AQI forecast above 100"
      : "",
    hour.pm25 !== null && hour.pm25 >= 35
      ? "PM2.5 forecast elevated"
      : "",
    hour.ozone !== null && hour.ozone >= 100
      ? "Ozone forecast elevated"
      : "",
    hour.apparentTemperature !== null &&
    hour.apparentTemperature >= 90
      ? "Heat stress forecast elevated"
      : "",
    hour.uvIndex !== null && hour.uvIndex >= 6
      ? "UV forecast elevated"
      : "",
    hour.pollenRisk === "High"
      ? "Pollen forecast high"
      : "",
    hour.pollenRisk === "Moderate"
      ? "Pollen forecast elevated"
      : "",
  ].filter(Boolean);
}

function summarizeForecast(
  bestWindow: ForecastHour | null,
  worstWindow: ForecastHour | null,
  peakScore: number
) {
  if (!bestWindow || !worstWindow) {
    return "Forecast data was not complete enough to summarize.";
  }

  if (peakScore >= 67) {
    return `Forecast risk peaks around ${worstWindow.displayTime}. The lowest-risk window is around ${bestWindow.displayTime}.`;
  }

  if (peakScore >= 34) {
    return `Some forecast signals rise around ${worstWindow.displayTime}. ${bestWindow.displayTime} currently looks like the better outdoor window.`;
  }

  return `The next 24 hours look relatively low risk, with ${bestWindow.displayTime} as the lowest estimated exposure window.`;
}

function buildTrend(
  label: string,
  unit: string,
  hours: ForecastHour[],
  getValue: (hour: ForecastHour) => number | null
): ForecastTrend {
  const values = hours.map(getValue);
  const knownValues = values.filter((value) => value !== null);
  const min =
    knownValues.length > 0 ? Math.min(...knownValues) : null;
  const max =
    knownValues.length > 0 ? Math.max(...knownValues) : null;
  const peakIndex =
    max === null ? -1 : values.findIndex((value) => value === max);
  const firstKnown = knownValues[0] ?? null;
  const lastKnown = knownValues.at(-1) ?? null;
  const delta =
    firstKnown === null || lastKnown === null
      ? 0
      : lastKnown - firstKnown;
  const direction =
    knownValues.length < 2
      ? "Mixed"
      : Math.abs(delta) < 3
      ? "Stable"
      : delta > 0
      ? "Rising"
      : "Falling";

  return {
    label,
    unit,
    values,
    min,
    max,
    peakTime: peakIndex >= 0 ? hours[peakIndex].displayTime : "Unavailable",
    direction,
  };
}

function roundStat(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;

  const valueMean = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - valueMean) ** 2, 0) /
    (values.length - 1);

  return Math.sqrt(variance);
}

function pearsonCorrelation(
  hours: ForecastHour[],
  getValue: (hour: ForecastHour) => number | null
) {
  const pairs = hours
    .map((hour) => ({ score: hour.score, value: getValue(hour) }))
    .filter(
      (pair): pair is { score: number; value: number } => pair.value !== null
    );

  if (pairs.length < 3) {
    return { coefficient: null, n: pairs.length };
  }

  const scores = pairs.map((pair) => pair.score);
  const values = pairs.map((pair) => pair.value);
  const scoreMean = mean(scores);
  const valueMean = mean(values);
  const numerator = pairs.reduce(
    (total, pair) =>
      total + (pair.score - scoreMean) * (pair.value - valueMean),
    0
  );
  const scoreSums = scores.reduce(
    (total, score) => total + (score - scoreMean) ** 2,
    0
  );
  const valueSums = values.reduce(
    (total, value) => total + (value - valueMean) ** 2,
    0
  );
  const denominator = Math.sqrt(scoreSums * valueSums);

  if (denominator === 0) {
    return { coefficient: null, n: pairs.length };
  }

  return {
    coefficient: roundStat(numerator / denominator, 2),
    n: pairs.length,
  };
}

function correlationDirection(
  coefficient: number | null
): ForecastDriverCorrelation["direction"] {
  if (coefficient === null) return "Insufficient data";
  if (coefficient >= 0.15) return "Positive";
  if (coefficient <= -0.15) return "Negative";
  return "None";
}

export function buildForecastStatistics(hours: ForecastHour[]): ForecastStatistics {
  const scores = hours.map((hour) => hour.score);
  const scoreMean = mean(scores);
  const scoreMedian = median(scores);
  const scoreStandardDeviation = standardDeviation(scores);
  const scoreMin = scores.length > 0 ? Math.min(...scores) : 0;
  const scoreMax = scores.length > 0 ? Math.max(...scores) : 0;
  const observedSignals = hours.reduce((total, hour) => {
    return (
      total +
      [
        hour.usAqi,
        hour.pm25,
        hour.ozone,
        hour.apparentTemperature,
        hour.uvIndex,
        hour.pollenIndex,
      ].filter((value) => value !== null).length
    );
  }, 0);
  const totalSignals = Math.max(1, hours.length * 6);
  const driverInputs: {
    label: string;
    getValue: (hour: ForecastHour) => number | null;
  }[] = [
    { label: "AQI", getValue: (hour) => hour.usAqi },
    { label: "PM2.5", getValue: (hour) => hour.pm25 },
    { label: "Ozone", getValue: (hour) => hour.ozone },
    { label: "Feels-like temperature", getValue: (hour) => hour.apparentTemperature },
    { label: "UV index", getValue: (hour) => hour.uvIndex },
    { label: "Pollen index", getValue: (hour) => hour.pollenIndex },
  ];

  return {
    mean: roundStat(scoreMean, 1),
    median: roundStat(scoreMedian, 1),
    standardDeviation: roundStat(scoreStandardDeviation, 1),
    coefficientOfVariation:
      scoreMean === 0
        ? null
        : roundStat((scoreStandardDeviation / scoreMean) * 100, 1),
    scoreRange: {
      min: Math.round(scoreMin),
      max: Math.round(scoreMax),
    },
    variabilityBand: {
      low: Math.max(0, Math.round(scoreMean - scoreStandardDeviation)),
      high: Math.min(100, Math.round(scoreMean + scoreStandardDeviation)),
    },
    peakZScore:
      scoreStandardDeviation === 0
        ? null
        : roundStat((scoreMax - scoreMean) / scoreStandardDeviation, 2),
    highRiskHours: hours.filter((hour) => hour.score >= 67).length,
    moderateRiskHours: hours.filter(
      (hour) => hour.score >= 34 && hour.score < 67
    ).length,
    signalCompleteness: Math.round((observedSignals / totalSignals) * 100),
    driverCorrelations: driverInputs.map((input) => {
      const { coefficient, n } = pearsonCorrelation(hours, input.getValue);

      return {
        label: input.label,
        coefficient,
        n,
        direction: correlationDirection(coefficient),
      };
    }),
  };
}

export async function getHealthForecast(
  latitude: string,
  longitude: string
): Promise<HealthForecastData> {
  const weatherParams = new URLSearchParams({
    latitude,
    longitude,
    hourly: "apparent_temperature,uv_index",
    temperature_unit: "fahrenheit",
    timezone: "auto",
    forecast_days: "2",
  });
  const airParams = new URLSearchParams({
    latitude,
    longitude,
    hourly:
      "us_aqi,pm2_5,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen",
    timezone: "auto",
    forecast_days: "2",
  });

  let weatherData: WeatherForecastResponse;
  let airData: AirQualityForecastResponse;

  try {
    [weatherData, airData] = await Promise.all([
      cachedJson<WeatherForecastResponse>(
        `https://api.open-meteo.com/v1/forecast?${weatherParams}`,
        {
          cacheKey: `forecast-weather:${latitude}:${longitude}`,
          ttlMs: 15 * 60 * 1000,
        }
      ),
      cachedJson<AirQualityForecastResponse>(
        `https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`,
        {
          cacheKey: `forecast-air:${latitude}:${longitude}`,
          ttlMs: 15 * 60 * 1000,
        }
      ),
    ]);
  } catch {
    throw new Error("Unable to retrieve forecast data.");
  }
  const weatherTimes = weatherData.hourly?.time ?? [];
  const airTimes = airData.hourly?.time ?? [];
  const airIndexByTime = new Map(
    airTimes.map((time, index) => [time, index])
  );
  const hours = weatherTimes.slice(0, 24).map((time, index) => {
    const airIndex = airIndexByTime.get(time);
    const usAqi =
      airIndex === undefined
        ? null
        : airData.hourly?.us_aqi?.[airIndex] ?? null;
    const pm25 =
      airIndex === undefined
        ? null
        : airData.hourly?.pm2_5?.[airIndex] ?? null;
    const ozone =
      airIndex === undefined
        ? null
        : airData.hourly?.ozone?.[airIndex] ?? null;
    const alderPollen =
      airIndex === undefined
        ? null
        : airData.hourly?.alder_pollen?.[airIndex] ?? null;
    const birchPollen =
      airIndex === undefined
        ? null
        : airData.hourly?.birch_pollen?.[airIndex] ?? null;
    const grassPollen =
      airIndex === undefined
        ? null
        : airData.hourly?.grass_pollen?.[airIndex] ?? null;
    const mugwortPollen =
      airIndex === undefined
        ? null
        : airData.hourly?.mugwort_pollen?.[airIndex] ?? null;
    const ragweedPollen =
      airIndex === undefined
        ? null
        : airData.hourly?.ragweed_pollen?.[airIndex] ?? null;
    const pollenIndex = getPollenIndex([
      alderPollen,
      birchPollen,
      grassPollen,
      mugwortPollen,
      ragweedPollen,
    ]);
    const pollenRisk = pollenRiskFromIndex(pollenIndex);
    const apparentTemperature =
      weatherData.hourly?.apparent_temperature?.[index] ?? null;
    const uvIndex = weatherData.hourly?.uv_index?.[index] ?? null;
    const aqiScore = componentScore(usAqi, 51, 101);
    const pm25Score = componentScore(pm25, 12, 35);
    const ozoneScore = componentScore(ozone, 70, 100);
    const heatScore = componentScore(apparentTemperature, 90, 103);
    const uvScore = componentScore(uvIndex, 6, 8);
    const score = Math.round(
      aqiScore * 0.3 +
        pm25Score * 0.25 +
        ozoneScore * 0.15 +
        heatScore * 0.2 +
        uvScore * 0.1
    );
    const drivers = buildDrivers({
      usAqi,
      pm25,
      ozone,
      apparentTemperature,
      uvIndex,
      pollenIndex,
      pollenRisk,
    });

    return {
      time,
      displayTime: formatForecastTime(time),
      score,
      risk: riskFromScore(score),
      usAqi,
      pm25,
      ozone,
      apparentTemperature,
      uvIndex,
      alderPollen,
      birchPollen,
      grassPollen,
      mugwortPollen,
      ragweedPollen,
      pollenIndex,
      pollenRisk,
      drivers,
    };
  });
  const averageScore =
    hours.length > 0
      ? Math.round(
          hours.reduce((total, hour) => total + hour.score, 0) /
            hours.length
        )
      : 0;
  const sortedByScore = [...hours].sort((a, b) => a.score - b.score);
  const bestWindow = sortedByScore[0] ?? null;
  const worstWindow = sortedByScore.at(-1) ?? null;
  const peakScore = worstWindow?.score ?? 0;
  const sortedByPollen = [...hours]
    .filter((hour) => hour.pollenIndex !== null)
    .sort((a, b) => (b.pollenIndex ?? 0) - (a.pollenIndex ?? 0));
  const allergyPeakWindow = sortedByPollen[0] ?? null;
  const allergyPeakScore = allergyPeakWindow?.pollenIndex ?? null;
  const trends = [
    buildTrend("Risk score", "/100", hours, (hour) => hour.score),
    buildTrend("U.S. AQI", "AQI", hours, (hour) => hour.usAqi),
    buildTrend("PM2.5", "ug/m3", hours, (hour) => hour.pm25),
    buildTrend("Ozone", "ug/m3", hours, (hour) => hour.ozone),
    buildTrend("Feels like", "F", hours, (hour) => hour.apparentTemperature),
    buildTrend("UV index", "UV", hours, (hour) => hour.uvIndex),
    buildTrend("Pollen index", "grains/m3", hours, (hour) => hour.pollenIndex),
  ];
  const statistics = buildForecastStatistics(hours);

  return {
    hours,
    averageScore,
    peakScore,
    bestWindow,
    worstWindow,
    allergyPeakWindow,
    allergyPeakScore,
    trends,
    statistics,
    summary: summarizeForecast(bestWindow, worstWindow, peakScore),
  };
}
