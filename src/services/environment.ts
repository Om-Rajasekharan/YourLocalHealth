import { cachedJson } from "../lib/apiCache";

export type EnvironmentData = {
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  uvIndexMax: number | null;
  temperatureMax: number | null;
  apparentTemperatureMax: number | null;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
  };
  daily?: {
    uv_index_max?: number[];
    temperature_2m_max?: number[];
    apparent_temperature_max?: number[];
  };
};

const unavailableEnvironmentData: EnvironmentData = {
  temperature: null,
  apparentTemperature: null,
  humidity: null,
  uvIndexMax: null,
  temperatureMax: null,
  apparentTemperatureMax: null,
};

export function getHeatRiskLabel(apparentTemperature: number | null) {
  if (apparentTemperature === null) return "Unknown";
  if (apparentTemperature >= 103) return "High";
  if (apparentTemperature >= 90) return "Moderate";
  return "Low";
}

export function getUvRiskLabel(uvIndex: number | null) {
  if (uvIndex === null) return "Unknown";
  if (uvIndex >= 8) return "High";
  if (uvIndex >= 6) return "Moderate";
  return "Low";
}

export async function getEnvironmentData(
  latitude: string,
  longitude: string
): Promise<EnvironmentData> {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature",
    daily:
      "uv_index_max,temperature_2m_max,apparent_temperature_max",
    temperature_unit: "fahrenheit",
    timezone: "auto",
  });

  try {
    const data = await cachedJson<OpenMeteoResponse>(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      {
        cacheKey: `environment:${latitude}:${longitude}`,
        ttlMs: 15 * 60 * 1000,
      }
    );

    return {
      temperature: data.current?.temperature_2m ?? null,
      apparentTemperature: data.current?.apparent_temperature ?? null,
      humidity: data.current?.relative_humidity_2m ?? null,
      uvIndexMax: data.daily?.uv_index_max?.[0] ?? null,
      temperatureMax: data.daily?.temperature_2m_max?.[0] ?? null,
      apparentTemperatureMax:
        data.daily?.apparent_temperature_max?.[0] ?? null,
    };
  } catch {
    return unavailableEnvironmentData;
  }
}
