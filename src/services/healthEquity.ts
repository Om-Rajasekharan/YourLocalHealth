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
  equityScore: number;
  equityLevel: "Low" | "Moderate" | "High" | "Unknown";
  indicators: HealthEquityIndicator[];
  summary: string;
  caveats: string[];
};

type HealthEquityResponse = {
  equityData?: HealthEquityData;
  error?: string;
};

export async function getHealthEquityData(
  zipCode: string
): Promise<HealthEquityData> {
  const params = new URLSearchParams({ zipCode });
  const response = await fetch(`/api/health-equity?${params.toString()}`);
  const data = (await response.json()) as HealthEquityResponse;

  if (!response.ok || !data.equityData) {
    throw new Error(
      data.error ?? "Health equity data is temporarily unavailable."
    );
  }

  return data.equityData;
}
