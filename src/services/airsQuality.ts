import { cachedJson } from "../lib/apiCache";

export type AirQualityData = {
  list?: {
    main: {
      aqi: number;
    };
    components?: Record<string, number>;
    dt?: number;
  }[];
};

export async function getAirQuality(
  latitude: string,
  longitude: string
): Promise<AirQualityData> {
  try {
    return await cachedJson<AirQualityData>(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`,
      {
        cacheKey: `air-quality:${latitude}:${longitude}`,
        ttlMs: 10 * 60 * 1000,
      }
    );
  } catch {
    throw new Error("Unable to retrieve air quality data.");
  }
}
