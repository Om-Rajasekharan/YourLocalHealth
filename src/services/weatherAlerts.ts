import { cachedJson } from "../lib/apiCache";

export type WeatherAlert = {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  certainty: string;
  effective: string;
  expires: string;
};

type NwsAlertFeature = {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
    urgency?: string;
    certainty?: string;
    effective?: string;
    expires?: string;
  };
};

type NwsAlertsResponse = {
  features?: NwsAlertFeature[];
};

export function summarizeAlertRisk(alerts: WeatherAlert[]) {
  if (alerts.length === 0) return "None";

  const hasHighSeverity = alerts.some((alert) =>
    ["Extreme", "Severe"].includes(alert.severity)
  );

  return hasHighSeverity ? "High" : "Moderate";
}

export async function getWeatherAlerts(
  latitude: string,
  longitude: string
): Promise<WeatherAlert[]> {
  const params = new URLSearchParams({
    point: `${latitude},${longitude}`,
  });

  let data: NwsAlertsResponse;

  try {
    data = await cachedJson<NwsAlertsResponse>(
      `https://api.weather.gov/alerts/active?${params.toString()}`,
      {
        cacheKey: `weather-alerts:${latitude}:${longitude}`,
        headers: {
          Accept: "application/geo+json",
        },
        ttlMs: 5 * 60 * 1000,
      }
    );
  } catch {
    throw new Error("Unable to retrieve weather alerts.");
  }

  return (data.features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};

    return {
      id: feature.id ?? `alert-${index}`,
      event: properties.event ?? "Weather alert",
      headline: properties.headline ?? properties.event ?? "Weather alert",
      severity: properties.severity ?? "Unknown",
      urgency: properties.urgency ?? "Unknown",
      certainty: properties.certainty ?? "Unknown",
      effective: properties.effective ?? "",
      expires: properties.expires ?? "",
    };
  });
}
