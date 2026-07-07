"use client";

import { useRouter } from "next/navigation";
import {
  DashboardPageShell,
  EmptyDashboardState,
  ForecastPanel,
  getDashboardUrl,
} from "../../../components/DashboardApp";
import { useDashboardData } from "../../../contexts/DashboardDataContext";

export default function ForecastPage() {
  const router = useRouter();
  const { zipCode, city, state, searched, healthForecastData, forecastError } =
    useDashboardData();

  if (!zipCode || !searched) {
    return (
      <EmptyDashboardState
        copy="The forecast is built from a local search. Search a ZIP code to load the 24-hour risk pulse, best windows, and hourly contributors."
        eyebrow="Forecast"
        title="Enter a ZIP code first"
      />
    );
  }

  return (
    <DashboardPageShell
      activeView="forecast"
      city={city}
      eyebrow="Forecast · 24-hour local risk"
      onNavigate={(view) => router.push(getDashboardUrl(zipCode, view))}
      state={state}
      title={`${city}, ${state}`}
      zipCode={zipCode}
    >
      <ForecastPanel
        forecastData={healthForecastData}
        forecastError={forecastError}
        city={city}
        state={state}
      />
    </DashboardPageShell>
  );
}
