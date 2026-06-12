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
  drivers: string[];
};

export type HealthForecastData = {
  hours: ForecastHour[];
  averageScore: number;
  peakScore: number;
  bestWindow: ForecastHour | null;
  worstWindow: ForecastHour | null;
  trends: ForecastTrend[];
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
    hourly: "us_aqi,pm2_5,ozone",
    timezone: "auto",
    forecast_days: "2",
  });

  const [weatherResponse, airResponse] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams}`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`),
  ]);

  if (!weatherResponse.ok || !airResponse.ok) {
    throw new Error("Unable to retrieve forecast data.");
  }

  const weatherData =
    (await weatherResponse.json()) as WeatherForecastResponse;
  const airData =
    (await airResponse.json()) as AirQualityForecastResponse;
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
  const trends = [
    buildTrend("Risk score", "/100", hours, (hour) => hour.score),
    buildTrend("U.S. AQI", "AQI", hours, (hour) => hour.usAqi),
    buildTrend("PM2.5", "ug/m3", hours, (hour) => hour.pm25),
    buildTrend("Ozone", "ug/m3", hours, (hour) => hour.ozone),
    buildTrend("Feels like", "F", hours, (hour) => hour.apparentTemperature),
    buildTrend("UV index", "UV", hours, (hour) => hour.uvIndex),
  ];

  return {
    hours,
    averageScore,
    peakScore,
    bestWindow,
    worstWindow,
    trends,
    summary: summarizeForecast(bestWindow, worstWindow, peakScore),
  };
}
