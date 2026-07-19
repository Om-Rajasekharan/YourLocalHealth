"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  type CSSProperties,
  FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useDashboardData } from "../contexts/DashboardDataContext";
import {
  getAirQualityLabel,
  getPollutantRiskLabel,
} from "../lib/airQuality";
import {
  evaluateRiskModel,
  type RiskCategoryScore,
  type RiskModelConfidence,
  type RiskModelItem,
} from "../lib/riskModel";
import type { SymptomPrediction } from "../lib/symptomPrediction";
import { getLocation } from "../services/location";
import { getAirQuality } from "../services/airsQuality";
import { getFluData } from "../services/flu";
import { getCovidData } from "../services/covid";
import {
  getEnvironmentData,
  getHeatRiskLabel,
  getUvRiskLabel,
} from "../services/environment";
import {
  getWeatherAlerts,
  summarizeAlertRisk,
  type WeatherAlert,
} from "../services/weatherAlerts";
import { type UserProfile } from "../services/userProfile";
import { type HealthEquityData } from "../services/healthEquity";
import { type HealthForecastData } from "../services/healthForecast";
import type { FeatureSnapshot } from "../services/featureSnapshot";
import {
  saveSymptomCheckin,
  type CheckinStreak,
  type SavedHealthSnapshot,
} from "../services/mlTrainingData";
import type { SymptomEnvironmentCorrelation } from "../services/symptomEnvironmentCorrelation";
import type { PersonalRiskCalibration } from "../services/personalRiskCalibration";
import type { TwinNode3D } from "./Twin3D";

const Twin3D = dynamic(
  () => import("./Twin3D").then((module) => module.Twin3D),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[32rem] place-items-center rounded-[1.5rem] border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted-foreground)] shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
        Loading exposure twin...
      </div>
    ),
  }
);

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type HealthChatContext = {
  zipCode: string;
  city: string;
  state: string;
  aqi: number | null;
  airQuality: string;
  fluActivity: string;
  covidActivity: string;
  covidValue: number | null;
  covidSites: number | null;
  covidCoverage: string;
  covidTimePeriod: string;
  covidUpdatedAt: string;
  healthRisk: string;
  respiratoryRisk: string;
  profileSummary: string;
  profileReasons: string[];
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  activeAlerts: string[];
  dominantPollutant: string;
  pollutantRisk: string;
  news: {
    title: string;
    source: string;
    publishedAt: string;
    url: string;
  }[];
};

type HealthPlan = {
  headline: string;
  summary: string;
  priority: string;
  actions: string[];
  watch: string[];
  uncertainty: string;
};

type HealthPlanContext = {
  context: HealthChatContext;
  model: {
    version: string;
    score: number;
    topDrivers: RiskModelItem[];
    categoryScores: RiskCategoryScore[];
  };
  forecast?: {
    summary: string;
    averageScore: number;
    peakScore: number;
    bestWindow: string;
    bestWindowScore: number | null;
    worstWindow: string;
    worstWindowScore: number | null;
    allergyPeakWindow: string;
    allergyPeakScore: number | null;
    pollenRisk: string;
    trends: {
      label: string;
      direction: string;
      peakTime: string;
      min: number | null;
      max: number | null;
      unit: string;
    }[];
  };
};

type TimelineSetting = "Indoors" | "Outdoors";
type TimelineIntensity = "Resting" | "Light" | "Moderate" | "Intense";

type TimelineBlock = {
  id: string;
  label: string;
  zipCode: string;
  start: string;
  end: string;
  setting: TimelineSetting;
  intensity: TimelineIntensity;
};

type TimelineLocationSnapshot = {
  zipCode: string;
  city: string;
  state: string;
  baseScore: number;
  healthRisk: string;
  respiratoryRisk: string;
  airQuality: string;
  heatRisk: string;
  uvRisk: string;
};

export type DashboardView =
  | "overview"
  | "twin"
  | "plan"
  | "forecast"
  | "timeline"
  | "equity"
  | "checkin"
  | "signals"
  | "news"
  | "analytics"
  | "model";

export const dashboardViews: { id: DashboardView; label: string; description: string }[] = [
  {
    id: "overview",
    label: "Today",
    description: "Quick daily read",
  },
  {
    id: "twin",
    label: "Exposure Twin",
    description: "Personal simulation and streak",
  },
  {
    id: "plan",
    label: "AI Plan",
    description: "Personalized daily guidance",
  },
  {
    id: "forecast",
    label: "Forecast",
    description: "Main 24-hour risk forecast",
  },
  {
    id: "timeline",
    label: "Planner",
    description: "Daily exposure estimate",
  },
  {
    id: "equity",
    label: "Local Context",
    description: "Equity and chronic disease context",
  },
  {
    id: "checkin",
    label: "Check-in",
    description: "Label symptoms for future ML",
  },
  {
    id: "signals",
    label: "Signals",
    description: "Air, heat, UV, flu, COVID, and alerts",
  },
  {
    id: "news",
    label: "Local News",
    description: "Recent health-related articles",
  },
  {
    id: "analytics",
    label: "Community Trends",
    description: "Embedded Tableau or Looker dashboard",
  },
  {
    id: "model",
    label: "Model & Data",
    description: "Spider chart and risk logic",
  },
];

export const primaryDashboardViews: DashboardView[] = [
  "overview",
  "forecast",
  "twin",
  "model",
];

export const dashboardGroups: {
  label: string;
  description: string;
  views: DashboardView[];
}[] = [
  {
    label: "Your Day",
    description: "Plan, log, and get guidance for today",
    views: ["timeline", "checkin", "plan"],
  },
  {
    label: "Local Data",
    description: "Supporting signals, equity, and news",
    views: ["signals", "equity", "news", "analytics"],
  },
];

export function getDashboardView(viewId: DashboardView) {
  return (
    dashboardViews.find((view) => view.id === viewId) ??
    dashboardViews[0]
  );
}

export function isDashboardView(value: string | null): value is DashboardView {
  return dashboardViews.some((view) => view.id === value);
}

const standaloneDashboardViews: DashboardView[] = ["forecast", "twin", "model"];

export function getDashboardUrl(zipCode: string, view: DashboardView) {
  if (standaloneDashboardViews.includes(view)) {
    const params = new URLSearchParams({ zipCode });
    return `/${view}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    zipCode,
    view,
  });

  return `/?${params.toString()}`;
}

function riskBadgeClass(risk: string) {
  switch (risk) {
    case "Low":
    case "Very Low":
      return "border-[var(--secondary)] bg-[var(--secondary-soft)] text-[var(--secondary)]";
    case "Moderate":
      return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]";
    case "High":
    case "Very High":
      return "border-[var(--accent-ink)] bg-[var(--accent)]/18 font-bold text-[var(--accent-ink)]";
    default:
      return "border-[var(--rule-strong)] bg-[var(--surface-muted)] text-[var(--foreground-faint)]";
  }
}

function DashboardNav({
  activeView,
  onChange,
}: {
  activeView: DashboardView;
  onChange: (view: DashboardView) => void;
}) {
  const activeDashboardView = getDashboardView(activeView);
  const activeGroup = dashboardGroups.find((group) =>
    group.views.includes(activeView)
  );
  const activeSection = activeGroup?.label ?? "Core";

  return (
    <div className="quiet-surface relative z-20 mb-5 rounded-lg p-2">
      <nav
        aria-label="Dashboard sections"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {primaryDashboardViews.map((viewId) => {
          const view = getDashboardView(viewId);
          const isActive = activeView === viewId;

          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onChange(view.id)}
              className={`flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-lg border px-4 py-3 text-left transition ${
                isActive
                  ? "border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--foreground)]"
                  : "border-transparent bg-transparent text-[var(--foreground-muted)] hover:border-[var(--rule)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              <span className="block text-sm font-semibold">
                {view.label}
              </span>
              <span className="block text-xs leading-4 text-[var(--foreground-faint)]">
                {view.description}
              </span>
            </button>
          );
        })}

        {dashboardGroups.map((group) => {
          const isActiveGroup = group.views.includes(activeView);

          return (
            <div className="group relative" key={group.label}>
              <button
                type="button"
                onClick={() => onChange(group.views[0])}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  isActiveGroup
                    ? "border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--foreground)]"
                    : "border-transparent bg-transparent text-[var(--foreground-muted)] hover:border-[var(--rule)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {group.label}
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-[var(--foreground-faint)]">
                    {isActiveGroup
                      ? activeDashboardView.label
                      : group.description}
                  </span>
                </span>
                <span className="text-sm text-[var(--accent)]">v</span>
              </button>

              <div className="invisible absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-80 overflow-y-auto rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-2 opacity-0 shadow-2xl shadow-black/35 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {group.views.map((viewId) => {
                  const view = getDashboardView(viewId);
                  const isActive = activeView === viewId;

                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => onChange(view.id)}
                      className={`w-full rounded-lg px-3 py-3 text-left transition ${
                        isActive
                          ? "bg-[var(--accent)]/10 text-[var(--foreground)]"
                          : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {view.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--foreground-faint)]">
                        {view.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-[var(--rule)] px-2 py-3">
        <p className="eyebrow-text">
          {activeSection} / {activeDashboardView.label}
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
          {activeDashboardView.description}
        </p>
      </div>
    </div>
  );
}

export function DashboardSidebar({
  activeView,
  onChange,
  city,
  state,
  zipCode,
}: {
  activeView: DashboardView;
  onChange: (view: DashboardView) => void;
  city: string;
  state: string;
  zipCode: string;
}) {
  const activeDashboardView = getDashboardView(activeView);

  return (
    <aside className="dashboard-sidebar sticky top-5 hidden max-h-[calc(100vh-2.5rem)] overflow-y-auto lg:block">
      <div className="quiet-surface field-report sidebar-location-card p-4">
        <div className="relative z-10 border-b border-[var(--rule)] pb-4">
          <p className="eyebrow-text">Location</p>
          <h2 className="display-heading mt-2 text-2xl leading-tight text-[var(--foreground)]">
            {city}, {state}
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            ZIP {zipCode}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
            {activeDashboardView.description}
          </p>
        </div>

        <nav
          aria-label="Dashboard sections"
          className="relative z-10 mt-4 space-y-5"
        >
          <div>
            <p className="px-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
              Core
            </p>
            <div className="mt-2 space-y-1">
              {primaryDashboardViews.map((viewId) => {
                const view = getDashboardView(viewId);
                const isActive = activeView === viewId;

                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => onChange(view.id)}
                    className={`sidebar-nav-item w-full text-left ${
                      isActive ? "sidebar-nav-item-active" : ""
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {view.label}
                    </span>
                    <span className="mt-1 block text-xs leading-4">
                      {view.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {dashboardGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
                {group.label}
              </p>
              <div className="mt-2 space-y-1">
                {group.views.map((viewId) => {
                  const view = getDashboardView(viewId);
                  const isActive = activeView === viewId;

                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => onChange(view.id)}
                      className={`sidebar-nav-item w-full text-left ${
                        isActive ? "sidebar-nav-item-active" : ""
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {view.label}
                      </span>
                      <span className="mt-1 block text-xs leading-4">
                        {view.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function CoreFeatureHub({
  activeView,
  onChange,
  forecastData,
  twinScore,
  twinLevel,
  checkinStreak,
  score,
  topDrivers,
  categoryScores,
}: {
  activeView: DashboardView;
  onChange: (view: DashboardView) => void;
  forecastData: HealthForecastData | null;
  twinScore: number;
  twinLevel: string;
  checkinStreak: CheckinStreak;
  score: number;
  topDrivers: RiskModelItem[];
  categoryScores: RiskCategoryScore[];
}) {
  const forecastHours = forecastData?.hours.slice(0, 9) ?? [];
  const topDriver = topDrivers[0];
  const cards = [
    {
      id: "forecast" as DashboardView,
      eyebrow: "Forecast",
      title: "Forecast",
      value: forecastData ? `Peak ${forecastData.peakScore}/100` : "Loading",
      detail: forecastData
        ? `Best window: ${forecastData.bestWindow?.displayTime ?? "Unavailable"}. Worst window: ${forecastData.worstWindow?.displayTime ?? "Unavailable"}.`
        : "Building the 24-hour exposure forecast from weather, air, pollen, and alert data.",
      action: "Open forecast",
    },
    {
      id: "twin" as DashboardView,
      eyebrow: "Personal Exposure",
      title: "Exposure Twin",
      value: `${twinScore}/100`,
      detail: `${twinLevel} personal exposure estimate. Current check-in streak: ${checkinStreak.currentStreak} day${checkinStreak.currentStreak === 1 ? "" : "s"}.`,
      action: "Open twin",
    },
    {
      id: "model" as DashboardView,
      eyebrow: "Model & Data",
      title: "Model & Data",
      value: `${score}/100`,
      detail: topDriver
        ? `Spider chart highlights ${topDriver.label} as the strongest current determinant.`
        : "Spider chart explains the risk index across local determinants.",
      action: "Open model",
    },
  ];

  return (
    <section className="core-feature-hub" aria-label="Featured health tools">
      <div className="core-feature-intro">
        <p className="eyebrow-text">Your Local Snapshot</p>
        <h3 className="display-heading mt-2 text-3xl leading-tight text-[var(--foreground)] sm:text-4xl">
          Forecast what matters, then see why.
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
          Start with the next 24 hours, personalize it to your routine, then
          inspect the signals behind the score.
        </p>
      </div>

      <div className="core-feature-grid">
        {cards.map((card) => {
          const isActive = activeView === card.id;

          return (
            <button
              type="button"
              onClick={() => onChange(card.id)}
              className={`core-feature-card ${
                isActive ? "core-feature-card-active" : ""
              }`}
              key={card.id}
            >
              <span className="core-feature-eyebrow">{card.eyebrow}</span>
              <span className="core-feature-title">{card.title}</span>
              <span className="core-feature-value">{card.value}</span>
              <span className="core-feature-detail">{card.detail}</span>

              {card.id === "forecast" && (
                <span className="core-feature-bars" aria-hidden="true">
                  {(forecastHours.length > 0
                    ? forecastHours
                    : Array.from({ length: 9 }, (_, index) => ({
                        score: 18 + index * 5,
                      }))
                  ).map((hour, index) => (
                    <span
                      key={index}
                      style={{ height: `${Math.max(14, hour.score)}%` }}
                    />
                  ))}
                </span>
              )}

              {card.id === "twin" && (
                <span className="core-feature-week" aria-hidden="true">
                  {checkinStreak.week.map((day) => (
                    <span
                      className={day.checkedIn ? "is-complete" : ""}
                      key={day.date}
                    />
                  ))}
                </span>
              )}

              {card.id === "model" && (
                <span className="core-feature-model" aria-hidden="true">
                  {categoryScores.map((category) => (
                    <span key={category.label}>
                      <i style={{ width: `${category.score}%` }} />
                    </span>
                  ))}
                </span>
              )}

              <span className="core-feature-action">{card.action}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RiskBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-[var(--radius-sm)] border-l-[3px] pl-2 pr-3 py-1 font-mono text-xs font-semibold ${riskBadgeClass(
        value
      )}`}
    >
      {value}
    </span>
  );
}

function BriefActionCard({
  label,
  title,
  detail,
  tone = "default",
}: {
  label: string;
  title: string;
  detail: string;
  tone?: "default" | "primary";
}) {
  const primary = tone === "primary";

  return (
    <article
      className={`brief-action-card rounded-lg border p-4 ${
        primary
          ? "border-[var(--rule)] bg-white text-[var(--foreground)] shadow-sm"
          : "border-[var(--secondary)]/18 bg-[var(--surface-muted)]"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          primary ? "text-[var(--accent)]" : "text-[var(--foreground-muted)]"
        }`}
      >
        {label}
      </p>
      <h4
        className={`mt-2 text-base font-semibold leading-6 ${
          primary ? "text-[var(--foreground)]" : "text-[var(--foreground)]"
        }`}
      >
        {title}
      </h4>
      <p
        className={`mt-2 text-sm leading-6 ${
          primary ? "text-[var(--foreground-muted)]" : "text-[var(--foreground-muted)]"
        }`}
      >
        {detail}
      </p>
    </article>
  );
}

const MAP_ZOOM = 11;
const TILE_SIZE = 256;

type MapTile = {
  id: string;
  x: number;
  y: number;
  url: string;
  left: number;
  top: number;
};

function clampLatitude(value: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, value));
}

function latLngToWorldPixel(latitude: number, longitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLatitude = Math.sin((clampLatitude(latitude) * Math.PI) / 180);

  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLatitude) / (1 - sinLatitude)) /
          (4 * Math.PI)) *
      scale,
  };
}

function worldPixelToLatLng(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude =
    (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return { latitude, longitude };
}

function getMapTiles(latitude: number, longitude: number) {
  const world = latLngToWorldPixel(latitude, longitude, MAP_ZOOM);
  const centerTileX = Math.floor(world.x / TILE_SIZE);
  const centerTileY = Math.floor(world.y / TILE_SIZE);
  const centerOffsetX = world.x - centerTileX * TILE_SIZE;
  const centerOffsetY = world.y - centerTileY * TILE_SIZE;
  const tileCount = 2 ** MAP_ZOOM;
  const tiles: MapTile[] = [];

  for (let row = -2; row <= 2; row += 1) {
    for (let column = -4; column <= 4; column += 1) {
      const tileX = ((centerTileX + column) % tileCount + tileCount) % tileCount;
      const tileY = Math.max(0, Math.min(tileCount - 1, centerTileY + row));

      tiles.push({
        id: `${tileX}-${tileY}`,
        x: tileX,
        y: tileY,
        url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${tileX}/${tileY}.png`,
        left: column * TILE_SIZE - centerOffsetX,
        top: row * TILE_SIZE - centerOffsetY,
      });
    }
  }

  return tiles;
}

function InteractiveLocationMap({
  city,
  state,
  zipCode,
  latitude,
  longitude,
  loading,
  message,
  onSelectPoint,
}: {
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  loading: boolean;
  message: string;
  onSelectPoint: (latitude: number, longitude: number) => void;
}) {
  const [mapCenter, setMapCenter] = useState({ latitude, longitude });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCenterX: number;
    startCenterY: number;
  } | null>(null);
  const tiles = getMapTiles(mapCenter.latitude, mapCenter.longitude);

  useEffect(() => {
    setMapCenter({ latitude, longitude });
  }, [latitude, longitude]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (loading) return;

    const center = latLngToWorldPixel(
      mapCenter.latitude,
      mapCenter.longitude,
      MAP_ZOOM
    );

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: center.x,
      startCenterY: center.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextCenter = worldPixelToLatLng(
      drag.startCenterX - (event.clientX - drag.startX),
      drag.startCenterY - (event.clientY - drag.startY),
      MAP_ZOOM
    );

    setMapCenter(nextCenter);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const resetMapCenter = () => {
    setMapCenter({ latitude, longitude });
  };

  const searchMapCenter = () => {
    onSelectPoint(mapCenter.latitude, mapCenter.longitude);
  };

  return (
    <section className="quiet-surface mt-5 overflow-hidden rounded-lg">
      <div className="flex flex-col gap-3 border-b border-[var(--rule)] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow-text">Clickable Map</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {city}, {state}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
            Drag the map to explore nearby areas. Search the center marker when
            you want a new local health snapshot.
          </p>
        </div>
        <p className="text-sm text-[var(--foreground-faint)]">
          Current ZIP {zipCode} · center {mapCenter.latitude.toFixed(4)},{" "}
          {mapCenter.longitude.toFixed(4)}
        </p>
      </div>

      <div
        role="application"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`group relative h-[30rem] w-full touch-none overflow-hidden bg-[var(--surface-muted)] text-left outline-none sm:h-80 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${loading ? "cursor-wait" : ""}`}
        aria-label={`Draggable map near ${city}, ${state}. Drag to move the map, then use Search center point.`}
      >
        <div className="absolute inset-0 overflow-hidden">
          {tiles.map((tile) => (
            // Map tiles are external, position-critical images; Next Image optimization is not useful here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tile.id}
              src={tile.url}
              alt=""
              draggable={false}
              className="absolute h-64 w-64 select-none"
              style={{
                left: `calc(50% + ${tile.left}px)`,
                top: `calc(50% + ${tile.top}px)`,
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,15,13,0.08),rgba(7,15,13,0.48))]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)]/90 shadow-[0_0_0_7px_rgba(75,156,211,0.16),0_12px_24px_rgba(0,0,0,0.28)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%+1.45rem)] h-7 w-px -translate-x-1/2 bg-[var(--surface-muted)]" />

        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-3 sm:bottom-4 sm:left-4 sm:right-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl rounded-lg border border-[var(--rule)] bg-[var(--surface)]/85 p-3 shadow-2xl backdrop-blur sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Map controls
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--foreground)] sm:text-sm sm:leading-6">
              {message ||
                "Drag the map first. The marker in the center is the point that will be searched."}
            </p>
          </div>
          <div
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={resetMapCenter}
              disabled={loading}
              className="w-full rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              Reset map
            </button>
            <button
              type="button"
              onClick={searchMapCenter}
              disabled={loading}
              className="w-full rounded-full border border-[var(--accent)]/40 bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-ink)] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              {loading ? "Finding ZIP..." : "Search center point"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveSignalTape() {
  const signals = [
    "ZIP Code Geography",
    "Latitude And Longitude",
    "Current AQI",
    "PM2.5",
    "Ozone",
    "Dominant Pollutant",
    "Heat Index",
    "UV Index",
    "Humidity",
    "Weather Alerts",
    "24-Hour Forecast",
    "Pollen Risk",
    "CDC Flu Activity",
    "COVID Wastewater",
    "Local Health News",
    "ACS Poverty Context",
    "Insurance Access",
    "Transportation Access",
    "EPA-Style Pollution Burden",
    "CDC PLACES Asthma",
    "COPD Prevalence",
    "Smoking Prevalence",
    "Diabetes Prevalence",
    "Chronic Disease Burden",
    "Personal Sensitivity",
    "Time Spent Outside",
    "Activity Level",
    "Traffic Exposure",
    "Car/Commute Context",
    "Daily Exposure Timeline",
    "Symptom Check-Ins",
    "ML Outcome Labels",
  ];

  return (
    <div className="mt-6 overflow-hidden border-y border-[var(--rule)] py-3 text-left">
      <p className="eyebrow-text mb-3">Signals checked</p>
      <div className="signal-tape">
        <div className="flex flex-wrap gap-2">
          {signals.map((signal) => (
            <span
              className="rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--foreground-muted)]"
              key={signal}
            >
              {signal}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreSearchFeatureSections() {
  const features = [
    {
      id: "feature-twin",
      eyebrow: "Exposure Twin",
      title: "A digital version of your day, not just your ZIP code",
      body:
        "The standout idea is a personal exposure twin: a lightweight simulation of where you are, when you are outside, how sensitive you are, and which local hazards are active today.",
      method:
        "Generated from the searched location, hourly forecast, air and illness signals, profile fields, exposure timeline, and future symptom check-ins that become ML outcome labels.",
      stat: "Twin",
      statLabel: "personal exposure simulation",
      visual: "twin",
      readouts: [
        ["Inputs", "Place, time, profile, forecast"],
        ["Learning loop", "Predictions + symptom check-ins"],
        ["Output", "One change that may lower exposure"],
      ],
    },
    {
      id: "feature-forecast",
      eyebrow: "Forecast",
      title: "A 24-hour pulse for outdoor decisions",
      body:
        "The forecast blends hourly weather, heat index, UV, PM2.5, ozone, pollen, and active alerts into a time-of-day exposure score. The app highlights the best and worst windows so the result is easier to act on.",
      method:
        "Generated with live Open-Meteo forecast data, air-quality forecast signals, weather alerts, and a transparent weighted risk model.",
      stat: "24 hr",
      statLabel: "hourly risk window",
      visual: "forecast",
      readouts: [
        ["Forecast inputs", "Temp, UV, AQI, pollen"],
        ["Model output", "Hourly exposure score"],
        ["User-facing result", "Best and worst windows"],
      ],
    },
    {
      id: "feature-model",
      eyebrow: "Model & Data",
      title: "A spider chart that explains the score",
      body:
        "The model view turns the risk score into visible determinants. Instead of a black-box number, users can see which signals are pushing risk up and how source coverage affects confidence.",
      method:
        "Generated from the transparent risk index, source availability, feature weights, top drivers, and relative determinant probabilities.",
      stat: "0-100",
      statLabel: "explainable risk index",
      visual: "model",
      readouts: [
        ["Radar", "Risk determinants"],
        ["Drivers", "Weighted model inputs"],
        ["Confidence", "Source coverage"],
      ],
    },
    {
      id: "feature-air-heat",
      eyebrow: "Air + Heat",
      title: "Respiratory and heat stress in one view",
      body:
        "Air pollution and heat can stack together. MyLocalHealth reads AQI, dominant pollutants, PM2.5, ozone, humidity, and feels-like temperature to explain what is driving the current signal.",
      method:
        "Generated from OpenWeather air pollution data, Open-Meteo weather data, pollutant thresholds, and health-risk scoring rules.",
      stat: "AQI",
      statLabel: "pollutant-aware context",
      visual: "air",
      readouts: [
        ["Air inputs", "PM2.5, ozone, NO2"],
        ["Heat inputs", "Feels-like temp, humidity"],
        ["Risk logic", "Combined respiratory stress"],
      ],
    },
    {
      id: "feature-equity",
      eyebrow: "Equity",
      title: "Why the same hazard can affect places differently",
      body:
        "A heat wave or bad-air day does not land equally everywhere. The local context layer combines social determinants and chronic disease estimates to show where risk may be harder to avoid or recover from.",
      method:
        "Generated from Census ACS indicators, CDC PLACES chronic disease prevalence, and an equity overlay that explains vulnerability drivers.",
      stat: "ACS",
      statLabel: "plus CDC PLACES",
      visual: "equity",
      readouts: [
        ["Social context", "Poverty, insurance, vehicle access"],
        ["Health context", "Asthma, COPD, smoking"],
        ["Output", "Structural vulnerability layer"],
      ],
    },
    {
      id: "feature-ai-plan",
      eyebrow: "AI Plan",
      title: "Plain-language guidance from the local snapshot",
      body:
        "The AI assistant uses the dashboard context to answer questions and draft daily suggestions. It is designed to explain the data, not diagnose or replace medical care.",
      method:
        "Generated from the ZIP-code snapshot, forecast drivers, local news, profile context when available, and OpenAI-powered summarization.",
      stat: "AI",
      statLabel: "context-aware explanation",
      visual: "ai",
      readouts: [
        ["Context", "Local data snapshot"],
        ["Guardrail", "Informational, not diagnosis"],
        ["Output", "Plain-language guidance"],
      ],
    },
  ];

  return (
    <section className="presearch-features" aria-label="How MyLocalHealth works">
      <div className="presearch-section-intro">
        <p>Before you search</p>
        <h2 className="display-heading">
          What the dashboard is looking for
        </h2>
        <span>
          Each ZIP code search pulls live public-health signals, then turns them
          into a readable forecast, context layer, and personalized next step.
        </span>
      </div>

      <div className="presearch-feature-list">
        {features.map((feature, index) => (
          <article
            className="presearch-feature-card"
            id={feature.id}
            key={feature.id}
          >
            <div className="presearch-feature-copy">
              <span className="presearch-feature-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="presearch-feature-eyebrow">{feature.eyebrow}</p>
              <h3 className="display-heading">{feature.title}</h3>
              <p>{feature.body}</p>
              <div className="presearch-method-note">
                <strong>How it is generated</strong>
                <span>{feature.method}</span>
              </div>
            </div>

            <div className={`presearch-visual presearch-visual-${feature.visual}`}>
              <div className="presearch-stat-card">
                <strong>{feature.stat}</strong>
                <span>{feature.statLabel}</span>
              </div>
              <div className="presearch-readout-list">
                {feature.readouts.map(([label, value]) => (
                  <div className="presearch-readout-row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              {feature.visual === "twin" ? (
                <div className="presearch-twin-flow">
                  <span>Local data</span>
                  <span>Personal routine</span>
                  <span>Action window</span>
                </div>
              ) : (
                <div className="presearch-visual-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatForecastMetric(value: number | null, suffix: string) {
  if (value === null) return null;
  return `${Math.round(value)}${suffix}`;
}

function buildForecastHourExplanation(hour: HealthForecastData["hours"][number]) {
  const drivers =
    hour.drivers.length > 0
      ? hour.drivers.slice(0, 2).join(", ")
      : "No major elevated driver";
  const metrics = [
    formatForecastMetric(hour.usAqi, " AQI"),
    formatForecastMetric(hour.apparentTemperature, "°F feels like"),
    formatForecastMetric(hour.uvIndex, " UV"),
    hour.pollenRisk === "Unknown" ? null : `${hour.pollenRisk} pollen`,
  ].filter(Boolean);

  return {
    drivers,
    metrics: metrics.length > 0 ? metrics.join(" · ") : "Limited forecast values",
  };
}

function ForecastPulseStrip({
  forecastData,
  onOpenForecast,
}: {
  forecastData: HealthForecastData | null;
  onOpenForecast?: () => void;
}) {
  const hours = forecastData?.hours.slice(0, 12) ?? [];

  if (hours.length === 0) {
    return null;
  }

  return (
    <section className="quiet-surface mt-5 rounded-lg p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow-text">Next 12 hours</p>
          <h3 className="display-heading mt-1 text-2xl leading-tight text-[var(--foreground)]">
            Forecast pulse
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenForecast}
          className="w-fit rounded-full border border-[var(--rule)] px-3 py-2 text-sm font-semibold text-[var(--foreground-muted)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
        >
          Open full forecast
        </button>
      </div>

      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <div className="mt-5 grid min-w-[42rem] grid-cols-12 items-end gap-2 sm:min-w-0">
          {hours.map((hour) => {
            const height = Math.max(18, hour.score);
            const explanation = buildForecastHourExplanation(hour);
            const color =
              hour.risk === "High"
                ? "bg-[var(--accent)]"
                : hour.risk === "Moderate"
                ? "bg-[var(--accent)]"
                : "bg-[var(--secondary)]";

            return (
              <div
                className="group relative flex min-w-0 flex-col items-center gap-2"
                key={hour.time}
                tabIndex={0}
              >
                <div className="relative flex h-28 w-full items-end rounded-full bg-[var(--surface-muted)] px-1">
                  <div
                    className={`forecast-pulse-bar w-full rounded-full ${color} opacity-80`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-64 -translate-x-1/2 rounded-lg border border-[var(--rule)] bg-[var(--foreground)] p-3 text-left text-xs shadow-lg group-hover:block group-focus:block">
                  <p className="font-semibold text-white">
                    {hour.displayTime} · {hour.score}/100
                  </p>
                  <p className="mt-1 leading-5 text-[var(--foreground-muted)]">
                    {explanation.drivers}
                  </p>
                  <p className="mt-2 leading-5 text-[var(--foreground-faint)]">
                    {explanation.metrics}
                  </p>
                </div>
                <p className="w-full truncate text-center text-[0.68rem] text-[var(--foreground-faint)]">
                  {hour.displayTime.replace(/^[A-Za-z]+,?\s/, "")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SignalCard({
  title,
  value,
  detail,
  source,
  href,
}: {
  title: string;
  value: string;
  detail: string;
  source: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg outline-none transition focus:ring-4 focus:ring-[var(--accent)]/15"
    >
      <article className="quiet-surface action-panel cut-corner data-pin p-4">
        <div className="flex min-h-28 flex-col justify-between gap-3">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--foreground-muted)] transition group-hover:text-[var(--foreground)]">
                {title}
              </h3>
              <RiskBadge value={value} />
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--foreground-muted)]">
              {detail}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--rule)] pt-3">
            <p className="truncate text-xs text-[var(--foreground-faint)]">{source}</p>
            <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--foreground-muted)]">
              Details
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}

function getSignalPriority(value: string) {
  if (value === "High" || value === "Very High" || value === "Poor" || value === "Very Poor") {
    return 3;
  }

  if (
    value === "Moderate" ||
    value === "Limited Coverage" ||
    value === "Fair"
  ) {
    return 2;
  }

  if (value === "Unknown" || value === "Unavailable") {
    return 1;
  }

  return 0;
}

function buildHealthBrief({
  healthRisk,
  respiratoryRisk,
  airQualityLabel,
  dominantPollutant,
  pollutantRisk,
  heatRisk,
  uvRisk,
  alertRisk,
  weatherAlerts,
  fluActivity,
  covidActivity,
  personalizedRiskReasons,
  isPersonalized,
}: {
  healthRisk: string;
  respiratoryRisk: string;
  airQualityLabel: string;
  dominantPollutant: string;
  pollutantRisk: string;
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  weatherAlerts: WeatherAlert[];
  fluActivity: string;
  covidActivity: string;
  personalizedRiskReasons: string[];
  isPersonalized: boolean;
}) {
  const signals = [
    {
      label: "Respiratory risk",
      value: respiratoryRisk,
      note: "combined breathing-related signal",
    },
    {
      label: "Air quality",
      value: airQualityLabel,
      note: `main pollutant signal: ${dominantPollutant}`,
    },
    {
      label: "Pollutants",
      value: pollutantRisk,
      note: "pollutant-specific risk check",
    },
    {
      label: "Heat",
      value: heatRisk,
      note: "feels-like temperature exposure",
    },
    {
      label: "UV",
      value: uvRisk,
      note: "sun exposure risk",
    },
    {
      label: "Weather alerts",
      value: alertRisk,
      note:
        weatherAlerts.length > 0
          ? weatherAlerts
              .slice(0, 2)
              .map((alert) => alert.event)
              .join(", ")
          : "no active NWS alerts found",
    },
    {
      label: "Flu",
      value: fluActivity,
      note: "state respiratory illness activity",
    },
    {
      label: "COVID wastewater",
      value: covidActivity,
      note: "state wastewater activity",
    },
  ];

  const drivers = signals
    .filter((signal) => getSignalPriority(signal.value) >= 2)
    .sort(
      (a, b) => getSignalPriority(b.value) - getSignalPriority(a.value)
    )
    .slice(0, 4);

  const focusItems = [
    heatRisk === "High" || heatRisk === "Moderate"
      ? "Plan outdoor time around heat, hydrate, and take shade or cooling breaks."
      : "",
    uvRisk === "High" || uvRisk === "Moderate"
      ? "Use sun protection if you will be outside during peak daylight."
      : "",
    respiratoryRisk === "High" || respiratoryRisk === "Moderate"
      ? "Pay attention to breathing symptoms and consider reducing strenuous outdoor activity if you are sensitive."
      : "",
    alertRisk !== "None"
      ? "Review official local alerts before travel, outdoor work, or exercise."
      : "",
    fluActivity === "High" ||
    fluActivity === "Very High" ||
    covidActivity === "High" ||
    covidActivity === "Very High"
      ? "Respiratory illness activity is elevated, so prevention steps may matter more today."
      : "",
  ].filter(Boolean);

  return {
    headline:
      healthRisk === "High"
        ? "Today has elevated local health signals."
        : healthRisk === "Moderate"
        ? "A few local signals are worth watching today."
        : "Local signals look relatively low today.",
    drivers,
    focusItems:
      focusItems.length > 0
        ? focusItems.slice(0, 3)
        : ["No major action signal stands out from the current public data."],
    profileNote: isPersonalized
      ? personalizedRiskReasons.length > 0
        ? `Personalized because of ${personalizedRiskReasons.join(", ")}.`
        : "Personalized with your saved profile."
      : "Sign in and complete a health profile to personalize this brief.",
  };
}

function determinantProbabilityScore(
  item: RiskModelItem,
  overallScore: number
) {
  const determinantIntensity =
    item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0;

  return Math.max(
    0,
    Math.min(100, Math.round(determinantIntensity * 0.7 + overallScore * 0.3))
  );
}

function determinantPoint(
  index: number,
  total: number,
  value: number,
  radius: number,
  center: number
) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const distance = (value / 100) * radius;

  return {
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance,
    labelX: center + Math.cos(angle) * (radius + 34),
    labelY: center + Math.sin(angle) * (radius + 34),
    angle,
  };
}

function DeterminantRadarChart({
  items,
  overallScore,
}: {
  items: RiskModelItem[];
  overallScore: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const center = 180;
  const radius = 112;
  const chartItems = items.map((item) => ({
    ...item,
    contribution:
      item.maxPoints > 0 ? Math.round((item.points / item.maxPoints) * 100) : 0,
    probability: determinantProbabilityScore(item, overallScore),
  }));
  const activeItem = chartItems[activeIndex] ?? chartItems[0];
  const polygonPoints = chartItems
    .map((item, index) => {
      const point = determinantPoint(
        index,
        chartItems.length,
        item.probability,
        radius,
        center
      );
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div className="mt-5 grid gap-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-4 lg:grid-cols-[minmax(18rem,0.9fr)_1.1fr] lg:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
          Relative symptom-signal map
        </p>
        <h4 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
          Determinants behind today&apos;s score
        </h4>
        <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
          Hover or tap a spoke to see how each determinant contributes to the
          current risk estimate. This is a relative model signal, not a
          validated probability of illness or a medical prediction.
        </p>

        {activeItem && (
          <div className="mt-4 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {activeItem.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]/80">
                  {activeItem.detail} · {activeItem.category}
                </p>
              </div>
              <p className="shrink-0 text-2xl font-bold text-[var(--foreground-muted)]">
                {activeItem.probability}%
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${activeItem.probability}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--foreground-faint)]">
              Raw model points: +{activeItem.points}/{activeItem.maxPoints} ·
              Weight: {activeItem.weight}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(18rem,1fr)_13rem] md:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[25rem]">
          <svg
            viewBox="0 0 360 360"
            className="h-full w-full overflow-visible"
          >
            {[25, 50, 75, 100].map((ring) => {
              const ringPoints = chartItems
                .map((_, index) => {
                  const point = determinantPoint(
                    index,
                    chartItems.length,
                    ring,
                    radius,
                    center
                  );
                  return `${point.x},${point.y}`;
                })
                .join(" ");

              return (
                <polygon
                  key={ring}
                  points={ringPoints}
                  fill="none"
                  stroke="var(--rule)"
                  strokeWidth="1"
                />
              );
            })}

            {chartItems.map((item, index) => {
              const outer = determinantPoint(
                index,
                chartItems.length,
                100,
                radius,
                center
              );
              const active = index === activeIndex;

              return (
                <g key={item.label}>
                  <line
                    x1={center}
                    y1={center}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={active ? "var(--accent)" : "var(--rule)"}
                    strokeWidth={active ? 2 : 1}
                  />
                </g>
              );
            })}

            <polygon
              points={polygonPoints}
              fill="rgba(168,53,43,0.06)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <polygon
              points={chartItems
                .map((item, index) => {
                  const point = determinantPoint(
                    index,
                    chartItems.length,
                    item.contribution,
                    radius,
                    center
                  );
                  return `${point.x},${point.y}`;
                })
                .join(" ")}
              fill="none"
              stroke="var(--secondary)"
              strokeDasharray="4 5"
              strokeWidth="1.5"
            />

            {chartItems.map((item, index) => {
              const point = determinantPoint(
                index,
                chartItems.length,
                item.probability,
                radius,
                center
              );
              const labelPoint = determinantPoint(
                index,
                chartItems.length,
                100,
                radius,
                center
              );
              const active = index === activeIndex;
              const anchor =
                Math.cos(labelPoint.angle) > 0.25
                  ? "start"
                  : Math.cos(labelPoint.angle) < -0.25
                  ? "end"
                  : "middle";

              return (
                <g key={item.label}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={active ? 7 : 5}
                    fill={active ? "var(--accent)" : "var(--surface)"}
                    stroke={active ? "var(--accent)" : "var(--foreground)"}
                    strokeWidth="2"
                    className="cursor-pointer outline-none transition"
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.label}: ${item.probability}% relative symptom signal`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveIndex(index);
                      }
                    }}
                  />
                  <text
                    x={labelPoint.labelX}
                    y={labelPoint.labelY}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fill={active ? "var(--foreground)" : "var(--foreground-faint)"}
                    fontSize="10"
                    fontWeight={active ? 700 : 600}
                    pointerEvents="none"
                  >
                    {item.label}
                  </text>
                </g>
              );
            })}

            <circle
              cx={center}
              cy={center}
              r="26"
              fill="var(--surface)"
              stroke="var(--rule-strong)"
              pointerEvents="none"
            />
            <text
              x={center}
              y={center - 3}
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="16"
              fontWeight="800"
              pointerEvents="none"
            >
              {overallScore}
            </text>
            <text
              x={center}
              y={center + 13}
              textAnchor="middle"
              fill="var(--foreground-faint)"
              fontSize="9"
              fontWeight="700"
              pointerEvents="none"
            >
              INDEX
            </text>
          </svg>
        </div>

        <div className="grid gap-2">
          {chartItems.map((item, index) => (
            <button
              type="button"
              key={item.label}
              onClick={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                index === activeIndex
                  ? "border-[var(--accent)]/45 bg-[var(--accent)]/12"
                  : "border-[var(--rule)] bg-[var(--surface-muted)] hover:border-[var(--accent)]/35"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {item.label}
                </span>
                <span className="text-xs font-bold text-[var(--foreground-muted)]">
                  {item.probability}%
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RiskTransparencyPanel({
  score,
  items,
  topDrivers,
  categoryScores,
  methodology,
}: {
  score: number;
  items: RiskModelItem[];
  topDrivers: RiskModelItem[];
  categoryScores: RiskCategoryScore[];
  methodology: string[];
}) {
  const [showWeights, setShowWeights] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const activeCategory =
    categoryScores[Math.min(activeCategoryIndex, Math.max(0, categoryScores.length - 1))];
  const activeCategoryBaseline = [32, 40, 36, 28, 30, 34][activeCategoryIndex] ?? 30;
  const activeCategoryDelta = activeCategory
    ? Math.round(activeCategory.score) - activeCategoryBaseline
    : 0;
  const activeCategoryMeaning =
    activeCategoryDelta > 12
      ? "This category is above its baseline and is pushing the score upward."
      : activeCategoryDelta < -12
      ? "This category is below baseline and is helping keep the score lower."
      : "This category is close to baseline, so it is not strongly moving the score.";
  const activeCategoryAdvice = activeCategory
    ? panelAdviceForContributor(activeCategory.label)
    : "Select a category to see what it means and what action may help.";

  return (
    <section className="grid gap-5">
      <article className="model-data-feature rounded-[1.75rem] border border-[var(--border)] bg-white p-6 shadow-[0_18px_55px_-38px_rgba(19,41,75,0.5)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Model & Data
            </p>
            <h2 className="display-heading mt-2 max-w-3xl text-3xl leading-tight text-[var(--foreground)] sm:text-5xl">
              See why the score changed.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
              The radar chart turns the model into plain visual contributors:
              environment, illness, forecast, equity, and chronic-disease
              context.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-soft)] p-5 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--foreground-muted)]">
              Risk Index
            </p>
            <p className="mt-1 text-5xl font-black text-[var(--primary-ink)]">
              {score}
            </p>
            <p className="text-sm font-semibold text-[var(--foreground-muted)]">
              out of 100
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--primary)]/25 bg-gradient-to-br from-[var(--primary)]/12 via-white to-[var(--primary-soft)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Plain-English model explorer
              </p>
              <h3 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
                {activeCategory?.label ?? "Risk category"}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                {activeCategory?.detail ?? "Select a category to inspect how the model is reading this ZIP code."}
              </p>
              <p className="mt-3 rounded-xl border border-[var(--border)] bg-white/80 p-3 text-sm leading-6 text-[var(--primary-ink)]">
                <span className="font-semibold text-[var(--primary)]">What to do:</span>{" "}
                {activeCategoryAdvice}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-[var(--border)] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Current
                </p>
                <p className="mt-1 font-heading text-xl font-semibold text-[var(--primary-ink)]">
                  {activeCategory?.score ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Baseline
                </p>
                <p className="mt-1 font-heading text-xl font-semibold text-[var(--primary-ink)]">
                  {activeCategoryBaseline}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Change
                </p>
                <p className={`mt-1 font-heading text-xl font-semibold ${activeCategoryDelta >= 0 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                  {activeCategoryDelta >= 0 ? "+" : ""}
                  {activeCategoryDelta}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm leading-6 text-[var(--muted-foreground)]">
            {activeCategoryMeaning}
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categoryScores.map((category, index) => {
              const active = activeCategoryIndex === index;
              return (
                <button
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--primary-ink)] hover:border-[var(--primary)]/40"
                  }`}
                  key={category.label}
                  onClick={() => setActiveCategoryIndex(index)}
                  type="button"
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <DeterminantRadarChart items={items} overallScore={score} />

          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Biggest drivers
            </p>
            {(topDrivers.length > 0 ? topDrivers : items.slice(0, 3)).map(
              (driver) => (
                <div
                  className="rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/45 p-4"
                  key={driver.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--primary-ink)]">
                      {driver.label}
                    </p>
                    <p className="text-sm font-semibold text-[var(--primary)]">
                      +{driver.points}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    {driver.detail}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </article>

      <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Score ingredients
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
              The simplified categories below are the easiest way to audit the
              model.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWeights((current) => !current)}
            className="h-10 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--primary-ink)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            {showWeights ? "Hide full weights" : "Show full weights"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {categoryScores.map((category, index) => (
            <button
              className={`rounded-2xl border p-4 text-left transition ${
                activeCategoryIndex === index
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-[var(--border)] bg-slate-50 hover:border-[var(--primary)]/40 hover:bg-white"
              }`}
              key={category.label}
              onClick={() => setActiveCategoryIndex(index)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--primary-ink)]">
                  {category.label}
                </p>
                <p className="text-sm font-semibold text-[var(--primary)]">
                  {category.score}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${category.score}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[var(--primary-ink)]">
                Inspect →
              </p>
            </button>
          ))}
        </div>

        {showWeights && (
          <div className="mt-5 grid gap-3">
            {items.map((item) => (
              <div
                className="grid gap-2 rounded-2xl border border-[var(--border)] bg-slate-50 p-4 sm:grid-cols-[1fr_auto]"
                key={item.label}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--primary-ink)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {item.detail}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--foreground-faint)]">
                    {item.category} · Weight: {item.weight} · Max{" "}
                    {item.maxPoints} points
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--primary)]">
                  +{item.points}
                </p>
              </div>
            ))}
          </div>
        )}

        <details className="mt-5 rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--primary-ink)]">
            How the score is calculated
          </summary>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-foreground)]">
            {methodology.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </article>
    </section>
  );
}

export function SymptomProbabilityPanel({
  prediction,
  compact = false,
}: {
  prediction: SymptomPrediction;
  compact?: boolean;
}) {
  const primaryTarget =
    prediction.targets.reduce(
      (highest, target) =>
        target.probability > highest.probability ? target : highest,
      prediction.targets[0]
    ) ?? null;

  if (compact) {
    return (
      <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Symptom signal
            </p>
            <h4 className="mt-2 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
              {prediction.overallProbability}%
            </h4>
          </div>
          <RiskBadge value={prediction.confidenceLabel} />
        </div>
        {primaryTarget && (
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
            Strongest signal: {primaryTarget.label.toLowerCase()} at{" "}
            {primaryTarget.probability}%.
          </p>
        )}
      </article>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-6 shadow-[0_18px_55px_-38px_rgba(19,41,75,0.5)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Symptom Signal Engine
          </p>
          <h3 className="display-heading mt-2 max-w-3xl text-3xl leading-tight text-[var(--foreground)] sm:text-5xl">
            Experimental symptom signals, not diagnosis.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
            This transparent tabular layer estimates which self-reported
            symptom categories are most elevated relative to today&apos;s air,
            heat, pollen, illness, equity, chronic-burden, and profile context.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-soft)] p-5 text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--foreground-muted)]">
            Overall signal
          </p>
          <p className="mt-1 text-5xl font-black text-[var(--primary-ink)]">
            {prediction.overallProbability}%
          </p>
          <p className="text-sm font-semibold text-[var(--foreground-muted)]">
            confidence: {prediction.confidenceLabel}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {prediction.targets.map((target) => (
          <article
            className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4"
            key={target.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--primary-ink)]">
                  {target.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  {target.plainLanguage}
                </p>
              </div>
              <RiskBadge value={target.level} />
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="font-heading text-4xl font-semibold text-[var(--primary-ink)]">
                {target.probability}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${target.probability}%` }}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Strongest model drivers
          </p>
          <div className="mt-3 grid gap-2">
            {prediction.topDrivers.map((driver) => (
              <div
                className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                key={`${driver.label}-${driver.detail}`}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--primary-ink)]">
                    {driver.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {driver.detail}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--primary)]">
                  {driver.impact}/100
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Model status
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--primary-ink)]">
            {prediction.modelVersion}
          </p>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-foreground)]">
            {prediction.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function DataConfidencePanel({
  confidence,
}: {
  confidence: RiskModelConfidence;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Data Confidence
          </p>
          <h3 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
            {confidence.availableCount}/{confidence.totalCount} source groups loaded
          </h3>
        </div>
        <RiskBadge value={confidence.label} />
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-3">
        {confidence.sources.slice(0, 6).map((source) => (
          <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-3" key={source.label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--primary-ink)]">
                {source.label}
              </p>
              <span className={source.available ? "text-[var(--success)]" : "text-rose-600"}>
                {source.available ? "Loaded" : "Missing"}
              </span>
            </div>
          </div>
        ))}
      </div>
      {confidence.caveats.length > 0 && (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {confidence.caveats[0]}
        </p>
      )}
    </section>
  );
}

export function FeatureSnapshotPanel({
  snapshot,
  status,
}: {
  snapshot: FeatureSnapshot | null;
  status: string;
}) {
  const inputs = snapshot
    ? [
        ["AQI", snapshot.modelInputs.aqi ?? "n/a"],
        ["PM2.5", snapshot.modelInputs.pm25 ?? "n/a"],
        ["Ozone", snapshot.modelInputs.ozone ?? "n/a"],
        ["Heat", snapshot.modelInputs.heatRisk],
        ["UV", snapshot.modelInputs.uvRisk],
        ["Flu", snapshot.modelInputs.fluActivity],
        ["COVID", snapshot.modelInputs.covidActivity],
        ["Equity", snapshot.modelInputs.equityScore ?? "n/a"],
      ]
    : [];

  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Feature Store
          </p>
          <h3 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
            ML-ready search record
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            {status}
          </p>
        </div>
        {snapshot && (
          <RiskBadge value={snapshot.mlReadiness} />
        )}
      </div>

      {snapshot && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Source coverage
              </p>
              <p className="mt-2 font-heading text-3xl font-semibold text-[var(--primary-ink)]">
                {snapshot.sourceCoverage.percent}%
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {snapshot.sourceCoverage.loaded}/{snapshot.sourceCoverage.total} groups loaded
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Location key
              </p>
              <p className="mt-2 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
                {snapshot.zipCode}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {snapshot.location.city}, {snapshot.location.state}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Personal modifier
              </p>
              <p className="mt-2 font-heading text-3xl font-semibold text-[var(--primary-ink)]">
                +{snapshot.modelInputs.profileModifier}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Profile exposure adjustment
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {inputs.map(([label, value]) => (
              <div
                className="rounded-2xl border border-[var(--border)] bg-white p-3"
                key={label}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--primary-ink)]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {snapshot.missingSources.length > 0 && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              Missing from this feature record:{" "}
              {snapshot.missingSources.join(", ")}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function ModelDataSourcesPanel({
  forecastData,
  equityData,
}: {
  forecastData: HealthForecastData | null;
  equityData: HealthEquityData | null;
}) {
  const sources = [
    {
      label: "Current air quality",
      status: "Live",
      source: "OpenWeather Air Pollution API",
      use: "AQI category, dominant pollutant, and pollutant-specific respiratory context.",
    },
    {
      label: "Weather, heat, UV, and pollen forecast",
      status: forecastData ? "Loaded" : "Missing",
      source: "Open-Meteo weather and air-quality forecast APIs",
      use: "24-hour exposure forecast, best/worst outdoor windows, UV, heat, PM2.5, ozone, and pollen/allergy timing.",
    },
    {
      label: "Respiratory illness activity",
      status: "Live",
      source: "CDC respiratory illness activity dataset",
      use: "State-level flu and respiratory illness activity used in respiratory risk context.",
    },
    {
      label: "COVID wastewater",
      status: "Live",
      source: "CDC National Wastewater Surveillance System",
      use: "State wastewater viral activity, reporting-site count, and coverage confidence.",
    },
    {
      label: "Social determinants",
      status: equityData ? "Loaded" : "Missing",
      source: "U.S. Census ACS 5-year profile",
      use: "ZIP/ZCTA poverty, uninsured, and vehicle-access estimates for structural vulnerability.",
    },
    {
      label: "Chronic disease prevalence",
      status: equityData?.cdcPlaces ? "Loaded" : "Missing",
      source: "CDC PLACES 2025 census tract estimates",
      use: "Asthma, COPD, smoking, diabetes, obesity, physical health, activity, and social-needs estimates.",
    },
    {
      label: "Local health news",
      status: "Live",
      source: "GDELT and Google News RSS",
      use: "Recent nearby public-health article context for the AI assistant and plan.",
    },
    {
      label: "User check-ins",
      status: "Optional",
      source: "MyLocalHealth symptom check-ins",
      use: "Outcome labels that can train future symptom-risk models when users opt in.",
    },
  ];

  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Data sources
          </p>
          <h3 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
            What feeds the score
          </h3>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {sources.slice(0, 6).map((source) => (
          <article
            className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4"
            key={source.label}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--primary-ink)]">
                  {source.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--foreground-faint)]">
                  {source.source}
                </p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                  source.status === "Loaded" || source.status === "Live"
                    ? "border-[var(--secondary)]/30 bg-[var(--secondary)]/10 text-[var(--secondary)]"
                    : source.status === "Optional"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {source.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
              {source.use}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnalyticsEmbedPanel({
  embedUrl,
  provider,
}: {
  embedUrl: string;
  provider: string;
}) {
  const plannedViews = [
    {
      title: "Symptom check-ins",
      detail:
        "Track whether breathing, allergy, heat, or fatigue symptoms rise after high-risk days.",
    },
    {
      title: "Risk by place",
      detail:
        "Compare aggregate ZIP and state trends without exposing personal medical details.",
    },
    {
      title: "Environment vs outcomes",
      detail:
        "Explore how PM2.5, ozone, heat, pollen, and illness activity line up with check-ins.",
    },
    {
      title: "Model performance",
      detail:
        "Show training volume, validation metrics, and the strongest risk drivers over time.",
    },
  ];

  return (
    <section className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--accent)]/25 bg-[var(--surface)] shadow-2xl shadow-black/25">
      <div className="grid gap-6 border-b border-[var(--rule)] p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--secondary)]">
            Community Trends
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Public-health analytics layer
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
            This area is built for an embedded Tableau or Looker Studio report:
            aggregate trends, model performance, and community-level context.
            Keep it de-identified and avoid showing private account or medical
            history details.
          </p>
        </div>
        <div className="rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--foreground-muted)]">
          {provider}
        </div>
      </div>

      {embedUrl ? (
        <div className="bg-[var(--foreground)] p-3 sm:p-5">
          <iframe
            className="min-h-[34rem] w-full rounded-[1.25rem] border border-[var(--rule)] bg-white"
            src={embedUrl}
            title={`${provider} community health trends dashboard`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.4rem] border border-[var(--rule)] bg-[var(--surface-muted)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
              Embed not configured
            </p>
            <h4 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Add a BI dashboard when you are ready
            </h4>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
              Build a public or private embedded report in Looker Studio or
              Tableau, copy its embed URL, then add it as an environment
              variable. The app will replace this setup panel with the live
              report automatically.
            </p>
            <div className="mt-5 rounded-[1rem] border border-[var(--accent)]/25 bg-[var(--foreground)] p-4 font-mono text-xs leading-6 text-[var(--background)]/80">
              <p>NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL=</p>
              <p>NEXT_PUBLIC_TABLEAU_EMBED_URL=</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {plannedViews.map((view) => (
              <article
                className="rounded-[1.2rem] border border-[var(--rule)] bg-[var(--surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:bg-[var(--surface-muted)]"
                key={view.title}
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {view.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  {view.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function equityBadgeClass(level: string) {
  if (level === "High") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (level === "Moderate") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (level === "Low") {
    return "border-[var(--secondary)]/40 bg-[var(--secondary)]/15 text-[var(--secondary)]";
  }

  return "border-[var(--rule)] bg-[var(--surface-muted)] text-[var(--foreground)]";
}

export function HealthEquityPanel({
  equityData,
  equityError,
  heatRisk,
  pollutantRisk,
  dominantPollutant,
}: {
  equityData: HealthEquityData | null;
  equityError: string;
  heatRisk: string;
  pollutantRisk: string;
  dominantPollutant: string;
}) {
  const heatAmplifiers =
    equityData?.indicators.filter(
      (indicator) =>
        (indicator.label === "Poverty" ||
          indicator.label === "No vehicle access") &&
        (indicator.level === "Moderate" || indicator.level === "High")
    ) ?? [];
  const pollutionAmplifiers =
    equityData?.indicators.filter(
      (indicator) =>
        (indicator.label === "Poverty" ||
          indicator.label === "Uninsured" ||
          indicator.label === "Asthma prevalence" ||
          indicator.label === "COPD prevalence" ||
          indicator.label === "Current smoking") &&
        (indicator.level === "Moderate" || indicator.level === "High")
    ) ?? [];

  return (
    <section className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Health Equity Overlay
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Structural vulnerability can change what local risk means
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
            This layer combines current environmental signals with Census ACS
            social determinants and CDC PLACES chronic disease estimates to show
            where heat, pollution, and illness may be harder to avoid or recover
            from.
          </p>
        </div>
        {equityData && (
          <div className="rounded-lg border border-[var(--secondary)]/20 bg-[var(--secondary)]/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Equity vulnerability
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
              {equityData.equityScore}/100
            </p>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${equityBadgeClass(
                equityData.equityLevel
              )}`}
            >
              {equityData.equityLevel}
            </span>
          </div>
        )}
      </div>

      {equityError && (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {equityError}
        </p>
      )}

      {!equityData && !equityError && (
        <p className="mt-5 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--foreground-muted)]">
          Health equity data will appear here after a ZIP code search.
        </p>
      )}

      {equityData && (
        <>
          <div className="mt-5 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
              Area summary
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {equityData.summary}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--foreground-faint)]">
              Census area: {equityData.zctaName} · ZCTA {equityData.zcta}
              {equityData.tractFips
                ? ` · CDC PLACES tract ${equityData.tractFips}`
                : ""}
            </p>
          </div>

          {equityData.cdcPlaces && (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <article className="rounded-lg border border-[var(--secondary)]/20 bg-[var(--secondary)]/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                  Chronic burden
                </p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {equityData.cdcPlaces.chronicBurdenScore === null
                    ? "n/a"
                    : `${equityData.cdcPlaces.chronicBurdenScore}/100`}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]/80">
                  Composite from CDC PLACES asthma, COPD, smoking, diabetes,
                  obesity, physical health, and activity estimates.
                </p>
              </article>
              <article className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                  Respiratory baseline
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                  Asthma{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {equityData.cdcPlaces.asthma === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.asthma.toFixed(1)}%`}
                  </span>{" "}
                  · COPD{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {equityData.cdcPlaces.copd === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.copd.toFixed(1)}%`}
                  </span>{" "}
                  · Smoking{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {equityData.cdcPlaces.smoking === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.smoking.toFixed(1)}%`}
                  </span>
                </p>
              </article>
              <article className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                  Metabolic baseline
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                  Diabetes{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {equityData.cdcPlaces.diabetes === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.diabetes.toFixed(1)}%`}
                  </span>{" "}
                  · Obesity{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {equityData.cdcPlaces.obesity === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.obesity.toFixed(1)}%`}
                  </span>
                </p>
                {equityData.cdcPlaces.isPilotRegion &&
                  equityData.cdcPlaces.spatiallySmoothedDiabetes !==
                    undefined && (
                    <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]/80">
                      Neighboring-tract-adjusted:{" "}
                      {equityData.cdcPlaces.spatiallySmoothedDiabetes.toFixed(
                        1
                      )}
                      % (95% CI:{" "}
                      {equityData.cdcPlaces.spatiallySmoothedDiabetesCiLower?.toFixed(
                        1
                      )}
                      –
                      {equityData.cdcPlaces.spatiallySmoothedDiabetesCiUpper?.toFixed(
                        1
                      )}
                      %), from a Bayesian spatial model over neighboring
                      census tracts.
                    </p>
                  )}
              </article>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {equityData.indicators.map((indicator) => (
              <article
                className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4"
                key={indicator.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {indicator.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--foreground-faint)]">
                      {indicator.detail}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-semibold ${equityBadgeClass(
                      indicator.level
                    )}`}
                  >
                    {indicator.level}
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold text-[var(--foreground)]">
                  {indicator.value === null
                    ? "Unavailable"
                    : `${indicator.value.toFixed(1)}${indicator.unit}`}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {indicator.source}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg border border-[var(--rule)] bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Heat vulnerability lens
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                Current heat risk is <span className="font-semibold">{heatRisk}</span>.
                {heatAmplifiers.length > 0
                  ? ` Poverty or limited vehicle access may make cooling, transportation, or avoiding heat harder in this area.`
                  : " The loaded ACS indicators do not add a strong heat vulnerability signal."}
              </p>
            </article>
            <article className="rounded-lg border border-[var(--rule)] bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Pollution burden lens
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                Current pollutant risk is{" "}
                <span className="font-semibold">{pollutantRisk}</span>, with{" "}
                {dominantPollutant} as the main signal.
                {pollutionAmplifiers.length > 0
                  ? " Poverty, insurance access, or elevated respiratory baseline estimates may increase the community impact of respiratory exposures."
                  : " The loaded ACS indicators do not add a strong pollution vulnerability signal."}
              </p>
            </article>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Next equity layers
            </p>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-amber-900 md:grid-cols-2">
              <p>EPA EJScreen PM2.5 and environmental justice burden</p>
              <p>Tree canopy and heat island vulnerability</p>
              <p>Nearby clinics, hospitals, and transit access</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-xs leading-5 text-[var(--foreground-faint)]">
            {equityData.caveats.map((caveat) => (
              <p key={caveat}>{caveat}</p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function profileModifier(profile: UserProfile | null) {
  if (!profile) return 0;

  const exposure =
    profile.outdoor_exposure === "High"
      ? 8
      : profile.outdoor_exposure === "Moderate"
      ? 4
      : 0;
  const commute =
    profile.commute_exposure === "High"
      ? 6
      : profile.commute_exposure === "Moderate"
      ? 3
      : 0;
  const sensitivity =
    profile.respiratory_sensitivity === "High"
      ? 10
      : profile.respiratory_sensitivity === "Mild"
      ? 5
      : 0;
  const activity =
    profile.activity_level === "High"
      ? 4
      : profile.activity_level === "Moderate"
      ? 2
      : 0;

  return exposure + commute + sensitivity + activity;
}

type TwinLayer = {
  id: "environment" | "respiratory" | "profile" | "learning";
  label: string;
  value: string;
  intensity: number;
  detail: string;
};

type TwinScenario = "current" | "shift" | "reduce" | "protect";

function scenarioAdjustment(scenario: TwinScenario) {
  switch (scenario) {
    case "shift":
      return -10;
    case "reduce":
      return -14;
    case "protect":
      return -8;
    default:
      return 0;
  }
}

function scenarioLabel(scenario: TwinScenario) {
  switch (scenario) {
    case "shift":
      return "Shift outdoor time";
    case "reduce":
      return "Shorten exposure";
    case "protect":
      return "Add protection";
    default:
      return "Current routine";
  }
}

function twinLayerTone(layerId: TwinLayer["id"]): "accent" | "secondary" {
  return layerId === "respiratory" ? "accent" : "secondary";
}

function useAnimatedNumber(target: number, durationMs = 600) {
  const [displayValue, setDisplayValue] = useState(target);
  const displayValueRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayValueRef.current;
    const to = target;
    const start = performance.now();

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (to - from) * eased;
      displayValueRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, durationMs]);

  return displayValue;
}

function TwinScoreGauge({
  value,
  label,
  size = "md",
  tone,
}: {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  tone: "accent" | "secondary";
}) {
  const displayValue = useAnimatedNumber(value);
  const dimension = size === "lg" ? 148 : size === "md" ? 108 : 64;
  const strokeWidth = size === "sm" ? 6 : 8;
  const radius = dimension / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, displayValue)) / 100;
  const dashOffset = circumference * (1 - progress);
  const center = dimension / 2;
  const strokeColor = tone === "accent" ? "var(--accent)" : "var(--secondary)";

  return (
    <div
      className={`twin-gauge twin-gauge-${size}`}
      style={{ width: dimension, height: dimension }}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="img"
        aria-label={`${label ?? "Score"}: ${Math.round(displayValue)} of 100`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="twin-gauge-value">
        <strong>{Math.round(displayValue)}</strong>
        {label && size !== "sm" && <span>{label}</span>}
      </div>
    </div>
  );
}

// Kept temporarily as a fallback for the previous non-Three.js scan.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ExposureTwinPersonScan({
  rotation,
  onRotationChange,
  autoRotate,
  onAutoRotateChange,
  twinScore,
  layers,
  selectedLayerId,
  onSelectLayer,
}: {
  rotation: number;
  onRotationChange: (rotation: number) => void;
  autoRotate: boolean;
  onAutoRotateChange: (autoRotate: boolean) => void;
  twinScore: number;
  layers: TwinLayer[];
  selectedLayerId: TwinLayer["id"];
  onSelectLayer: (layerId: TwinLayer["id"]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startRotation: number;
  } | null>(null);
  const selectedLayer =
    layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const selectedIndex = Math.max(
    0,
    layers.findIndex((layer) => layer.id === selectedLayer.id)
  );
  const scanRows = [21, 38, 56, 75];
  const scanBandY = [118, 210, 334, 472][selectedIndex] ?? 210;

  const clampRotation = (value: number) => Math.max(-180, Math.min(180, value));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRotation: rotation,
    };
    setIsDragging(true);
    onAutoRotateChange(false);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = event.clientX - drag.startX;
    onRotationChange(clampRotation(drag.startRotation + delta * 0.6));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onAutoRotateChange(false);
      onRotationChange(clampRotation(rotation - 5));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onAutoRotateChange(false);
      onRotationChange(clampRotation(rotation + 5));
    }
  };

  return (
    <div className="twin-scan-shell">
      <div
        className={`twin-scan-stage ${autoRotate ? "is-breathing" : ""} ${
          isDragging ? "is-dragging cursor-grabbing" : "cursor-grab"
        } touch-none`}
        style={{ "--scan-rotation": `${rotation / 10}deg` } as CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label="Interactive medical-style exposure twin scan. Drag or use arrow keys to rotate."
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={Math.round(rotation)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div className="twin-scan-grid" aria-hidden="true" />
        <div className="twin-scan-person" aria-hidden="true">
          <svg
            viewBox="0 0 260 620"
            role="img"
            data-selected-layer={selectedLayerId}
          >
            <defs>
              <filter id="scanGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="scanSoftGlow" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="15" result="blur" />
                <feColorMatrix
                  in="blur"
                  result="blueGlow"
                  values="0 0 0 0 0.05  0 0 0 0 0.62  0 0 0 0 0.95  0 0 0 0.9 0"
                />
                <feMerge>
                  <feMergeNode in="blueGlow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="scanBody" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#E0F2FE" stopOpacity="0.95" />
                <stop offset="0.45" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="1" stopColor="#0C4A6E" stopOpacity="0.88" />
              </linearGradient>
              <radialGradient id="scanChestGlow" cx="50%" cy="33%" r="55%">
                <stop offset="0" stopColor="#F0F9FF" stopOpacity="0.95" />
                <stop offset="0.55" stopColor="#7DD3FC" stopOpacity="0.4" />
                <stop offset="1" stopColor="#0C4A6E" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="limbHighlight" cx="35%" cy="30%" r="65%">
                <stop offset="0" stopColor="#F0F9FF" stopOpacity="0.85" />
                <stop offset="0.6" stopColor="#7DD3FC" stopOpacity="0.2" />
                <stop offset="1" stopColor="#7DD3FC" stopOpacity="0" />
              </radialGradient>
              <filter
                id="scanSpecular"
                x="-60%"
                y="-60%"
                width="220%"
                height="220%"
              >
                <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
                <feSpecularLighting
                  in="blur"
                  surfaceScale="7"
                  specularConstant="0.85"
                  specularExponent="16"
                  lightingColor="#F0F9FF"
                  result="specular"
                >
                  <fePointLight x="70" y="-60" z="220" />
                </feSpecularLighting>
                <feComposite
                  in="specular"
                  in2="SourceAlpha"
                  operator="in"
                  result="specularClipped"
                />
              </filter>
            </defs>

            <g className="twin-scan-region-band" aria-hidden="true">
              <rect
                x="23"
                y={String(scanBandY - 22)}
                width="214"
                height="44"
                rx="22"
              />
              <line
                x1="16"
                x2="244"
                y1={String(scanBandY)}
                y2={String(scanBandY)}
              />
            </g>

            <g filter="url(#scanSoftGlow)">
              <path
                className="twin-scan-body-fill"
                d="M130 19
                C149 19 163 36 163 60
                C163 80 152 96 139 102
                L139 121
                C154 124 169 132 181 147
                C195 166 200 197 203 235
                C206 276 220 330 228 382
                C231 402 219 409 208 392
                C195 370 185 322 178 275
                C173 314 170 355 172 401
                C175 466 181 522 189 565
                C192 583 178 592 163 578
                C148 526 139 455 136 387
                C134 349 126 349 124 387
                C121 455 112 526 97 578
                C82 592 68 583 71 565
                C79 522 85 466 88 401
                C90 355 87 314 82 275
                C75 322 65 370 52 392
                C41 409 29 402 32 382
                C40 330 54 276 57 235
                C60 197 65 166 79 147
                C91 132 106 124 121 121
                L121 102
                C108 96 97 80 97 60
                C97 36 111 19 130 19 Z"
                fill="url(#scanBody)"
              />
              <ellipse
                cx="130"
                cy="213"
                rx="76"
                ry="145"
                fill="url(#scanChestGlow)"
                opacity="0.86"
              />
            </g>

            <g className="twin-scan-volume" aria-hidden="true">
              <ellipse cx="118" cy="52" rx="20" ry="28" fill="url(#limbHighlight)" />
              <ellipse
                cx="168"
                cy="270"
                rx="15"
                ry="95"
                fill="url(#limbHighlight)"
                transform="rotate(8 168 270)"
              />
              <ellipse
                cx="92"
                cy="270"
                rx="15"
                ry="95"
                fill="url(#limbHighlight)"
                transform="rotate(-8 92 270)"
              />
              <ellipse cx="150" cy="470" rx="16" ry="105" fill="url(#limbHighlight)" />
              <ellipse cx="110" cy="470" rx="16" ry="105" fill="url(#limbHighlight)" />
            </g>

            <path
              className="twin-scan-body-specular"
              d="M130 19
                C149 19 163 36 163 60
                C163 80 152 96 139 102
                L139 121
                C154 124 169 132 181 147
                C195 166 200 197 203 235
                C206 276 220 330 228 382
                C231 402 219 409 208 392
                C195 370 185 322 178 275
                C173 314 170 355 172 401
                C175 466 181 522 189 565
                C192 583 178 592 163 578
                C148 526 139 455 136 387
                C134 349 126 349 124 387
                C121 455 112 526 97 578
                C82 592 68 583 71 565
                C79 522 85 466 88 401
                C90 355 87 314 82 275
                C75 322 65 370 52 392
                C41 409 29 402 32 382
                C40 330 54 276 57 235
                C60 197 65 166 79 147
                C91 132 106 124 121 121
                L121 102
                C108 96 97 80 97 60
                C97 36 111 19 130 19 Z"
              fill="#0c4a6e"
              filter="url(#scanSpecular)"
            />

            <g filter="url(#scanGlow)" className="twin-scan-anatomy">
              <path d="M130 103 L130 287" />
              <path d="M104 146 C122 153 126 190 118 225 C98 219 91 181 104 146 Z" />
              <path d="M156 146 C138 153 134 190 142 225 C162 219 169 181 156 146 Z" />
              <path d="M103 244 C116 255 144 255 157 244" />
              <path d="M107 278 C118 287 142 287 153 278" />
              <path d="M130 129 C122 150 122 173 130 193 C138 173 138 150 130 129 Z" />
              <circle cx="130" cy="309" r="8" />
            </g>

            <g className="twin-scan-outline" filter="url(#scanGlow)">
              <ellipse cx="130" cy="60" rx="31" ry="41" />
              <path d="M104 96 C113 111 147 111 156 96" />
              <path d="M121 121 C101 124 86 133 75 151 C62 173 59 209 56 246 C53 292 39 340 32 382" />
              <path d="M139 121 C159 124 174 133 185 151 C198 173 201 209 204 246 C207 292 221 340 228 382" />
              <path d="M84 254 C92 310 91 360 88 406 C84 467 78 523 71 565" />
              <path d="M176 254 C168 310 169 360 172 406 C176 467 182 523 189 565" />
              <path d="M111 302 C121 316 139 316 149 302" />
              <path d="M108 304 C98 366 95 492 96 578" />
              <path d="M152 304 C162 366 165 492 164 578" />
              <path d="M73 565 C83 579 99 581 111 568" />
              <path d="M149 568 C161 581 177 579 187 565" />
            </g>

            <g className="twin-scan-hotspots" aria-hidden="true">
              <circle cx="130" cy="60" r="4" />
              <circle cx="130" cy="196" r="5" />
              <circle cx="130" cy="309" r="5" />
              <circle cx="130" cy="469" r="5" />
            </g>
          </svg>
        </div>

        <div className="twin-scan-score">
          <span>Twin score</span>
          <TwinScoreGauge
            value={twinScore}
            size="sm"
            tone={twinScore >= 34 ? "accent" : "secondary"}
          />
        </div>

        {layers.map((layer, index) => {
          const isActive = layer.id === selectedLayerId;
          const tone = twinLayerTone(layer.id);

          return (
            <button
              type="button"
              className={`twin-scan-callout twin-scan-callout-${tone} ${
                isActive ? "is-active" : ""
              }`}
              style={{ "--callout-top": `${scanRows[index] ?? 50}%` } as CSSProperties}
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              aria-pressed={isActive}
            >
              <svg
                className="twin-scan-connector"
                viewBox="0 0 64 24"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M64 12 C 40 12, 28 21, 0 21" fill="none" />
              </svg>
              <span>{layer.label}</span>
              <strong>{layer.value}</strong>
              <em>{layer.detail}</em>
            </button>
          );
        })}

        <div className="twin-scanline" aria-hidden="true" />
      </div>

      <div className="twin-layer-controls">
        {layers.map((layer) => (
          <button
            type="button"
            className={`twin-layer-button ${
              selectedLayerId === layer.id ? "is-active" : ""
            }`}
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
          >
            <span>{layer.label}</span>
            <strong>{layer.value}</strong>
            <i aria-hidden="true">
              <b style={{ width: `${layer.intensity}%` }} />
            </i>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExposureTwinPanel({
  user,
  zipCode,
  city,
  state,
  baseScore,
  healthRisk,
  respiratoryRisk,
  profile,
  forecastData,
  topDrivers,
  dataConfidence,
  symptomPrediction,
  checkinStreak,
  symptomEnvironmentCorrelation,
  personalRiskCalibration,
  onOpenCheckin,
  onOpenForecast,
}: {
  user: User | null;
  zipCode: string;
  city: string;
  state: string;
  baseScore: number;
  healthRisk: string;
  respiratoryRisk: string;
  profile: UserProfile | null;
  forecastData: HealthForecastData | null;
  topDrivers: RiskModelItem[];
  dataConfidence: RiskModelConfidence;
  symptomPrediction: SymptomPrediction;
  checkinStreak: CheckinStreak;
  symptomEnvironmentCorrelation: SymptomEnvironmentCorrelation;
  personalRiskCalibration: PersonalRiskCalibration | null;
  onOpenCheckin: () => void;
  onOpenForecast?: () => void;
}) {
  const [selectedLayerId, setSelectedLayerId] =
    useState<TwinLayer["id"]>("environment");
  const [scenario, setScenario] = useState<TwinScenario>("current");
  const modifier = profileModifier(profile);
  const peakForecastScore = forecastData?.peakScore ?? baseScore;
  const twinScore = clampScore(
    baseScore * 0.68 + peakForecastScore * 0.22 + modifier
  );
  const projectedTwinScore = clampScore(
    twinScore + scenarioAdjustment(scenario)
  );
  const projectedChange = twinScore - projectedTwinScore;
  const bestWindow =
    forecastData?.bestWindow?.displayTime ?? "a lower-risk morning window";
  const worstWindow =
    forecastData?.worstWindow?.displayTime ?? "the highest forecast window";
  const mainDriver = topDrivers[0];
  const forecastLoaded = Boolean(forecastData);
  const profileLoaded = Boolean(profile);
  const twinLayers: TwinLayer[] = [
    {
      id: "environment",
      label: "Environment",
      value: `${baseScore}/100`,
      intensity: baseScore,
      detail:
        "Current local signals such as air quality, heat, UV, alerts, and public-health context.",
    },
    {
      id: "respiratory",
      label: "Respiratory",
      value: respiratoryRisk,
      intensity:
        respiratoryRisk === "High"
          ? 82
          : respiratoryRisk === "Moderate"
          ? 52
          : respiratoryRisk === "Low"
          ? 24
          : 34,
      detail:
        "Respiratory layer from flu activity, COVID wastewater signal, air quality, and pollutant context.",
    },
    {
      id: "profile",
      label: "Profile",
      value: profileLoaded ? `+${modifier}` : "Not set",
      intensity: profileLoaded ? clampScore(modifier * 5) : 18,
      detail: profileLoaded
        ? "Personal context from outdoor time, traffic exposure, activity level, and breathing sensitivity."
        : "Create a profile to let the Twin adjust to your routine and sensitivity.",
    },
    {
      id: "learning",
      label: "Learning",
      value: `${checkinStreak.currentStreak}d`,
      intensity: Math.min(100, checkinStreak.currentStreak * 14),
      detail:
        "Check-ins become outcome labels that can improve future symptom-risk models.",
    },
  ];
  const selectedLayer =
    twinLayers.find((layer) => layer.id === selectedLayerId) ??
    twinLayers[0];
  const peakUvIndex =
    forecastData?.hours.reduce((max, hour) => {
      if (hour.uvIndex === null) return max;
      return Math.max(max, hour.uvIndex);
    }, 0) ?? 0;
  const peakFeelsLike =
    forecastData?.hours.reduce((max, hour) => {
      if (hour.apparentTemperature === null) return max;
      return Math.max(max, hour.apparentTemperature);
    }, 0) ?? 0;
  const twin3dNodes: TwinNode3D[] = [
    {
      id: "uv",
      label: "UV / Skin",
      value: clampScore(Math.max(peakUvIndex * 10, 24)),
      tone: peakUvIndex >= 6 ? "warn" : "info",
      pos: [0, 1.65, 0.18],
      info:
        "Estimated from the highest UV forecast for the next 24 hours. Higher values mean more skin and eye exposure risk outdoors.",
    },
    {
      id: "resp",
      label: "Respiratory",
      value: twinLayers[1]?.intensity ?? 34,
      tone:
        respiratoryRisk === "High"
          ? "warn"
          : respiratoryRisk === "Moderate"
          ? "info"
          : "ok",
      pos: [0.05, 1.1, 0.25],
      info:
        "Built from respiratory risk, flu and COVID wastewater context, and air-quality conditions that may affect breathing.",
    },
    {
      id: "cardio",
      label: "Cardio / Heat",
      value: clampScore(peakFeelsLike > 0 ? (peakFeelsLike - 60) * 2 : baseScore),
      tone: peakFeelsLike >= 90 || baseScore >= 67 ? "warn" : "info",
      pos: [-0.12, 0.95, 0.25],
      info:
        "Uses feels-like temperature and the baseline local score to represent heat stress and exertion burden.",
    },
    {
      id: "immune",
      label: "Immune Load",
      value: clampScore(baseScore * 0.5 + twinLayers[1].intensity * 0.5),
      tone: respiratoryRisk === "Low" ? "ok" : "warn",
      pos: [0.1, 0.65, 0.25],
      info:
        "A combined illness-context marker that rises when respiratory and environmental signals stack together.",
    },
    {
      id: "learning",
      label: "Learning Loop",
      value: twinLayers[3]?.intensity ?? 0,
      tone: checkinStreak.currentStreak > 0 ? "ok" : "info",
      pos: [0, 0.35, 0.25],
      info:
        "Reflects symptom check-in streaks. More check-ins create better outcome labels for future model training.",
    },
  ];
  const inputCards = [
    {
      label: "Local baseline",
      value: `${baseScore}/100`,
      detail: `${healthRisk} overall risk in ZIP ${zipCode}`,
    },
    {
      label: "Forecast peak",
      value: forecastLoaded ? `${peakForecastScore}/100` : "Pending",
      detail: forecastLoaded
        ? `Highest window: ${worstWindow}`
        : "Hourly forecast did not load for this search.",
    },
    {
      label: "Profile lift",
      value: profileLoaded ? `+${modifier}` : "None",
      detail: profileLoaded
        ? `${profile?.respiratory_sensitivity} breathing sensitivity, ${profile?.outdoor_exposure} outdoor exposure`
        : "You're seeing the ZIP-level estimate. Sign in and check in daily to unlock your personal score.",
    },
  ];
  const recommendedAction = forecastLoaded
    ? `If your schedule is flexible, move outdoor activity toward ${bestWindow} and avoid stacking heavy activity during ${worstWindow}.`
    : "Add forecast data by retrying the search, then compare your best and worst exposure windows.";
  const scenarioDetail =
    scenario === "shift"
      ? `Moves flexible outdoor time toward ${bestWindow}.`
      : scenario === "reduce"
      ? "Models a shorter high-exposure block or fewer outdoor errands."
      : scenario === "protect"
      ? "Models added protection such as indoor breaks, filtered air, or lower exertion."
      : "Uses the current profile, location, and forecast without behavior changes.";
  const streakProgress = Math.min(
    100,
    Math.round(
      (checkinStreak.currentStreak /
        Math.max(checkinStreak.nextMilestone, 1)) *
        100
    )
  );
  const streakPrompt = !user
    ? "Sign in to start a Twin streak and make the simulation learn from your routine."
    : checkinStreak.checkedInToday
    ? "Today's check-in is done. Come back tomorrow to keep the Twin learning."
    : "Log how today felt to keep your streak alive and improve the Twin over time.";

  return (
    <section className="grid gap-5">
      <article className="grid gap-5 rounded-[1.75rem] border border-[var(--border)] bg-white p-6 shadow-[0_18px_55px_-38px_rgba(19,41,75,0.5)] lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="eyebrow-text">Exposure Twin</p>
          <h2 className="display-heading mt-2 max-w-3xl text-3xl leading-tight text-[var(--foreground)] sm:text-5xl">
            Your local exposure, simplified.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
            The Twin combines ZIP {zipCode} in {city}, {state}, forecast
            conditions, respiratory context, profile factors, and check-ins
            into one personal exposure estimate.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--primary-ink)]">
            <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1">
              {dataConfidence.availableCount}/{dataConfidence.totalCount} data
              groups loaded
            </span>
            {mainDriver && (
              <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1">
                Main driver: {mainDriver.label}
              </span>
            )}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {inputCards.map((card) => (
              <div className="exposure-twin-input-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="exposure-twin-score">
          <span className="exposure-twin-score-label">Twin score</span>
          <TwinScoreGauge
            value={projectedTwinScore}
            size="lg"
            tone={projectedTwinScore >= 34 ? "accent" : "secondary"}
          />
          <p className="exposure-twin-score-detail">
            {exposureLabel(projectedTwinScore)} projected exposure
          </p>
        </div>
      </article>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
          <p className="eyebrow-text">Inspect layers</p>
          <h3 className="display-heading mt-2 text-3xl leading-tight text-[var(--foreground)]">
            Click a layer to see what it means.
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
            This is not a clinical body model. It is a visual way to show which
            local signals are contributing to the exposure estimate.
          </p>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/45 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--foreground-muted)]">
              Selected layer
            </p>
            <h4 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              {selectedLayer.label}: {selectedLayer.value}
            </h4>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {selectedLayer.detail}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {twinLayers.map((layer) => (
              <button
                type="button"
                key={layer.id}
                onClick={() => setSelectedLayerId(layer.id)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  selectedLayerId === layer.id
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--primary-ink)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {layer.label}
                </span>
                <strong className="mt-1 block text-lg">{layer.value}</strong>
              </button>
            ))}
          </div>
        </article>

        <Twin3D
          className="min-h-[32rem]"
          nodes={twin3dNodes}
          scanLabel={`SCAN · ${projectedTwinScore} / 100`}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow-text">Try a change</p>
              <h3 className="display-heading mt-2 text-3xl text-[var(--foreground)]">
                What lowers today&apos;s score?
              </h3>
            </div>
            {onOpenForecast && (
              <button
                type="button"
                onClick={onOpenForecast}
                className="w-fit rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]"
              >
                View forecast
              </button>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(["current", "shift", "reduce", "protect"] as TwinScenario[]).map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setScenario(item)}
                  className={`twin-scenario-button ${
                    scenario === item ? "is-active" : ""
                  }`}
                >
                  {scenarioLabel(item)}
                </button>
              )
            )}
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/45 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <TwinScoreGauge
                value={projectedTwinScore}
                size="md"
                tone={projectedTwinScore >= 34 ? "accent" : "secondary"}
              />
              <div>
                <p className="text-sm font-semibold text-[var(--primary-ink)]">
                  {projectedChange > 0
                    ? `${projectedChange} point reduction`
                    : "Current routine"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  {scenarioDetail}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
            {recommendedAction}
          </p>
        </article>

        <div className="grid gap-5">
          <SymptomProbabilityPanel compact prediction={symptomPrediction} />
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
            <p className="eyebrow-text">Keep it learning</p>
            <h3 className="display-heading mt-2 text-3xl text-[var(--foreground)]">
              {checkinStreak.currentStreak} day
              {checkinStreak.currentStreak === 1 ? "" : "s"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
              {streakPrompt}
            </p>
            <div className="mt-5">
              <div className="exposure-twin-streak-track">
                <span style={{ width: `${streakProgress}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                <span>Current</span>
                <span>Best: {checkinStreak.bestStreak} days</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenCheckin}
              className="exposure-twin-streak-button mt-5"
            >
              {checkinStreak.checkedInToday
                ? "Review today's check-in"
                : "Log today's check-in"}
            </button>
          </article>
        </div>
      </section>

      <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
        <p className="eyebrow-text">Your personal pattern</p>
        <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
          Environment-symptom correlation
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
          {symptomEnvironmentCorrelation.status === "ready"
            ? symptomEnvironmentCorrelation.summary
            : `${symptomEnvironmentCorrelation.summary} You're at ${symptomEnvironmentCorrelation.totalCheckins}/${symptomEnvironmentCorrelation.minRequired}.`}
        </p>
        {symptomEnvironmentCorrelation.status === "ready" && (
          <ul className="mt-4 grid gap-2 text-xs leading-5 text-[var(--foreground-faint)]">
            {symptomEnvironmentCorrelation.caveats.map((caveat) => (
              <li key={caveat}>· {caveat}</li>
            ))}
          </ul>
        )}
        {personalRiskCalibration && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="eyebrow-text">Personal calibration</p>
            {personalRiskCalibration.status === "ready" ? (
              <>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  We&apos;re weighting your own check-in history at{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {personalRiskCalibration.trustWeightPct}%
                  </span>{" "}
                  versus the general population baseline for{" "}
                  {personalRiskCalibration.factorLabel}
                  {personalRiskCalibration.populationSource ===
                  "neutral_fallback"
                    ? " (not enough pooled data across all users yet, so this starts from a neutral baseline and leans on your own evidence almost immediately)"
                    : ` (based on ${personalRiskCalibration.populationN} pooled check-ins across all users)`}
                  .
                </p>
                <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--foreground-faint)]">
                  <li>
                    · This percentage is how much the estimate leans on your
                    own data versus the population -- not a confidence or
                    accuracy score.
                  </li>
                  <li>
                    · {personalRiskCalibration.factorLabel} was picked as the
                    strongest of several factors tested, which can overstate
                    its true strength.
                  </li>
                  <li>
                    · The population baseline is a simple pooled average
                    across all users, not a personalized model for people
                    like you specifically.
                  </li>
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                {personalRiskCalibration.factorLabel} hasn&apos;t varied enough
                across your check-ins yet to calibrate a personal estimate --
                keep checking in on days when it changes.
              </p>
            )}
          </div>
        )}
      </article>

      <p className="rounded-2xl border border-[var(--border)] bg-white p-4 text-xs leading-5 text-[var(--foreground-muted)]">
        Informational only. The Twin estimates self-reported exposure context,
        not diagnosis or treatment.
      </p>
    </section>
  );
}

export function ForecastPanel({
  forecastData,
  forecastError,
  city,
  state,
}: {
  forecastData: HealthForecastData | null;
  forecastError: string;
  city: string;
  state: string;
}) {
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const selectedHour = forecastData?.hours[selectedHourIndex] ?? null;
  const selectedExplanation = selectedHour
    ? buildForecastHourExplanation(selectedHour)
    : null;
  const leadingDrivers =
    selectedHour?.drivers.length
      ? selectedHour.drivers
      : forecastData?.worstWindow?.drivers ?? [];
  const normalizedSelectedIndex =
    forecastData && selectedHourIndex >= forecastData.hours.length
      ? 0
      : selectedHourIndex;
  const displayHours = forecastData?.hours.slice(0, 24) ?? [];

  return (
    <section className="grid gap-5">
      <article className="min-w-0 rounded-[1.75rem] border border-[var(--border)] bg-white p-6 shadow-[0_18px_55px_-38px_rgba(19,41,75,0.5)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Health Risk Forecast
            </p>
            <h2 className="mt-3 font-heading text-4xl font-semibold leading-[1.03] tracking-tight text-[var(--primary-ink)] sm:text-5xl">
              Pick the best time to be outside.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
              A simple 24-hour risk pulse for {city}, {state}. Click any hour
              to see why the score changes.
            </p>
          </div>
          {forecastData && (
            <RiskBadge value={exposureLabel(forecastData.averageScore)} />
          )}
        </div>

        {forecastError && (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {forecastError}
          </p>
        )}

        {!forecastData && !forecastError && (
          <p className="mt-5 rounded-2xl border border-[var(--border)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted-foreground)]">
            Forecast data will appear here after a ZIP code search.
          </p>
        )}

        {forecastData && (
          <>
            <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
              <ForecastInsightCard
                label="Average"
                value={`${forecastData.averageScore}/100`}
                detail="Expected risk across the next 24 hours"
                tone={exposureLabel(forecastData.averageScore)}
              />
              <ForecastInsightCard
                label="Best window"
                value={forecastData.bestWindow?.displayTime ?? "Unavailable"}
                detail={
                  forecastData.bestWindow
                    ? `Risk ${forecastData.bestWindow.score}/100`
                    : "Not enough hourly data"
                }
                tone={forecastData.bestWindow?.risk ?? "Low"}
              />
              <ForecastInsightCard
                label="Peak"
                value={`${forecastData.peakScore}/100`}
                detail={forecastData.worstWindow?.displayTime ?? "Unavailable"}
                tone={exposureLabel(forecastData.peakScore)}
              />
            </div>

            <div className="-mx-2 mt-8 overflow-x-auto px-2 pb-2">
              <div className="grid min-w-[48rem] gap-2 [grid-template-columns:repeat(24,minmax(0,1fr))] xl:min-w-0">
                {displayHours.map((hour, index) => {
                  const isSelected = index === normalizedSelectedIndex;

                  return (
                    <button
                      aria-label={`Inspect ${hour.displayTime}`}
                      className={`group relative flex min-h-36 flex-col justify-end gap-2 rounded-xl border p-1.5 text-left outline-none transition ${
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--primary-soft)]/45 focus:border-[var(--primary)]"
                      }`}
                      key={hour.time}
                      onClick={() => setSelectedHourIndex(index)}
                      type="button"
                    >
                      <div className="flex h-24 items-end rounded-lg bg-slate-100 p-1">
                        <div
                          className={`w-full rounded-md ${
                            hour.score >= 67
                              ? "bg-rose-500"
                              : hour.score >= 34
                              ? "bg-amber-400"
                              : "bg-[var(--secondary)]"
                          }`}
                          style={{ height: `${Math.max(8, hour.score)}%` }}
                        />
                      </div>
                      <p className="truncate text-[10px] leading-4 text-[var(--foreground-faint)]">
                        {hour.displayTime.replace(/^[A-Za-z]+,?\s?/, "")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </article>

      {forecastData && (
        <article className="grid gap-5 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)] lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Selected hour
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h3 className="font-heading text-3xl font-semibold text-[var(--primary-ink)]">
                {selectedHour?.displayTime ?? "Unavailable"}
              </h3>
              <RiskBadge value={selectedHour?.risk ?? "Unknown"} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              {selectedExplanation?.drivers ??
                "Choose an hour to inspect the active drivers."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <ForecastMetric label="Risk" value={selectedHour ? `${selectedHour.score}/100` : "n/a"} />
              <ForecastMetric label="AQI" value={selectedHour?.usAqi?.toString() ?? "n/a"} />
              <ForecastMetric label="Feels like" value={selectedHour?.apparentTemperature == null ? "n/a" : `${selectedHour.apparentTemperature.toFixed(0)}°F`} />
              <ForecastMetric label="Pollen" value={selectedHour?.pollenRisk ?? "Unknown"} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Why this hour scores this way
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--primary-ink)]">
              {selectedExplanation?.metrics ??
                "Select an hour to inspect the underlying environmental values."}
            </p>
            <div className="mt-4 grid gap-2">
              {(leadingDrivers.length > 0
                ? leadingDrivers.slice(0, 3)
                : ["No major elevated driver detected for the selected hour."]
              ).map((driver) => (
                <div
                  className="flex items-start gap-3 rounded-xl bg-white px-3 py-2"
                  key={driver}
                >
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--primary)]" />
                  <p className="text-sm leading-6 text-[var(--primary-ink)]">
                    {driver}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      )}

      {forecastData && (
        <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-26px_rgba(19,41,75,0.45)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Statistical read
              </p>
              <h3 className="mt-2 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
                How stable is this forecast?
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                The app computes a distribution of the next 24 hourly risk
                scores, then summarizes spread, peak intensity, data
                completeness, and which raw signals move most with the score.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/45 px-4 py-3 text-sm text-[var(--primary-ink)]">
              <span className="font-semibold">
                {forecastData.statistics.signalCompleteness}%
              </span>{" "}
              hourly signal completeness
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ForecastMetric
              label="Mean / median"
              value={`${forecastData.statistics.mean} / ${forecastData.statistics.median}`}
            />
            <ForecastMetric
              label="Std. deviation"
              value={`${forecastData.statistics.standardDeviation} points`}
            />
            <ForecastMetric
              label="Typical band"
              value={`${forecastData.statistics.variabilityBand.low}-${forecastData.statistics.variabilityBand.high}`}
            />
            <ForecastMetric
              label="Peak z-score"
              value={
                forecastData.statistics.peakZScore === null
                  ? "Stable"
                  : `${forecastData.statistics.peakZScore} SD`
              }
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Distribution
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--primary-ink)]">
                Scores range from {forecastData.statistics.scoreRange.min} to{" "}
                {forecastData.statistics.scoreRange.max}.{" "}
                {forecastData.statistics.highRiskHours} high-risk hour(s) and{" "}
                {forecastData.statistics.moderateRiskHours} moderate-risk
                hour(s) appear in the next day.
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                Coefficient of variation:{" "}
                {forecastData.statistics.coefficientOfVariation === null
                  ? "n/a"
                  : `${forecastData.statistics.coefficientOfVariation}%`}
                . Lower values mean the forecast is steadier; higher values
                mean time-of-day choice matters more.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Signal correlations
              </p>
              <div className="mt-3 grid gap-2">
                {forecastData.statistics.driverCorrelations
                  .slice()
                  .sort(
                    (left, right) =>
                      Math.abs(right.coefficient ?? 0) -
                      Math.abs(left.coefficient ?? 0)
                  )
                  .slice(0, 4)
                  .map((driver) => (
                    <div
                      className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center"
                      key={driver.label}
                    >
                      <p className="text-sm font-semibold text-[var(--primary-ink)]">
                        {driver.label}
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--primary-soft)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.abs(driver.coefficient ?? 0) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                        {formatCorrelation(driver.coefficient)}
                      </p>
                    </div>
                  ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
                Correlations are descriptive within the 24-hour forecast window;
                they show co-movement, not causation.
              </p>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

function formatCorrelation(coefficient: number | null) {
  if (coefficient === null) return "n/a";
  if (Math.abs(coefficient) < 0.15) return `${coefficient.toFixed(2)} weak`;
  return `${coefficient.toFixed(2)} ${coefficient > 0 ? "positive" : "negative"}`;
}

function ForecastInsightCard({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${forecastToneDot(tone)}`} />
      </div>
      <p className="font-stat mt-3 text-xl font-bold leading-tight text-[var(--primary-ink)]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </article>
  );
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 font-semibold text-[var(--primary-ink)]">{value}</p>
    </div>
  );
}

function forecastToneDot(tone: string) {
  const lower = tone.toLowerCase();
  if (lower.includes("high")) return "bg-rose-500";
  if (lower.includes("moderate") || lower.includes("fair")) return "bg-amber-400";
  return "bg-[var(--success)]";
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function formatDuration(hours: number) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }

  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hr`;
}

function exposureLabel(score: number) {
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

function exposureClass(score: number) {
  if (score >= 67) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (score >= 34) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-[var(--secondary)]/40 bg-[var(--secondary)]/15 text-[var(--secondary)]";
}

function ExposureTimelinePanel({
  zipCode,
  city,
  state,
  baseScore,
  healthRisk,
  respiratoryRisk,
  airQuality,
  heatRisk,
  uvRisk,
  profile,
}: {
  zipCode: string;
  city: string;
  state: string;
  baseScore: number;
  healthRisk: string;
  respiratoryRisk: string;
  airQuality: string;
  heatRisk: string;
  uvRisk: string;
  profile: UserProfile | null;
}) {
  const defaultSnapshot: TimelineLocationSnapshot = {
    zipCode,
    city,
    state,
    baseScore,
    healthRisk,
    respiratoryRisk,
    airQuality,
    heatRisk,
    uvRisk,
  };
  const [blocks, setBlocks] = useState<TimelineBlock[]>([
    {
      id: "morning",
      label: "Morning routine",
      zipCode,
      start: "07:00",
      end: "09:00",
      setting: "Indoors",
      intensity: "Light",
    },
    {
      id: "workday",
      label: "Work or school",
      zipCode,
      start: "09:00",
      end: "17:00",
      setting: "Indoors",
      intensity: "Light",
    },
    {
      id: "exercise",
      label: "Outdoor activity",
      zipCode,
      start: "17:00",
      end: "18:00",
      setting: "Outdoors",
      intensity: "Moderate",
    },
    {
      id: "evening",
      label: "Evening",
      zipCode,
      start: "18:00",
      end: "22:00",
      setting: "Indoors",
      intensity: "Resting",
    },
  ]);
  const [blockSnapshots, setBlockSnapshots] = useState<
    Record<string, TimelineLocationSnapshot>
  >({});
  const [loadingBlockId, setLoadingBlockId] = useState("");
  const [timelineError, setTimelineError] = useState("");

  const settingFactors: Record<TimelineSetting, number> = {
    Indoors: 0.55,
    Outdoors: 1.25,
  };
  const intensityFactors: Record<TimelineIntensity, number> = {
    Resting: 0.7,
    Light: 0.9,
    Moderate: 1.2,
    Intense: 1.5,
  };
  const timeline = blocks.map((block) => {
    const snapshot = blockSnapshots[block.id] ?? defaultSnapshot;
    const startMinutes = timeToMinutes(block.start);
    const endMinutes = timeToMinutes(block.end);
    const durationHours = Math.max(0.25, (endMinutes - startMinutes) / 60);
    const exposureScore = Math.min(
      100,
      Math.round(
        snapshot.baseScore *
          settingFactors[block.setting] *
          intensityFactors[block.intensity]
      )
    );
    const contribution = Math.round(exposureScore * durationHours);

    return {
      ...block,
      durationHours,
      exposureScore,
      contribution,
      snapshot,
      exposureLevel: exposureLabel(exposureScore),
    };
  });
  const totalHours = timeline.reduce(
    (total, block) => total + block.durationHours,
    0
  );
  const dailyScore =
    totalHours > 0
      ? Math.min(
          100,
          Math.round(
            timeline.reduce(
              (total, block) => total + block.contribution,
              0
            ) / totalHours
          )
        )
      : 0;
  const highestBlock = [...timeline].sort(
    (a, b) => b.exposureScore - a.exposureScore
  )[0];
  const safestOutdoorBlock = timeline
    .filter((block) => block.setting === "Outdoors")
    .sort((a, b) => a.exposureScore - b.exposureScore)[0];

  const updateBlock = (
    id: string,
    field: keyof TimelineBlock,
    value: string
  ) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, [field]: value } : block
      )
    );
  };

  const addBlock = () => {
    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "New block",
        zipCode,
        start: "12:00",
        end: "13:00",
        setting: "Outdoors",
        intensity: "Light",
      },
    ]);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) =>
      current.length > 1
        ? current.filter((block) => block.id !== id)
        : current
    );
    setBlockSnapshots((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const loadBlockZip = async (block: TimelineBlock) => {
    const trimmedZip = block.zipCode.trim();

    if (!trimmedZip) {
      setTimelineError("Enter a ZIP code for that timeline block first.");
      return;
    }

    setLoadingBlockId(block.id);
    setTimelineError("");

    try {
      const location = await getLocation(trimmedZip);
      const fluData = await getFluData(location.state);
      const covidActivityData = await getCovidData(location.state);
      const [airData, environment, alerts] = await Promise.all([
        getAirQuality(location.latitude, location.longitude),
        getEnvironmentData(location.latitude, location.longitude),
        getWeatherAlerts(location.latitude, location.longitude),
      ]);
      const nextAqi = airData.list?.[0]?.main.aqi ?? null;
      const nextAirQuality = getAirQualityLabel(nextAqi);
      const nextHeatRisk = getHeatRiskLabel(
        environment.apparentTemperatureMax ??
          environment.apparentTemperature ??
          null
      );
      const nextUvRisk = getUvRiskLabel(environment.uvIndexMax ?? null);
      const nextAlertRisk = summarizeAlertRisk(alerts);
      const nextPollutantRisk = getPollutantRiskLabel(
        airData.list?.[0]?.components
      );
      const nextRiskModel = evaluateRiskModel({
        aqi: nextAqi,
        airQualityLabel: nextAirQuality,
        pollutantRisk: nextPollutantRisk,
        heatRisk: nextHeatRisk,
        uvRisk: nextUvRisk,
        alertRisk: nextAlertRisk,
        fluActivity: fluData,
        covidActivity: covidActivityData.activity,
        covidCoverage: covidActivityData.coverage,
        dataStatus: {
          airQuality: airData.list?.[0]?.main.aqi !== undefined,
          pollutants: Boolean(airData.list?.[0]?.components),
          heatUv: true,
          weatherAlerts: true,
          flu: true,
          covid: true,
          news: false,
        },
        profile,
      });

      setBlockSnapshots((current) => ({
        ...current,
        [block.id]: {
          zipCode: trimmedZip,
          city: location.city,
          state: location.state,
          baseScore: nextRiskModel.scoreBreakdown.score,
          healthRisk: nextRiskModel.healthRisk,
          respiratoryRisk: nextRiskModel.respiratoryRisk,
          airQuality: nextAirQuality,
          heatRisk: nextHeatRisk,
          uvRisk: nextUvRisk,
        },
      }));
    } catch (error) {
      setTimelineError(
        error instanceof Error
          ? error.message
          : "Unable to load that timeline ZIP code."
      );
    } finally {
      setLoadingBlockId("");
    }
  };

  return (
    <section className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Exposure Timeline
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Estimate how today&apos;s routine changes exposure
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
            Each block can use the current {city}, {state} snapshot or a
            different ZIP code, then adjusts exposure by time, indoor/outdoor
            setting, and activity intensity.
          </p>
        </div>
          <div className="rounded-lg border border-[var(--secondary)]/20 bg-[var(--secondary)]/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Estimated day score
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {dailyScore}/100
          </p>
          <RiskBadge value={exposureLabel(dailyScore)} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Local signals used
          </p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--foreground)]">
            <p>Base risk index: {baseScore}/100</p>
            <p>Default ZIP: {zipCode}</p>
            <p>Overall risk: {healthRisk}</p>
            <p>Respiratory risk: {respiratoryRisk}</p>
            <p>Air quality: {airQuality}</p>
            <p>Heat: {heatRisk}</p>
            <p>UV: {uvRisk}</p>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Highest exposure block
          </p>
          <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
            {highestBlock?.label ?? "Unavailable"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
            {highestBlock
              ? `${highestBlock.start}-${highestBlock.end}, ${highestBlock.snapshot.city}, ${highestBlock.snapshot.state}, ${highestBlock.setting.toLowerCase()}, ${highestBlock.intensity.toLowerCase()} intensity.`
              : "Add a timeline block to estimate exposure."}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Outdoor suggestion
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
            {safestOutdoorBlock
              ? `${safestOutdoorBlock.label} in ${safestOutdoorBlock.snapshot.city}, ${safestOutdoorBlock.snapshot.state} is currently the lowest outdoor exposure block in this schedule.`
              : "Add an outdoor block to compare outdoor exposure windows."}
          </p>
        </div>
      </div>

      {timelineError && (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {timelineError}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {timeline.map((block) => (
          <article
            className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4"
            key={block.id}
          >
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Activity
                <input
                  value={block.label}
                  onChange={(event) =>
                    updateBlock(block.id, "label", event.target.value)
                  }
                  className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                ZIP
                <input
                  inputMode="numeric"
                  value={block.zipCode}
                  onChange={(event) =>
                    updateBlock(block.id, "zipCode", event.target.value)
                  }
                  className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Start
                <input
                  type="time"
                  value={block.start}
                  onChange={(event) =>
                    updateBlock(block.id, "start", event.target.value)
                  }
                  className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                End
                <input
                  type="time"
                  value={block.end}
                  onChange={(event) =>
                    updateBlock(block.id, "end", event.target.value)
                  }
                  className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Setting
                <select
                  value={block.setting}
                  onChange={(event) =>
                    updateBlock(
                      block.id,
                      "setting",
                      event.target.value as TimelineSetting
                    )
                  }
                  className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                >
                  <option>Indoors</option>
                  <option>Outdoors</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Intensity
                <select
                  value={block.intensity}
                  onChange={(event) =>
                    updateBlock(
                      block.id,
                      "intensity",
                      event.target.value as TimelineIntensity
                    )
                  }
                  className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                >
                  <option>Resting</option>
                  <option>Light</option>
                  <option>Moderate</option>
                  <option>Intense</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => loadBlockZip(block)}
                disabled={loadingBlockId === block.id}
                className="bespoke-button h-11 px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {loadingBlockId === block.id ? "Loading" : "Load ZIP"}
              </button>
              <button
                type="button"
                onClick={() => removeBlock(block.id)}
                className="h-11 rounded-lg border border-[var(--rule)] px-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-rose-300/50 hover:bg-rose-500/10"
              >
                Remove
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-lg border border-[var(--rule)] bg-black/10 p-3 text-xs leading-5 text-[var(--foreground-muted)] md:grid-cols-3">
              <p>
                Location: {block.snapshot.city}, {block.snapshot.state} · ZIP{" "}
                {block.snapshot.zipCode}
              </p>
              <p>Location risk index: {block.snapshot.baseScore}/100</p>
              <p>
                Air {block.snapshot.airQuality} · Heat{" "}
                {block.snapshot.heatRisk} · UV {block.snapshot.uvRisk}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${block.exposureScore}%` }}
                />
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${exposureClass(
                  block.exposureScore
                )}`}
              >
                {block.label}: {block.exposureLevel} ·{" "}
                {block.exposureScore}/100 ·{" "}
                {formatDuration(block.durationHours)}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={addBlock}
          className="bespoke-button h-12 px-5 text-sm font-semibold transition"
        >
          Add timeline block
        </button>
        <p className="text-xs leading-5 text-[var(--foreground-faint)]">
          This is an estimated exposure planning tool, not a clinical risk
          assessment.
        </p>
      </div>
    </section>
  );
}

function AiHealthPlanPanel({
  planContext,
}: {
  planContext: HealthPlanContext;
}) {
  const [plan, setPlan] = useState<HealthPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const generatePlan = async () => {
    setLoadingPlan(true);
    setPlanError("");

    try {
      const response = await fetch("/api/health-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planContext),
      });
      const data = (await response.json()) as {
        plan?: HealthPlan;
        error?: string;
      };

      if (!response.ok || !data.plan) {
        throw new Error(
          data.error ?? "The AI health plan could not be generated."
        );
      }

      setPlan(data.plan);
    } catch (error) {
      setPlanError(
        error instanceof Error
          ? error.message
          : "The AI health plan could not be generated."
      );
    } finally {
      setLoadingPlan(false);
    }
  };

  return (
    <section className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            AI Health Plan
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Turn this dashboard into a daily action plan
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
            This uses the current ZIP code, risk model drivers, public health
            signals, local news, and your saved profile context when available.
          </p>
        </div>
        <button
          type="button"
          onClick={generatePlan}
          disabled={loadingPlan}
          className="bespoke-button h-12 px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {loadingPlan ? "Generating" : plan ? "Refresh plan" : "Generate plan"}
        </button>
      </div>

      {planError && (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {planError}
        </p>
      )}

      {!plan && !planError && (
        <div className="mt-5 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
          <p className="text-sm leading-6 text-[var(--foreground-muted)]">
            Generate a plan when you want the AI to synthesize the current
            dashboard into plain-English next steps. This may use a small amount
            of your OpenAI API credits.
          </p>
        </div>
      )}

      {plan && (
        <div className="mt-5 grid gap-4">
          <article className="rounded-lg border border-[var(--secondary)]/20 bg-[var(--secondary)]/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              {plan.headline}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {plan.summary}
            </p>
          </article>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Today&apos;s priority
              </p>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                {plan.priority}
              </p>
            </article>

            <article className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Watch list
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--foreground)]">
                {plan.watch.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>

          <article className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
              Suggested actions
            </p>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {plan.actions.map((item) => (
                <li
                  className="rounded-lg border border-[var(--rule)] bg-black/10 p-3 text-sm leading-6 text-[var(--foreground)]"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {plan.uncertainty} This is informational only and is not medical
            advice.
          </p>
        </div>
      )}
    </section>
  );
}

function panelAdviceForContributor(label: string) {
  if (label === "Respiratory") {
    return "Check air quality and illness activity before intense outdoor plans, especially if you are sensitive to breathing symptoms.";
  }
  if (label === "Infectious disease") {
    return "Treat this as a community-level signal. If activity is elevated, be more thoughtful about crowded indoor settings and recent symptoms.";
  }
  if (label === "Outdoor environment") {
    return "Move harder outdoor activity into lower-risk windows and consider heat, UV, pollen, and air quality together.";
  }
  if (label === "Personal modifier") {
    return "Keep your profile and symptom check-ins updated so the model can better reflect your own routine.";
  }
  return "Review the methodology and data source panels to see why this factor is included.";
}

export function SymptomCheckinPanel({
  user,
  zipCode,
  latestSnapshot,
  snapshotStatus,
  checkinStreak,
  onCheckinSaved,
}: {
  user: User | null;
  zipCode: string;
  latestSnapshot: SavedHealthSnapshot | null;
  snapshotStatus: string;
  checkinStreak: CheckinStreak;
  onCheckinSaved: () => Promise<void>;
}) {
  const [feltImpact, setFeltImpact] = useState(false);
  const [respiratorySymptoms, setRespiratorySymptoms] = useState(false);
  const [allergySymptoms, setAllergySymptoms] = useState(false);
  const [heatSymptoms, setHeatSymptoms] = useState(false);
  const [headacheOrFatigue, setHeadacheOrFatigue] = useState(false);
  const [avoidedOutdoorActivity, setAvoidedOutdoorActivity] =
    useState(false);
  const [usedRescueMedication, setUsedRescueMedication] = useState(false);
  const [
    missedWorkSchoolActivity,
    setMissedWorkSchoolActivity,
  ] = useState(false);
  const [symptomSeverity, setSymptomSeverity] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const submitCheckin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setMessage("Sign in to save symptom labels for future ML training.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await saveSymptomCheckin({
        userId: user.id,
        snapshotId: latestSnapshot?.id ?? null,
        zipCode,
        feltImpact,
        respiratorySymptoms,
        allergySymptoms,
        heatSymptoms,
        headacheOrFatigue,
        avoidedOutdoorActivity,
        usedRescueMedication,
        missedWorkSchoolActivity,
        symptomSeverity,
        notes,
      });
      await onCheckinSaved();
      setMessage(
        "Check-in saved. Thanks for helping MyLocalHealth learn from real experiences."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save this check-in."
      );
    } finally {
      setSaving(false);
    }
  };

  const checkboxClass =
    "h-4 w-4 rounded border-[var(--rule)] bg-[var(--surface-muted)] text-[var(--accent)]";

  return (
    <section className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Symptom Check-in
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            How are you feeling today?
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
            This optional check-in helps connect today&apos;s local conditions
            with how people actually feel. Your responses can improve future
            risk estimates.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--secondary)]/20 bg-[var(--secondary)]/10 p-4 text-sm leading-6 text-[var(--foreground-muted)]">
          Snapshot: {latestSnapshot ? "linked" : "not saved yet"}
          <span className="mt-2 block text-xs uppercase tracking-wide text-[var(--foreground-muted)]/70">
            Streak: {checkinStreak.currentStreak} day
            {checkinStreak.currentStreak === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {snapshotStatus && (
        <p className="mt-5 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--foreground-muted)]">
          {snapshotStatus}
        </p>
      )}

      {!user && (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Sign in to save check-ins. Anonymous check-ins are not stored.
        </p>
      )}

      <form onSubmit={submitCheckin} className="mt-5 grid gap-5">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              label: "Local conditions affected me today",
              checked: feltImpact,
              setChecked: setFeltImpact,
            },
            {
              label: "Coughing, wheezing, or breathing symptoms",
              checked: respiratorySymptoms,
              setChecked: setRespiratorySymptoms,
            },
            {
              label: "Allergy-like symptoms",
              checked: allergySymptoms,
              setChecked: setAllergySymptoms,
            },
            {
              label: "Heat discomfort",
              checked: heatSymptoms,
              setChecked: setHeatSymptoms,
            },
            {
              label: "Headache or fatigue",
              checked: headacheOrFatigue,
              setChecked: setHeadacheOrFatigue,
            },
            {
              label: "Avoided outdoor activity",
              checked: avoidedOutdoorActivity,
              setChecked: setAvoidedOutdoorActivity,
            },
            {
              label: "Used rescue medication more than usual",
              checked: usedRescueMedication,
              setChecked: setUsedRescueMedication,
            },
            {
              label: "Missed work, school, or activity",
              checked: missedWorkSchoolActivity,
              setChecked: setMissedWorkSchoolActivity,
            },
          ].map((item) => (
            <label
              className="flex items-center gap-3 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--foreground)]"
              key={item.label}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => item.setChecked(event.target.checked)}
                className={checkboxClass}
              />
              {item.label}
            </label>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-semibold text-[var(--foreground-muted)]">
          Symptom severity: {symptomSeverity}/10
          <input
            type="range"
            min="0"
            max="10"
            value={symptomSeverity}
            onChange={(event) =>
              setSymptomSeverity(Number(event.target.value))
            }
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[var(--foreground-muted)]">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context, such as outdoor time or symptoms noticed."
            className="min-h-24 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-normal text-[var(--foreground)] outline-none transition placeholder:text-slate-500 focus:border-[var(--accent)]"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={saving || !user}
            className="bespoke-button h-12 px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {saving ? "Saving" : "Save check-in"}
          </button>
          <p className="text-xs leading-5 text-[var(--foreground-faint)]">
            Do not enter urgent symptoms here. Seek medical care for serious
            symptoms.
          </p>
        </div>

        {message && (
          <p className="rounded-lg border border-[var(--secondary)]/20 bg-[var(--secondary)]/10 p-3 text-sm text-[var(--foreground-muted)]">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

function HealthChatPanel({ context }: { context: HealthChatContext }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me about the local respiratory risk, air quality, flu activity, COVID wastewater signal, or nearby health news for this ZIP code.",
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || chatLoading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmedQuestion },
    ];

    setMessages(nextMessages);
    setQuestion("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/health-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          messages: nextMessages,
          context,
        }),
      });
      const data = (await response.json()) as { answer?: string };

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            data.answer ??
            "I could not answer that from the current health context.",
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            "The health assistant is temporarily unavailable. Try again in a moment.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <section className="mt-5 rounded-lg border border-[var(--secondary)]/20 bg-[var(--surface)] p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Health Assistant
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            Ask about {context.city}, {context.state}
          </h3>
        </div>
        <p className="text-sm text-[var(--foreground-faint)]">
          Uses this dashboard&apos;s data and local news context
        </p>
      </div>

      <div className="mt-5 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-[var(--rule)] bg-black/15 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg border p-3 ${
              message.role === "user"
                ? "ml-auto max-w-[85%] border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "mr-auto max-w-[90%] border-[var(--secondary)]/20 bg-[var(--secondary)]/10 text-[var(--foreground)]"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
              {message.role === "user" ? "You" : "MyLocalHealth"}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {message.content}
            </p>
          </div>
        ))}
        {chatLoading && (
          <p className="text-sm text-[var(--foreground-muted)]">
            Thinking through the local health context...
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3 sm:flex-row"
      >
        <label className="sr-only" htmlFor="health-chat-question">
          Ask a health question
        </label>
        <input
          id="health-chat-question"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: Should I worry about outdoor exercise today?"
          className="h-12 min-w-0 flex-1 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-4 text-base text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15"
        />
        <button
          type="submit"
          disabled={chatLoading}
          className="bespoke-button h-12 px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {chatLoading ? "Asking" : "Ask"}
        </button>
      </form>

      <p className="mt-3 text-xs leading-5 text-[var(--foreground-faint)]">
        This assistant is informational only and is not medical advice. Avoid
        entering sensitive personal medical details here.
      </p>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const analyticsEmbedUrl =
    process.env.NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL ??
    process.env.NEXT_PUBLIC_TABLEAU_EMBED_URL ??
    "";
  const analyticsProvider = process.env.NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL
    ? "Looker Studio"
    : process.env.NEXT_PUBLIC_TABLEAU_EMBED_URL
    ? "Tableau"
    : "Ready for Tableau or Looker";

  const {
    zipCode,
    city,
    state,
    latitude,
    longitude,
    searched,
    loading,
    error,
    user,
    userProfile,
    checkinStreak,
    aqi,
    fluActivity,
    covidData,
    environmentData,
    weatherAlerts,
    localNews,
    healthEquityData,
    healthForecastData,
    newsLoading,
    newsError,
    equityError,
    latestSnapshot,
    snapshotStatus,
    covidActivity,
    heatRisk,
    uvRisk,
    alertRisk,
    pollutantRisk,
    dominantPollutant,
    airQualityLabel,
    healthRisk,
    respiratoryRisk,
    baseHealthRisk,
    baseRespiratoryRisk,
    personalizationSummary,
    personalizedRiskReasons,
    isPersonalized,
    modelVersion,
    methodology,
    scoreBreakdown,
    dataConfidence,
    mainTwinScore,
    mainTwinLevel,
    searchZipCode: contextSearchZipCode,
    resetSearch,
    setZipCode,
    refreshCheckinStreak,
  } = useDashboardData();

  const [dashboardView, setDashboardView] =
    useState<DashboardView>("overview");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mapClickLoading, setMapClickLoading] = useState(false);
  const [mapClickMessage, setMapClickMessage] = useState("");

  const riskModel = {
    personalizedRiskReasons,
    isPersonalized,
    modelVersion,
    methodology,
    baseHealthRisk,
    baseRespiratoryRisk,
  };
  const latitudeValue = Number(latitude);
  const longitudeValue = Number(longitude);
  const hasMapLocation =
    !Number.isNaN(latitudeValue) && !Number.isNaN(longitudeValue);
  const healthBrief = buildHealthBrief({
    healthRisk,
    respiratoryRisk,
    airQualityLabel,
    dominantPollutant,
    pollutantRisk,
    heatRisk,
    uvRisk,
    alertRisk,
    weatherAlerts,
    fluActivity,
    covidActivity,
    personalizedRiskReasons: riskModel.personalizedRiskReasons,
    isPersonalized: riskModel.isPersonalized,
  });
  const primaryDriver = scoreBreakdown.topDrivers[0];
  const bestWindowLabel =
    healthForecastData?.bestWindow?.displayTime ?? "Unavailable";
  const bestWindowDetail = healthForecastData?.bestWindow
    ? `Estimated exposure risk ${healthForecastData.bestWindow.score}/100.`
    : "Forecast data is still loading or unavailable.";
  const worstWindowLabel =
    healthForecastData?.worstWindow?.displayTime ?? "Unavailable";
  const mainConcernTitle = primaryDriver
    ? `${primaryDriver.label} is the main signal`
    : "No single signal stands out";
  const mainConcernDetail = primaryDriver
    ? `${primaryDriver.detail}. This is currently the strongest contributor in the transparent risk model.`
    : "The current public data does not show one dominant elevated driver for this ZIP code.";
  const confidenceLabel = `${dataConfidence.availableCount}/${dataConfidence.totalCount} sources loaded`;
  const confidenceDetail =
    dataConfidence.caveats.length > 0
      ? dataConfidence.caveats[0]
      : "Air, illness, forecast, alert, and local context signals are available for this snapshot.";
  const todayActions = [
    {
      label: "Best window",
      title:
        bestWindowLabel === "Unavailable"
          ? "Forecast window unavailable"
          : `Use ${bestWindowLabel} if going outside`,
      detail: bestWindowDetail,
      tone: "primary" as const,
    },
    {
      label: "Watch",
      title: mainConcernTitle,
      detail: mainConcernDetail,
      tone: "default" as const,
    },
    {
      label: "Confidence",
      title: dataConfidence.label,
      detail: `${confidenceLabel}. ${confidenceDetail}`,
      tone: "default" as const,
    },
  ];
  const chatContext: HealthChatContext = {
    zipCode,
    city,
    state,
    aqi,
    airQuality: airQualityLabel,
    fluActivity,
    covidActivity,
    covidValue: covidData?.value ?? null,
    covidSites: covidData?.numberOfSites ?? null,
    covidCoverage: covidData?.coverage ?? "Unknown",
    covidTimePeriod: covidData?.timePeriod ?? "Unknown",
    covidUpdatedAt: covidData?.updatedAt ?? "Unknown",
    healthRisk,
    respiratoryRisk,
    profileSummary: personalizationSummary,
    profileReasons: riskModel.personalizedRiskReasons,
    heatRisk,
    uvRisk,
    alertRisk,
    activeAlerts: weatherAlerts.map((alert) => alert.event),
    dominantPollutant,
    pollutantRisk,
    news: localNews.map((article) => ({
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt,
      url: article.url,
    })),
  };
  const healthPlanContext: HealthPlanContext = {
    context: chatContext,
    model: {
      version: riskModel.modelVersion,
      score: scoreBreakdown.score,
      topDrivers: scoreBreakdown.topDrivers,
      categoryScores: scoreBreakdown.categoryScores,
    },
    forecast: healthForecastData
      ? {
          summary: healthForecastData.summary,
          averageScore: healthForecastData.averageScore,
          peakScore: healthForecastData.peakScore,
          bestWindow:
            healthForecastData.bestWindow?.displayTime ?? "Unavailable",
          bestWindowScore: healthForecastData.bestWindow?.score ?? null,
          worstWindow:
            healthForecastData.worstWindow?.displayTime ?? "Unavailable",
          worstWindowScore: healthForecastData.worstWindow?.score ?? null,
          allergyPeakWindow:
            healthForecastData.allergyPeakWindow?.displayTime ??
            "Unavailable",
          allergyPeakScore: healthForecastData.allergyPeakScore,
          pollenRisk:
            healthForecastData.allergyPeakWindow?.pollenRisk ?? "Unknown",
          trends: healthForecastData.trends.map((trend) => ({
            label: trend.label,
            direction: trend.direction,
            peakTime: trend.peakTime,
            min: trend.min,
            max: trend.max,
            unit: trend.unit,
          })),
        }
      : undefined,
  };
  const detailHref = (topic: string) => {
    const params = new URLSearchParams({
      zipCode,
      city,
      state,
      stateAbbreviation: state,
      aqi: aqi?.toString() ?? "",
      airQuality: airQualityLabel,
      fluActivity,
      covidActivity,
      covidValue: covidData?.value?.toString() ?? "",
      covidSites: covidData?.numberOfSites.toString() ?? "",
      covidCoverage: covidData?.coverage ?? "",
      covidTimePeriod: covidData?.timePeriod ?? "",
      covidUpdatedAt: covidData?.updatedAt ?? "",
      heatRisk,
      uvRisk,
      alertRisk,
      pollutantRisk,
      dominantPollutant,
      temperature: environmentData?.temperature?.toString() ?? "",
      apparentTemperature:
        environmentData?.apparentTemperature?.toString() ?? "",
      humidity: environmentData?.humidity?.toString() ?? "",
      uvIndexMax: environmentData?.uvIndexMax?.toString() ?? "",
      temperatureMax: environmentData?.temperatureMax?.toString() ?? "",
      apparentTemperatureMax:
        environmentData?.apparentTemperatureMax?.toString() ?? "",
      activeAlerts: weatherAlerts.map((alert) => alert.event).join("|"),
      allergyPeakWindow:
        healthForecastData?.allergyPeakWindow?.displayTime ?? "",
      allergyPeakScore:
        healthForecastData?.allergyPeakScore?.toString() ?? "",
      pollenRisk:
        healthForecastData?.allergyPeakWindow?.pollenRisk ?? "",
      equityScore: healthEquityData?.equityScore.toString() ?? "",
      equityLevel: healthEquityData?.equityLevel ?? "",
      placesChronicBurdenScore:
        healthEquityData?.cdcPlaces?.chronicBurdenScore?.toString() ??
        "",
      placesAsthma:
        healthEquityData?.cdcPlaces?.asthma?.toString() ?? "",
      placesCopd: healthEquityData?.cdcPlaces?.copd?.toString() ?? "",
      placesSmoking:
        healthEquityData?.cdcPlaces?.smoking?.toString() ?? "",
      placesObesity:
        healthEquityData?.cdcPlaces?.obesity?.toString() ?? "",
      placesDiabetes:
        healthEquityData?.cdcPlaces?.diabetes?.toString() ?? "",
      healthRisk,
      respiratoryRisk,
    });

    return `/details/${topic}?${params.toString()}`;
  };

  const searchZipCode = async (
    zipToSearch: string,
    options: { updateUrl?: boolean; view?: DashboardView } = {}
  ) => {
    const nextView = options.view ?? "overview";
    setDashboardView(nextView);
    await contextSearchZipCode(zipToSearch);

    if (options.updateUrl !== false && typeof window !== "undefined") {
      window.history.pushState(
        { zipCode: zipToSearch, view: nextView },
        "",
        getDashboardUrl(zipToSearch, nextView)
      );
    }
  };

  useEffect(() => {
    const restoreDashboardViewFromUrl = () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      const restoredView: DashboardView = isDashboardView(viewParam)
        ? viewParam
        : "overview";

      setDashboardView(restoredView);
    };

    restoreDashboardViewFromUrl();
    window.addEventListener("popstate", restoreDashboardViewFromUrl);

    return () => {
      window.removeEventListener("popstate", restoreDashboardViewFromUrl);
    };
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMapClickMessage("");
    await searchZipCode(zipCode);
  };

  const handleMapPointSelect = async (
    selectedLatitude: number,
    selectedLongitude: number
  ) => {
    setMapClickLoading(true);
    setMapClickMessage("Finding the ZIP code for that point...");

    try {
      const params = new URLSearchParams({
        latitude: selectedLatitude.toString(),
        longitude: selectedLongitude.toString(),
      });
      const response = await fetch(
        `/api/reverse-location?${params.toString()}`
      );
      const data = (await response.json()) as {
        zipCode?: string;
        error?: string;
      };

      if (!response.ok || !data.zipCode) {
        throw new Error(
          data.error ?? "Unable to match that map point to a ZIP code."
        );
      }

      setMapClickMessage(`Loading local health data for ZIP ${data.zipCode}...`);
      await searchZipCode(data.zipCode);
      setMapClickMessage(`Showing local health data for ZIP ${data.zipCode}.`);
    } catch (error) {
      setMapClickMessage(
        error instanceof Error
          ? error.message
          : "Unable to use that map point."
      );
    } finally {
      setMapClickLoading(false);
    }
  };

  const navigateDashboardView = (view: DashboardView) => {
    if (standaloneDashboardViews.includes(view) && zipCode) {
      router.push(getDashboardUrl(zipCode, view));
      return;
    }

    setDashboardView(view);

    if (searched && zipCode && typeof window !== "undefined") {
      window.history.pushState(
        { zipCode, view },
        "",
        getDashboardUrl(zipCode, view)
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const resetToHome = () => {
    resetSearch();
    setDashboardView("overview");
    setMapClickLoading(false);
    setMapClickMessage("");

    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <main className={`public-health-bg min-h-screen ${searched ? "dashboard-mode" : ""}`}>
      <section className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        {!searched ? (
          <header className="landing-header">
            <div className="landing-announcement">
              Free local public-health snapshot for any US ZIP code
            </div>
            <nav className="landing-nav" aria-label="Primary">
              <div className="landing-nav-links">
                <a href="#feature-forecast">Forecast</a>
                <a href="#feature-twin">Exposure Twin</a>
                <a href="#feature-model">Model & Data</a>
                <a href="#feature-air-heat">More signals</a>
              </div>

              <Link
                href="/"
                onClick={(event) => {
                  event.preventDefault();
                  resetToHome();
                }}
                className="landing-brand"
                aria-label="MyLocalHealth home"
              >
                <Image
                  src="/mylocalhealth-icon-white.png"
                  alt=""
                  width={154}
                  height={123}
                  priority
                  className="h-auto w-12 shrink-0 invert sm:w-14"
                />
                <span className="brand-wordmark brand-wordmark-compact">
                  <span className="brand-wordmark-my">My</span>
                  <span className="brand-wordmark-local">Local</span>
                  <span className="brand-wordmark-health">Health</span>
                </span>
              </Link>

              <div className="landing-nav-actions">
                <Link href="/account">{user ? "Account" : "Sign in"}</Link>
                {!user && <Link href="/signup">Sign up</Link>}
              </div>
            </nav>
          </header>
        ) : (
          <header className="dashboard-topbar">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center">
                <Link
                  href="/"
                  onClick={(event) => {
                    event.preventDefault();
                    resetToHome();
                  }}
                  className="flex w-fit items-center gap-3 text-[var(--foreground)]"
                  aria-label="MyLocalHealth home"
                >
                  <Image
                    src="/mylocalhealth-icon-white.png"
                    alt=""
                    width={154}
                    height={123}
                    priority
                    className="h-auto w-10 shrink-0 invert sm:w-11"
                  />
                  <span className="brand-wordmark brand-wordmark-compact">
                    <span className="brand-wordmark-my">My</span>
                    <span className="brand-wordmark-local">Local</span>
                    <span className="brand-wordmark-health">Health</span>
                  </span>
                </Link>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <form
                  onSubmit={handleSearch}
                  className="flex w-full gap-2 lg:w-[28rem]"
                >
                  <label className="sr-only" htmlFor="zip-code-top">
                    ZIP code
                  </label>
                  <input
                    id="zip-code-top"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter ZIP"
                    value={zipCode}
                    onChange={(event) => setZipCode(event.target.value)}
                    className="bespoke-control h-11 min-w-0 flex-1 border border-[var(--rule)] bg-[var(--surface)] px-3 text-base text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--foreground-faint)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bespoke-button h-11 px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-[var(--rule)] disabled:text-[var(--foreground-faint)]"
                  >
                    {loading ? "..." : "Search"}
                  </button>
                </form>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/account"
                    className="flex-1 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-transparent px-4 py-2 text-center text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] sm:flex-none"
                  >
                    {user ? "Account" : "Sign in"}
                  </Link>
                  {!user && (
                    <Link
                      href="/signup"
                      className="bespoke-button flex-1 px-4 py-2 text-center text-sm font-semibold transition sm:flex-none"
                    >
                      Sign up
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {searched && (
          <div className="sticky top-0 z-30 border-b border-[var(--rule)] bg-[var(--surface)] pt-4 shadow-sm lg:hidden">
            <DashboardNav
              activeView={dashboardView}
              onChange={navigateDashboardView}
            />
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[var(--radius-sm)] border border-l-[3px] border-[var(--rule)] border-l-[var(--accent)] bg-[var(--accent-soft)] p-4 text-sm font-medium text-[var(--accent-ink)]">
            {error}
          </div>
        )}

        {!searched && !error && (
          <section className="flex-1 py-0">
            <div className="landing-lab-hero">
              <div className="landing-lab-copy">
                <span className="landing-kicker">Local public-health intelligence</span>
                <h1 className="display-heading mt-4 text-5xl leading-[0.95] text-[var(--foreground)] sm:text-7xl lg:text-8xl">
                  A daily health read for where you actually are.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--foreground-muted)] sm:text-lg">
                  Search a ZIP code and get a plain-English snapshot built
                  from air quality, heat, pollen, respiratory illness,
                  local context, personal exposure, and model confidence.
                </p>

                <form
                  id="zip-search"
                  onSubmit={handleSearch}
                  className="landing-lab-search mt-8"
                >
                  <div>
                    <label htmlFor="zip-code">Start with a ZIP code</label>
                    <input
                      id="zip-code"
                      type="text"
                      inputMode="numeric"
                      placeholder="27516"
                      value={zipCode}
                      onChange={(event) => setZipCode(event.target.value)}
                    />
                  </div>

                  <button type="submit" disabled={loading}>
                    {loading ? "Building snapshot" : "Generate report"}
                  </button>
                </form>

                <div className="landing-lab-proof">
                  <span>No account needed</span>
                  <span>Public datasets</span>
                  <span>Transparent model</span>
                </div>
              </div>

              <aside className="landing-report-preview" aria-label="Example health report preview">
                <div className="report-preview-header">
                  <div>
                    <span>Example report</span>
                    <strong>Chapel Hill, NC</strong>
                  </div>
                  <p>Today</p>
                </div>

                <div className="report-preview-score">
                  <div>
                    <span>Exposure Twin</span>
                    <strong>42</strong>
                  </div>
                  <p>Moderate local exposure estimate</p>
                </div>

                <div className="report-preview-map">
                  <span className="map-road map-road-one" />
                  <span className="map-road map-road-two" />
                  <span className="map-road map-road-three" />
                  <span className="map-zone map-zone-a" />
                  <span className="map-zone map-zone-b" />
                  <span className="map-pin" />
                </div>

                <div className="report-preview-timeline">
                  {[
                    ["6a", "22%"],
                    ["9a", "38%"],
                    ["12p", "63%"],
                    ["3p", "76%"],
                    ["6p", "44%"],
                    ["9p", "29%"],
                  ].map(([label, height]) => (
                    <div key={label}>
                      <i style={{ height }} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="report-preview-signals">
                  <span>Air quality</span>
                  <strong>Fair</strong>
                  <span>Heat</span>
                  <strong>Moderate</strong>
                  <span>Flu/COVID</span>
                  <strong>Low</strong>
                </div>
              </aside>
            </div>

            <LiveSignalTape />

            <div className="landing-feature-row">
              <article>
                <p>Local first</p>
                <span>
                  ZIP snapshots, map lookup, and nearby news keep the read tied
                  to place.
                </span>
              </article>
              <article>
                <p>Public-health context</p>
                <span>
                  Environmental signals sit beside equity and chronic disease
                  burden.
                </span>
              </article>
              <article>
                <p>Personalizable</p>
                <span>
                  Profiles, saved places, exposure timelines, and check-ins
                  make the forecast more useful over time.
                </span>
              </article>
            </div>

            <PreSearchFeatureSections />
          </section>
        )}

        {searched && (
          <section className="dashboard-workspace grid gap-6 py-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <DashboardSidebar
              activeView={dashboardView}
              onChange={navigateDashboardView}
              city={city}
              state={state}
              zipCode={zipCode}
            />

            <div className="min-w-0">
              <section className="results-masthead mb-5">
                <div>
                  <p className="eyebrow-text">Local snapshot</p>
                  <h2 className="display-heading mt-2 text-3xl leading-tight text-[var(--foreground)] sm:text-5xl">
                    {city}, {state}
                  </h2>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
                    ZIP {zipCode}
                  </p>
                </div>

                <div className="results-masthead-summary">
                  <div>
                    <span>Overall</span>
                    <strong>{healthRisk}</strong>
                  </div>
                  <div>
                    <span>Twin score</span>
                    <strong>{mainTwinScore}</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>{dataConfidence.label}</strong>
                  </div>
                </div>

                <p className="results-masthead-note">
                  Informational only, not medical advice.
                </p>
              </section>

              <CoreFeatureHub
                activeView={dashboardView}
                onChange={navigateDashboardView}
                forecastData={healthForecastData}
                twinScore={mainTwinScore}
                twinLevel={mainTwinLevel}
                checkinStreak={checkinStreak}
                score={scoreBreakdown.score}
                topDrivers={scoreBreakdown.topDrivers}
                categoryScores={scoreBreakdown.categoryScores}
              />

            {dashboardView === "overview" && (
              <>
                <section className="today-brief-shell p-5 sm:p-7 lg:p-8">
                  <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="field-tag">Today in {city}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                          ZIP {zipCode} · {state}
                        </span>
                      </div>
                      <h3 className="display-heading mt-4 max-w-4xl text-3xl leading-tight text-[var(--foreground)] sm:text-5xl">
                        {healthBrief.headline}
                      </h3>
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
                        The short version: {mainConcernDetail}
                      </p>
                      <p className="hand-note mt-4 max-w-3xl rounded-lg px-4 py-3 text-sm leading-6 text-[var(--foreground-muted)]">
                        {personalizationSummary}
                      </p>
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {todayActions.map((action) => (
                          <BriefActionCard
                            key={action.label}
                            label={action.label}
                            title={action.title}
                            detail={action.detail}
                            tone={action.tone}
                          />
                        ))}
                      </div>
                      <div className="live-signal-rail mt-4 grid gap-3 p-3 sm:grid-cols-3">
                        {[
                          {
                            label: "Air",
                            value: airQualityLabel,
                          },
                          {
                            label: "Respiratory",
                            value: respiratoryRisk,
                          },
                          {
                            label: "Forecast",
                            value:
                              healthForecastData?.peakScore === undefined ||
                              healthForecastData?.peakScore === null
                                ? "Loading"
                                : `Peak ${healthForecastData.peakScore}/100`,
                          },
                        ].map((signal) => (
                          <div
                            className="relative z-10 flex items-center justify-between gap-3 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 py-2"
                            key={signal.label}
                          >
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                              <span className="live-signal-dot h-2 w-2 rounded-full bg-[var(--secondary)]" />
                              {signal.label}
                            </span>
                            <span className="truncate text-xs font-semibold text-[var(--foreground)]">
                              {signal.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => navigateDashboardView("forecast")}
                          className="bespoke-button px-4 py-2 text-sm font-semibold transition"
                        >
                          View forecast
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateDashboardView("twin")}
                          className="bespoke-button border border-[var(--rule)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-muted)]"
                        >
                          Open Exposure Twin
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateDashboardView("model")}
                          className="bespoke-button border border-[var(--rule)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-muted)]"
                        >
                          Explain model
                        </button>
                      </div>
                    </div>

                    <div className="today-risk-card p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                        Overall Risk Today
                      </p>
                      <p className="mt-3 text-5xl font-black leading-none text-[var(--foreground)] sm:text-6xl">
                        {healthRisk}
                      </p>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--foreground)]/12">
                        <div
                          className="risk-meter-fill h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${scoreBreakdown.score}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--foreground-muted)]">
                        Risk index {scoreBreakdown.score}/100
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]/75">
                        {riskModel.modelVersion}
                      </p>
                      {riskModel.isPersonalized && (
                        <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]/75">
                          Base environmental risk: {riskModel.baseHealthRisk}
                        </p>
                      )}
                      <div className="mt-5 border-t border-[var(--rule)] pt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                          Avoid / Watch
                        </p>
                        <p className="mt-2 text-sm font-bold leading-6 text-[var(--foreground)]">
                          {worstWindowLabel === "Unavailable"
                            ? "No peak window available yet"
                            : `${worstWindowLabel} may be the highest exposure window`}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]/75">
                          {healthForecastData?.worstWindow
                            ? `Estimated exposure risk ${healthForecastData.worstWindow.score}/100.`
                            : "Forecast data is still loading or unavailable."}
                        </p>
                      </div>
                    </div>
                  </div>

                </section>

                <ForecastPulseStrip
                  forecastData={healthForecastData}
                  onOpenForecast={() => navigateDashboardView("forecast")}
                />

                <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <article className="quiet-surface rounded-lg p-5">
                    <p className="eyebrow-text">Suggested Focus</p>
                    <h3 className="display-heading mt-2 text-2xl leading-tight text-[var(--foreground)]">
                      What to do with today&apos;s read
                    </h3>
                    <div className="mt-4 grid gap-3">
                      {healthBrief.focusItems.map((item, index) => (
                        <div
                          className={`flex gap-3 rounded-lg border p-3 ${
                            index === 0
                              ? "border-[var(--accent)]/35 bg-[var(--accent)]/10"
                              : "border-[var(--rule)] bg-[var(--surface-muted)]"
                          }`}
                          key={item}
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-6 text-[var(--foreground)]">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="quiet-surface data-pin rounded-lg p-5">
                    <p className="eyebrow-text">Personal Note</p>
                    <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      {healthBrief.profileNote}
                    </p>
                    <div className="mt-5 grid gap-3">
                      <div className="paper-strip p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                          Watch Window
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {healthForecastData?.worstWindow?.displayTime ??
                            "Unavailable"}
                        </p>
                      </div>
                    </div>
                  </article>
                </section>

                <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="quiet-surface rounded-lg p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground-muted)]">
                          Top Reasons
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                          What is driving today&apos;s reading
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateDashboardView("model")}
                        className="shrink-0 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                      >
                        See model
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {scoreBreakdown.topDrivers.slice(0, 4).map((driver) => (
                        <div
                          className="border-b border-[var(--rule)] py-3 last:border-b-0"
                          key={driver.label}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {driver.label}
                            </p>
                            <p className="text-sm font-semibold text-[var(--foreground-muted)]">
                              +{driver.points}
                            </p>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[var(--foreground-faint)]">
                            {driver.detail}
                          </p>
                        </div>
                      ))}
                      {scoreBreakdown.topDrivers.length === 0 && (
                        <p className="border-l border-[var(--rule)] py-3 pl-3 text-sm leading-6 text-[var(--foreground-muted)]">
                          No single driver is elevated right now.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="quiet-surface rounded-lg p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground-muted)]">
                          Why It Matters Locally
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                          Equity and baseline health context
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateDashboardView("equity")}
                        className="shrink-0 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                      >
                        See context
                      </button>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      {healthEquityData
                        ? healthEquityData.summary
                        : "Health equity context is still loading or unavailable for this ZIP code."}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="inset-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-[var(--foreground-faint)]">
                          Equity Score
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                          {healthEquityData
                            ? `${healthEquityData.equityScore}/100`
                            : "n/a"}
                        </p>
                      </div>
                      <div className="inset-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-[var(--foreground-faint)]">
                          Chronic Burden
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                          {healthEquityData?.cdcPlaces
                            ?.chronicBurdenScore === null ||
                          healthEquityData?.cdcPlaces
                            ?.chronicBurdenScore === undefined
                            ? "n/a"
                            : `${healthEquityData.cdcPlaces.chronicBurdenScore}/100`}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SignalCard
                    title="Respiratory"
                    value={respiratoryRisk}
                    detail="Flu, COVID wastewater, air quality, and pollutant context."
                    source="CDC + air quality sources"
                    href={detailHref("respiratory-risk")}
                  />
                  <SignalCard
                    title="Air"
                    value={airQualityLabel}
                    detail={`AQI ${aqi ?? "n/a"} with ${dominantPollutant} as the main pollutant signal.`}
                    source="OpenWeather"
                    href={detailHref("air-quality")}
                  />
                  <SignalCard
                    title="Heat"
                    value={heatRisk}
                    detail={`Daily max feels-like temperature ${
                      environmentData?.apparentTemperatureMax?.toFixed(0) ??
                      "n/a"
                    }°F.`}
                    source="Open-Meteo"
                    href={detailHref("heat-risk")}
                  />
                  <SignalCard
                    title="Pollen"
                    value={
                      healthForecastData?.allergyPeakWindow?.pollenRisk ??
                      "Unknown"
                    }
                    detail={
                      healthForecastData?.allergyPeakWindow
                        ? `Peak around ${healthForecastData.allergyPeakWindow.displayTime}.`
                        : "Pollen forecast unavailable."
                    }
                    source="Open-Meteo"
                    href={detailHref("pollen-forecast")}
                  />
                </section>

                {hasMapLocation && (
                  <InteractiveLocationMap
                    city={city}
                    state={state}
                    zipCode={zipCode}
                    latitude={latitudeValue}
                    longitude={longitudeValue}
                    loading={mapClickLoading}
                    message={mapClickMessage}
                    onSelectPoint={handleMapPointSelect}
                  />
                )}
              </>
            )}

            {dashboardView === "plan" && (
              <AiHealthPlanPanel planContext={healthPlanContext} />
            )}

            {dashboardView === "timeline" && (
              <ExposureTimelinePanel
                zipCode={zipCode}
                city={city}
                state={state}
                baseScore={scoreBreakdown.score}
                healthRisk={healthRisk}
                respiratoryRisk={respiratoryRisk}
                airQuality={airQualityLabel}
                heatRisk={heatRisk}
                uvRisk={uvRisk}
                profile={userProfile}
              />
            )}

            {dashboardView === "equity" && (
              <HealthEquityPanel
                equityData={healthEquityData}
                equityError={equityError}
                heatRisk={heatRisk}
                pollutantRisk={pollutantRisk}
                dominantPollutant={dominantPollutant}
              />
            )}

            {dashboardView === "checkin" && (
              <SymptomCheckinPanel
                user={user}
                zipCode={zipCode}
                latestSnapshot={latestSnapshot}
                snapshotStatus={snapshotStatus}
                checkinStreak={checkinStreak}
                onCheckinSaved={async () => {
                  if (user) {
                    await refreshCheckinStreak(user.id);
                  }
                }}
              />
            )}

            {dashboardView === "signals" && (
            <section className="mt-5 grid gap-5 md:grid-cols-2">
              <SignalCard
                title="Air Quality"
                value={airQualityLabel}
                detail={`AQI category ${aqi ?? "unavailable"}. Main pollutant signal: ${dominantPollutant}.`}
                source="Source: OpenWeather Air Pollution API"
                href={detailHref("air-quality")}
              />
              <SignalCard
                title="Heat Risk"
                value={heatRisk}
                detail={`Feels like ${
                  environmentData?.apparentTemperature?.toFixed(0) ??
                  "unavailable"
                }°F now; daily max feels like ${
                  environmentData?.apparentTemperatureMax?.toFixed(0) ??
                  "unavailable"
                }°F.`}
                source="Source: Open-Meteo forecast API"
                href={detailHref("heat-risk")}
              />
              <SignalCard
                title="UV Risk"
                value={uvRisk}
                detail={`Daily maximum UV index is ${
                  environmentData?.uvIndexMax?.toFixed(1) ??
                  "unavailable"
                }.`}
                source="Source: Open-Meteo forecast API"
                href={detailHref("uv-risk")}
              />
              <SignalCard
                title="Active Alerts"
                value={alertRisk}
                detail={
                  weatherAlerts.length > 0
                    ? weatherAlerts
                        .slice(0, 2)
                        .map((alert) => alert.event)
                        .join(", ")
                    : "No active National Weather Service alerts found for this point."
                }
                source="Source: National Weather Service alerts API"
                href={detailHref("weather-alerts")}
              />
              <SignalCard
                title="Flu Activity"
                value={fluActivity}
                detail="CDC respiratory illness activity reported at the state level."
                source="Source: CDC respiratory illness activity dataset"
                href={detailHref("flu-activity")}
              />
              <SignalCard
                title="COVID Wastewater"
                value={covidActivity}
                detail={
                  covidData
                    ? `Wastewater viral activity for ${covidData.timePeriod}, based on ${covidData.numberOfSites} reporting sites.`
                    : "CDC wastewater activity data was unavailable for this search."
                }
                source={
                  covidData
                    ? `Source: CDC NWSS, updated ${covidData.updatedAt}`
                    : "Source: CDC NWSS"
                }
                href={detailHref("covid-wastewater")}
              />
              <SignalCard
                title="Pollen Forecast"
                value={
                  healthForecastData?.allergyPeakWindow?.pollenRisk ??
                  "Unknown"
                }
                detail={
                  healthForecastData?.allergyPeakWindow
                    ? `Highest pollen signal is around ${healthForecastData.allergyPeakWindow.displayTime}, estimated at ${healthForecastData.allergyPeakScore ?? "n/a"} grains/m3.`
                    : "Pollen forecast data was unavailable for this search."
                }
                source="Source: Open-Meteo air-quality forecast API"
                href={detailHref("pollen-forecast")}
              />
              <SignalCard
                title="Health Equity"
                value={healthEquityData?.equityLevel ?? "Unknown"}
                detail={
                  healthEquityData
                    ? `Structural vulnerability score ${healthEquityData.equityScore}/100 from ACS social determinants and CDC PLACES context.`
                    : "Health equity data was unavailable for this search."
                }
                source="Sources: Census ACS and CDC PLACES"
                href={detailHref("health-equity")}
              />
              <SignalCard
                title="Chronic Disease Baseline"
                value={
                  healthEquityData?.cdcPlaces?.chronicBurdenScore === null ||
                  healthEquityData?.cdcPlaces?.chronicBurdenScore ===
                    undefined
                    ? "Unknown"
                    : exposureLabel(
                        healthEquityData.cdcPlaces.chronicBurdenScore
                      )
                }
                detail={
                  healthEquityData?.cdcPlaces
                    ? `Asthma ${healthEquityData.cdcPlaces.asthma?.toFixed(1) ?? "n/a"}%, COPD ${healthEquityData.cdcPlaces.copd?.toFixed(1) ?? "n/a"}%, smoking ${healthEquityData.cdcPlaces.smoking?.toFixed(1) ?? "n/a"}% in the local census tract.`
                    : "CDC PLACES tract estimates were unavailable for this search."
                }
                source="Source: CDC PLACES 2025"
                href={detailHref("cdc-places")}
              />
            </section>
            )}

            {dashboardView === "news" && (
            <section className="mt-5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                    Local Health News
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                    Recent health-related articles near {city}, {state}
                  </h3>
                </div>
                <p className="text-sm text-[var(--foreground-faint)]">
                  Sources: GDELT and Google News RSS
                </p>
              </div>

              {newsLoading && (
                <p className="mt-5 text-sm text-[var(--foreground-muted)]">
                  Searching recent local health news...
                </p>
              )}

              {newsError && (
                <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {newsError}
                </p>
              )}

              {!newsLoading && !newsError && localNews.length === 0 && (
                <p className="mt-5 text-sm leading-6 text-[var(--foreground-muted)]">
                  No recent local health news articles were found for this
                  search. This does not mean there are no public health issues
                  in the area.
                </p>
              )}

              {localNews.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {localNews.map((article) => (
                    <a
                      href={article.url}
                      key={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-muted)]"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        {article.source}
                      </p>
                      <h4 className="mt-2 text-base font-semibold leading-6 text-[var(--foreground)]">
                        {article.title}
                      </h4>
                      <p className="mt-3 text-sm text-[var(--foreground-faint)]">
                        {article.publishedAt} · {article.language}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </section>
            )}

            {dashboardView === "analytics" && (
              <AnalyticsEmbedPanel
                embedUrl={analyticsEmbedUrl}
                provider={analyticsProvider}
              />
            )}
            </div>
          </section>
        )}
      </section>

      {searched && (
        <>
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="chat-launcher"
            aria-label="Open Ask AI assistant"
          >
            <span aria-hidden="true">Ask</span>
            <span aria-hidden="true">AI</span>
          </button>

          {isChatOpen && (
            <div className="chat-overlay" role="dialog" aria-label="Ask AI assistant">
              <div
                className="chat-overlay-backdrop"
                onClick={() => setIsChatOpen(false)}
                aria-hidden="true"
              />
              <div className="chat-overlay-panel">
                <div className="chat-overlay-header">
                  <p className="eyebrow-text">Ask AI</p>
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className="chat-overlay-close"
                    aria-label="Close Ask AI assistant"
                  >
                    Close
                  </button>
                </div>
                <div className="chat-overlay-body">
                  <HealthChatPanel context={chatContext} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
