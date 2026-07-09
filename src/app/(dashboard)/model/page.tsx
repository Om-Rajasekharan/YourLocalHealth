"use client";

import { useRouter } from "next/navigation";
import {
  DataConfidencePanel,
  DashboardPageShell,
  EmptyDashboardState,
  FeatureSnapshotPanel,
  ModelDataSourcesPanel,
  RiskTransparencyPanel,
  SymptomProbabilityPanel,
  getDashboardUrl,
} from "../../../components/DashboardApp";
import { useDashboardData } from "../../../contexts/DashboardDataContext";

export default function ModelPage() {
  const router = useRouter();
  const {
    zipCode,
    city,
    state,
    searched,
    scoreBreakdown,
    dataConfidence,
    methodology,
    symptomPrediction,
    healthForecastData,
    healthEquityData,
    featureSnapshot,
    featureSnapshotStatus,
  } = useDashboardData();

  if (!zipCode || !searched) {
    return (
      <EmptyDashboardState
        copy="The risk model breakdown is built from a local search. Search a ZIP code to see the contributor radar, data confidence, and source coverage."
        eyebrow="Model & Data"
        title="Enter a ZIP code first"
      />
    );
  }

  return (
    <DashboardPageShell
      activeView="model"
      city={city}
      eyebrow="Model & Data · Transparency"
      onNavigate={(view) => router.push(getDashboardUrl(zipCode, view))}
      state={state}
      title={`${city}, ${state}`}
      zipCode={zipCode}
    >
      <RiskTransparencyPanel
        score={scoreBreakdown.score}
        items={scoreBreakdown.items}
        topDrivers={scoreBreakdown.topDrivers}
        categoryScores={scoreBreakdown.categoryScores}
        methodology={methodology}
      />
      <SymptomProbabilityPanel prediction={symptomPrediction} />
      <DataConfidencePanel confidence={dataConfidence} />
      <FeatureSnapshotPanel
        snapshot={featureSnapshot}
        status={featureSnapshotStatus}
      />
      <ModelDataSourcesPanel
        forecastData={healthForecastData}
        equityData={healthEquityData}
      />
    </DashboardPageShell>
  );
}
