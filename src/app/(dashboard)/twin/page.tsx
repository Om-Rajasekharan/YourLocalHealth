"use client";

import { useRouter } from "next/navigation";
import {
  DashboardPageShell,
  EmptyDashboardState,
  ExposureTwinPanel,
  getDashboardUrl,
} from "../../../components/DashboardApp";
import { useDashboardData } from "../../../contexts/DashboardDataContext";

export default function TwinPage() {
  const router = useRouter();
  const {
    user,
    zipCode,
    city,
    state,
    searched,
    scoreBreakdown,
    healthRisk,
    respiratoryRisk,
    userProfile,
    healthForecastData,
    dataConfidence,
    symptomPrediction,
    checkinStreak,
    symptomEnvironmentCorrelation,
    personalRiskCalibration,
  } = useDashboardData();

  if (!zipCode || !searched) {
    return (
      <EmptyDashboardState
        copy="The Exposure Twin simulates your personal exposure for a searched location. Search a ZIP code to load your local environment, routine, and check-in context."
        eyebrow="Exposure Twin"
        title="Enter a ZIP code first"
      />
    );
  }

  return (
    <DashboardPageShell
      activeView="twin"
      city={city}
      eyebrow="Exposure Twin · Personal simulation"
      onNavigate={(view) => router.push(getDashboardUrl(zipCode, view))}
      state={state}
      title={`${city}, ${state}`}
      zipCode={zipCode}
    >
      <ExposureTwinPanel
        user={user}
        zipCode={zipCode}
        city={city}
        state={state}
        baseScore={scoreBreakdown.score}
        healthRisk={healthRisk}
        respiratoryRisk={respiratoryRisk}
        profile={userProfile}
        forecastData={healthForecastData}
        topDrivers={scoreBreakdown.topDrivers}
        dataConfidence={dataConfidence}
        symptomPrediction={symptomPrediction}
        checkinStreak={checkinStreak}
        symptomEnvironmentCorrelation={symptomEnvironmentCorrelation}
        personalRiskCalibration={personalRiskCalibration}
        onOpenCheckin={() => router.push(getDashboardUrl(zipCode, "checkin"))}
        onOpenForecast={() => router.push(getDashboardUrl(zipCode, "forecast"))}
      />
    </DashboardPageShell>
  );
}
