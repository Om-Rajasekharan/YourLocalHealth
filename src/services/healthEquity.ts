export type HealthEquityIndicator = {
  label: string;
  value: number | null;
  unit: string;
  level: "Low" | "Moderate" | "High" | "Unknown";
  source: string;
  detail: string;
};

export type HealthEquityData = {
  zctaName: string;
  zcta: string;
  tractFips: string | null;
  equityScore: number;
  equityLevel: "Low" | "Moderate" | "High" | "Unknown";
  indicators: HealthEquityIndicator[];
  cdcPlaces: {
    chronicBurdenScore: number | null;
    asthma: number | null;
    copd: number | null;
    smoking: number | null;
    obesity: number | null;
    diabetes: number | null;
  } | null;
  summary: string;
  caveats: string[];
};

type HealthEquityResponse = {
  equityData?: HealthEquityData;
  error?: string;
};

export async function getHealthEquityData(
  zipCode: string,
  latitude?: string,
  longitude?: string
): Promise<HealthEquityData> {
  const params = new URLSearchParams({ zipCode });

  if (latitude && longitude) {
    params.set("latitude", latitude);
    params.set("longitude", longitude);
  }

  const response = await fetch(`/api/health-equity?${params.toString()}`);
  const data = (await response.json()) as HealthEquityResponse;

  if (!response.ok || !data.equityData) {
    throw new Error(
      data.error ?? "Health equity data is temporarily unavailable."
    );
  }

  return data.equityData;
}
