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

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Unable to retrieve heat and UV data.");
  }

  const data = (await response.json()) as OpenMeteoResponse;

  return {
    temperature: data.current?.temperature_2m ?? null,
    apparentTemperature: data.current?.apparent_temperature ?? null,
    humidity: data.current?.relative_humidity_2m ?? null,
    uvIndexMax: data.daily?.uv_index_max?.[0] ?? null,
    temperatureMax: data.daily?.temperature_2m_max?.[0] ?? null,
    apparentTemperatureMax:
      data.daily?.apparent_temperature_max?.[0] ?? null,
  };
}
