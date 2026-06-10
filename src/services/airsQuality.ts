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
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`
  );

  if (!response.ok) {
    throw new Error("Unable to retrieve air quality data.");
  }

  const data = (await response.json()) as AirQualityData;

  return data;
}
