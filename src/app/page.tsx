"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getAirQualityLabel,
  getDominantPollutant,
  getPollutantRiskLabel,
} from "../lib/airQuality";
import {
  evaluateRiskModel,
  type DataStatus,
  type RiskCategoryScore,
  type RiskModelConfidence,
  type RiskModelItem,
} from "../lib/riskModel";
import { getLocation } from "../services/location";
import {
  getAirQuality,
  type AirQualityData,
} from "../services/airsQuality";
import { getFluData } from "../services/flu";
import {
  getCovidData,
  type CovidActivityData,
} from "../services/covid";
import {
  getLocalHealthNews,
  type LocalHealthNewsArticle,
} from "../services/localNews";
import {
  getEnvironmentData,
  getHeatRiskLabel,
  getUvRiskLabel,
  type EnvironmentData,
} from "../services/environment";
import {
  getWeatherAlerts,
  summarizeAlertRisk,
  type WeatherAlert,
} from "../services/weatherAlerts";
import {
  getUserProfile,
  type UserProfile,
} from "../services/userProfile";
import {
  getHealthEquityData,
  type HealthEquityData,
} from "../services/healthEquity";
import {
  getHealthForecast,
  type HealthForecastData,
} from "../services/healthForecast";
import {
  saveHealthSnapshot,
  saveSymptomCheckin,
  type SavedHealthSnapshot,
} from "../services/mlTrainingData";
import { supabase } from "../lib/supabaseClient";

const unknownCovidData: CovidActivityData = {
  activity: "Unknown",
  value: null,
  numberOfSites: 0,
  coverage: "Unknown",
  timePeriod: "Unknown",
  updatedAt: "Unknown",
  weekEnd: "Unknown",
};

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

type DashboardView =
  | "overview"
  | "plan"
  | "forecast"
  | "timeline"
  | "equity"
  | "checkin"
  | "signals"
  | "news"
  | "assistant"
  | "model";

const dashboardViews: { id: DashboardView; label: string; description: string }[] = [
  {
    id: "overview",
    label: "Today",
    description: "Daily health forecast and next steps",
  },
  {
    id: "plan",
    label: "AI Plan",
    description: "Personalized daily guidance",
  },
  {
    id: "forecast",
    label: "Forecast",
    description: "Next 24-hour risk prediction",
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
    id: "assistant",
    label: "Ask AI",
    description: "Questions about this location",
  },
  {
    id: "model",
    label: "Model & Data",
    description: "Risk index, weights, and confidence",
  },
];

const dashboardGroups: {
  label: string;
  description: string;
  views: DashboardView[];
}[] = [
  {
    label: "Today",
    description: "Start here for the daily snapshot",
    views: ["overview", "forecast", "signals"],
  },
  {
    label: "Plan",
    description: "Turn local risk into next steps",
    views: ["plan", "timeline", "assistant", "checkin"],
  },
  {
    label: "Explore",
    description: "Understand the data and local context",
    views: ["equity", "news", "model"],
  },
];

function getDashboardView(viewId: DashboardView) {
  return (
    dashboardViews.find((view) => view.id === viewId) ??
    dashboardViews[0]
  );
}

function isDashboardView(value: string | null): value is DashboardView {
  return dashboardViews.some((view) => view.id === value);
}

function getDashboardUrl(zipCode: string, view: DashboardView) {
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
      return "border-emerald-300/40 bg-emerald-400/10 text-teal-100";
    case "Moderate":
      return "border-amber-300/40 bg-amber-400/10 text-amber-100";
    case "High":
    case "Very High":
      return "border-rose-300/40 bg-rose-500/10 text-rose-100";
    default:
      return "border-white/15 bg-white/10 text-slate-200";
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
  const activeGroup =
    dashboardGroups.find((group) => group.views.includes(activeView)) ??
    dashboardGroups[0];

  return (
    <div className="quiet-surface relative z-20 mb-5 rounded-lg p-2">
      <nav
        aria-label="Dashboard sections"
        className="grid gap-2 md:grid-cols-3"
      >
        {dashboardGroups.map((group) => {
          const isActiveGroup = group.views.includes(activeView);

          return (
            <div className="group relative" key={group.label}>
              <button
                type="button"
                onClick={() => onChange(group.views[0])}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  isActiveGroup
                    ? "border-emerald-300/40 bg-emerald-400/10 text-white"
                    : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {group.label}
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-slate-400">
                    {isActiveGroup
                      ? activeDashboardView.label
                      : group.description}
                  </span>
                </span>
                <span className="text-sm text-teal-100">v</span>
              </button>

              <div className="invisible absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-lg border border-white/10 bg-[#0b1715] p-2 opacity-0 shadow-2xl shadow-black/35 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
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
                          ? "bg-emerald-400/10 text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {view.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
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
      <div className="border-t border-white/10 px-2 py-3">
        <p className="eyebrow-text">
          {activeGroup.label} / {activeDashboardView.label}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          {activeDashboardView.description}
        </p>
      </div>
    </div>
  );
}

function RiskBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-semibold ${riskBadgeClass(
        value
      )}`}
    >
      {value}
    </span>
  );
}

function AnimatedHealthMapGraphic() {
  const markers = [
    { x: 132, y: 106, label: "AQI 74", tone: "air", delay: "0s" },
    { x: 333, y: 72, label: "Flu rising", tone: "resp", delay: "0.8s" },
    { x: 506, y: 143, label: "Heat 91°F", tone: "heat", delay: "1.5s" },
  ];

  return (
    <div
      aria-hidden="true"
      className="health-map-visual quiet-surface mx-auto mt-10 w-full max-w-4xl overflow-hidden rounded-lg"
    >
      <svg
        className="h-64 w-full"
        viewBox="0 0 760 280"
        role="img"
        focusable="false"
      >
        <defs>
          <linearGradient id="map-water" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#12332d" />
            <stop offset="100%" stopColor="#0b1412" />
          </linearGradient>
          <linearGradient id="map-route" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#99f6e4" />
            <stop offset="100%" stopColor="#fcd34d" />
          </linearGradient>
          <filter id="map-soft-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="760" height="280" fill="url(#map-water)" />
        <path
          d="M0 80 C105 44 151 78 221 59 C299 38 350 16 430 42 C512 69 574 42 760 74 L760 0 L0 0 Z"
          className="health-map-land"
        />
        <path
          d="M0 236 C113 218 186 186 268 204 C367 225 428 176 514 196 C601 216 664 196 760 171 L760 280 L0 280 Z"
          className="health-map-land health-map-land-alt"
        />
        <path
          d="M42 171 L183 114 L314 147 L462 92 L676 138"
          className="health-map-road health-map-road-major"
        />
        <path
          d="M96 62 L185 114 L226 226"
          className="health-map-road"
        />
        <path
          d="M314 147 L342 67 L514 41"
          className="health-map-road"
        />
        <path
          d="M462 92 L548 202 L695 222"
          className="health-map-road"
        />
        <path
          d="M55 202 L188 171 L308 219 L455 180 L660 202"
          className="health-map-road health-map-road-minor"
        />
        <path
          d="M42 171 L183 114 L314 147 L462 92 L676 138"
          className="health-map-flow"
        />
        <path
          d="M96 62 L185 114 L226 226"
          className="health-map-flow health-map-flow-alt"
        />

        <g className="health-map-zones">
          <circle cx="126" cy="112" r="58" className="health-zone-air" />
          <circle cx="333" cy="72" r="54" className="health-zone-resp" />
          <circle cx="506" cy="143" r="66" className="health-zone-heat" />
        </g>

        <g filter="url(#map-soft-glow)">
          {markers.map((marker) => (
            <g key={marker.label}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r="18"
                className={`health-signal-ring health-signal-${marker.tone}`}
                style={{ animationDelay: marker.delay }}
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r="6"
                className={`health-signal-dot health-signal-${marker.tone}`}
              />
              <text
                x={marker.x + 16}
                y={marker.y - 10}
                className="health-map-label"
              >
                {marker.label}
              </text>
            </g>
          ))}
        </g>

        <text x="92" y="254" className="health-map-place">
          Downtown
        </text>
        <text x="286" y="242" className="health-map-place">
          School
        </text>
        <text x="482" y="236" className="health-map-place">
          Clinic
        </text>
        <text x="584" y="67" className="health-map-place">
          Industrial corridor
        </text>
      </svg>
    </div>
  );
}

function LiveSignalTape() {
  const signals = [
    "AQI",
    "Heat index",
    "COVID wastewater",
    "Flu activity",
    "Pollen",
    "UV",
    "Local alerts",
    "Equity context",
  ];
  const repeatedSignals = [...signals, ...signals];

  return (
    <div className="signal-tape mt-6 overflow-hidden border-y border-white/10 py-3 text-left">
      <div className="signal-tape-track flex w-max gap-3">
        {repeatedSignals.map((signal, index) => (
          <span
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300"
            key={`${signal}-${index}`}
          >
            {signal}
          </span>
        ))}
      </div>
    </div>
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
}: {
  forecastData: HealthForecastData | null;
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
          <h3 className="display-heading mt-1 text-2xl leading-tight text-white">
            Forecast pulse
          </h3>
        </div>
        <p className="text-sm text-slate-400">
          Hover bars to read the estimated exposure score.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-12 items-end gap-2">
        {hours.map((hour) => {
          const height = Math.max(18, hour.score);
          const explanation = buildForecastHourExplanation(hour);
          const color =
            hour.risk === "High"
              ? "bg-rose-300"
              : hour.risk === "Moderate"
              ? "bg-amber-300"
              : "bg-emerald-300";

          return (
            <div
              className="group relative flex min-w-0 flex-col items-center gap-2"
              key={hour.time}
              tabIndex={0}
            >
              <div className="relative flex h-28 w-full items-end rounded-full bg-white/[0.035] px-1">
                <div
                  className={`forecast-pulse-bar w-full rounded-full ${color} opacity-80`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a1513] p-3 text-left text-xs shadow-2xl shadow-black/35 group-hover:block group-focus:block">
                <p className="font-semibold text-white">
                  {hour.displayTime} · {hour.score}/100
                </p>
                <p className="mt-1 leading-5 text-slate-300">
                  {explanation.drivers}
                </p>
                <p className="mt-2 leading-5 text-slate-400">
                  {explanation.metrics}
                </p>
              </div>
              <p className="w-full truncate text-center text-[0.68rem] text-slate-400">
                {hour.displayTime.replace(/^[A-Za-z]+,?\s/, "")}
              </p>
            </div>
          );
        })}
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
      className="group block rounded-lg outline-none transition focus:ring-4 focus:ring-teal-300/20"
    >
    <article className="quiet-surface rounded-lg p-4 transition group-hover:-translate-y-0.5 group-hover:border-emerald-300/35 group-hover:bg-white/[0.065]">
      <div className="flex min-h-24 flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-300 transition group-hover:text-emerald-100">
              {title}
            </h3>
            <RiskBadge value={value} />
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
            {detail}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <p className="truncate text-xs text-slate-400">{source}</p>
          <p className="shrink-0 text-xs font-semibold text-teal-100">
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

function RiskTransparencyPanel({
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

  return (
    <section className="mt-5">
      <article className="rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Why This Score?
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              Transparent risk index
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              A simple 0-100 explanation of which local signals are pushing the
              snapshot higher.
            </p>
          </div>
          <p className="text-3xl font-bold text-white">{score}/100</p>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-400"
            style={{ width: `${score}%` }}
          />
        </div>
        {topDrivers.length > 0 && (
          <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Top drivers
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {topDrivers.map((driver) => (
                <div
                  className="rounded-lg border border-emerald-200/10 bg-black/10 p-3"
                  key={driver.label}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {driver.label}
                    </p>
                    <p className="text-sm font-semibold text-emerald-100">
                      +{driver.points}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-emerald-100/80">
                    {driver.detail} · {driver.category}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {categoryScores.map((category) => (
            <div
              className="rounded-lg border border-white/10 bg-white/5 p-3"
              key={category.label}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {category.label}
                </p>
                <p className="text-sm font-semibold text-emerald-100">
                  {category.score}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${category.score}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                {category.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-black/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Weighted inputs
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Expand the scoring table when you want the full calculation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWeights((current) => !current)}
              className="h-10 rounded-lg border border-white/15 px-4 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/10"
            >
              {showWeights ? "Hide weights" : "Show weights"}
            </button>
          </div>

          {showWeights && (
            <div className="mt-4 grid gap-3">
              {items.map((item) => (
                <div
                  className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_auto]"
                  key={item.label}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {item.detail}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.category} · Weight: {item.weight} · Max{" "}
                      {item.maxPoints} points
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-100">
                    +{item.points}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-5 rounded-lg border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            How this score is calculated
          </p>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-300">
            {methodology.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}

function DataConfidencePanel({
  confidence,
}: {
  confidence: RiskModelConfidence;
}) {
  return (
    <section className="mt-5 rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Data Confidence
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">
            Source completeness
          </h3>
        </div>
        <RiskBadge value={confidence.label} />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">
        {confidence.availableCount} of {confidence.totalCount} source groups
        loaded for this snapshot.
      </p>
      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {confidence.sources.map((source) => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            key={source.label}
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {source.label}
              </p>
              <p className="text-xs text-slate-400">{source.source}</p>
            </div>
            <span
              className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                source.available
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                  : "border-rose-300/30 bg-rose-500/10 text-rose-100"
              }`}
            >
              {source.available ? "Loaded" : "Missing"}
            </span>
          </div>
        ))}
      </div>
      {confidence.caveats.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">
            Caveats
          </p>
          <ul className="mt-2 grid gap-1 text-xs leading-5 text-amber-100">
            {confidence.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ModelDataSourcesPanel({
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
    <section className="mt-5 rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Model Data Sources
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">
            What the app is using
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            These sources feed the dashboard, AI context, and training dataset.
            Some sources affect the current risk index directly; others provide
            explainability and future ML features.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {sources.map((source) => (
          <article
            className="rounded-lg border border-white/10 bg-white/5 p-4"
            key={source.label}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {source.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {source.source}
                </p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                  source.status === "Loaded" || source.status === "Live"
                    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                    : source.status === "Optional"
                    ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                    : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                }`}
              >
                {source.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {source.use}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function equityBadgeClass(level: string) {
  if (level === "High") {
    return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  }

  if (level === "Moderate") {
    return "border-amber-300/40 bg-amber-300/15 text-amber-100";
  }

  if (level === "Low") {
    return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
  }

  return "border-white/15 bg-white/10 text-slate-200";
}

function HealthEquityPanel({
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
    <section className="rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
            Health Equity Overlay
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Structural vulnerability can change what local risk means
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This layer combines current environmental signals with Census ACS
            social determinants and CDC PLACES chronic disease estimates to show
            where heat, pollution, and illness may be harder to avoid or recover
            from.
          </p>
        </div>
        {equityData && (
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Equity vulnerability
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
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
        <p className="mt-5 rounded-lg border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {equityError}
        </p>
      )}

      {!equityData && !equityError && (
        <p className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
          Health equity data will appear here after a ZIP code search.
        </p>
      )}

      {equityData && (
        <>
          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Area summary
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              {equityData.summary}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Census area: {equityData.zctaName} · ZCTA {equityData.zcta}
              {equityData.tractFips
                ? ` · CDC PLACES tract ${equityData.tractFips}`
                : ""}
            </p>
          </div>

          {equityData.cdcPlaces && (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <article className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
                  Chronic burden
                </p>
                <p className="mt-3 text-3xl font-bold text-white">
                  {equityData.cdcPlaces.chronicBurdenScore === null
                    ? "n/a"
                    : `${equityData.cdcPlaces.chronicBurdenScore}/100`}
                </p>
                <p className="mt-2 text-xs leading-5 text-emerald-50/80">
                  Composite from CDC PLACES asthma, COPD, smoking, diabetes,
                  obesity, physical health, and activity estimates.
                </p>
              </article>
              <article className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Respiratory baseline
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Asthma{" "}
                  <span className="font-semibold text-white">
                    {equityData.cdcPlaces.asthma === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.asthma.toFixed(1)}%`}
                  </span>{" "}
                  · COPD{" "}
                  <span className="font-semibold text-white">
                    {equityData.cdcPlaces.copd === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.copd.toFixed(1)}%`}
                  </span>{" "}
                  · Smoking{" "}
                  <span className="font-semibold text-white">
                    {equityData.cdcPlaces.smoking === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.smoking.toFixed(1)}%`}
                  </span>
                </p>
              </article>
              <article className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Metabolic baseline
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Diabetes{" "}
                  <span className="font-semibold text-white">
                    {equityData.cdcPlaces.diabetes === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.diabetes.toFixed(1)}%`}
                  </span>{" "}
                  · Obesity{" "}
                  <span className="font-semibold text-white">
                    {equityData.cdcPlaces.obesity === null
                      ? "n/a"
                      : `${equityData.cdcPlaces.obesity.toFixed(1)}%`}
                  </span>
                </p>
              </article>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {equityData.indicators.map((indicator) => (
              <article
                className="rounded-lg border border-white/10 bg-white/5 p-4"
                key={indicator.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {indicator.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
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
                <p className="mt-4 text-3xl font-bold text-white">
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
            <article className="rounded-lg border border-white/10 bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Heat vulnerability lens
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Current heat risk is <span className="font-semibold">{heatRisk}</span>.
                {heatAmplifiers.length > 0
                  ? ` Poverty or limited vehicle access may make cooling, transportation, or avoiding heat harder in this area.`
                  : " The loaded ACS indicators do not add a strong heat vulnerability signal."}
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pollution burden lens
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Current pollutant risk is{" "}
                <span className="font-semibold">{pollutantRisk}</span>, with{" "}
                {dominantPollutant} as the main signal.
                {pollutionAmplifiers.length > 0
                  ? " Poverty, insurance access, or elevated respiratory baseline estimates may increase the community impact of respiratory exposures."
                  : " The loaded ACS indicators do not add a strong pollution vulnerability signal."}
              </p>
            </article>
          </div>

          <div className="mt-5 rounded-lg border border-amber-300/30 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">
              Next equity layers
            </p>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-amber-100 md:grid-cols-2">
              <p>EPA EJScreen PM2.5 and environmental justice burden</p>
              <p>Tree canopy and heat island vulnerability</p>
              <p>Nearby clinics, hospitals, and transit access</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-xs leading-5 text-slate-400">
            {equityData.caveats.map((caveat) => (
              <p key={caveat}>{caveat}</p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ForecastPanel({
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
  const formatTrendValue = (
    value: number | null,
    unit: string,
    digits = 0
  ) => {
    if (value === null) return "n/a";
    if (unit === "/100") return `${value.toFixed(0)}${unit}`;
    if (unit === "F") return `${value.toFixed(0)}°F`;
    return `${value.toFixed(digits)} ${unit}`;
  };
  const [showHourlyDetails, setShowHourlyDetails] = useState(false);

  return (
    <section className="rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
            Health Risk Forecast
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Predict the best and worst outdoor windows
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This forecast estimates the next 24 hours in {city}, {state} using
            predicted U.S. AQI, PM2.5, ozone, heat index, UV, and pollen.
          </p>
        </div>
        {forecastData && (
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Peak forecast risk
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
              {forecastData.peakScore}/100
            </p>
            <RiskBadge value={exposureLabel(forecastData.peakScore)} />
          </div>
        )}
      </div>

      {forecastError && (
        <p className="mt-5 rounded-lg border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {forecastError}
        </p>
      )}

      {!forecastData && !forecastError && (
        <p className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
          Forecast data will appear here after a ZIP code search.
        </p>
      )}

      {forecastData && (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <article className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Forecast summary
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {forecastData.summary}
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Best outdoor window
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {forecastData.bestWindow?.displayTime ?? "Unavailable"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Estimated risk{" "}
                {forecastData.bestWindow
                  ? `${forecastData.bestWindow.score}/100`
                  : "unavailable"}
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Worst exposure window
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {forecastData.worstWindow?.displayTime ?? "Unavailable"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Estimated risk{" "}
                {forecastData.worstWindow
                  ? `${forecastData.worstWindow.score}/100`
                  : "unavailable"}
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Allergy peak
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {forecastData.allergyPeakWindow?.displayTime ?? "Unavailable"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Pollen{" "}
                {forecastData.allergyPeakScore !== null
                  ? `${forecastData.allergyPeakScore} grains/m3`
                  : "unavailable"}{" "}
                · {forecastData.allergyPeakWindow?.pollenRisk ?? "Unknown"}
              </p>
            </article>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {forecastData.trends.map((trend) => {
              const range =
                trend.max !== null && trend.min !== null
                  ? trend.max - trend.min
                  : 0;

              return (
                <article
                  className="rounded-lg border border-white/10 bg-white/5 p-4"
                  key={trend.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {trend.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {trend.direction} · peak around {trend.peakTime}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold text-slate-200">
                      {formatTrendValue(trend.max, trend.unit, 1)}
                    </span>
                  </div>
                  <div className="mt-4 flex h-14 items-end gap-1">
                    {trend.values.map((value, index) => {
                      const normalized =
                        value === null || trend.min === null || range === 0
                          ? 20
                          : 16 + ((value - trend.min) / range) * 84;

                      return (
                        <div
                          className="flex flex-1 items-end rounded bg-white/5"
                          key={`${trend.label}-${index}`}
                          title={
                            value === null
                              ? "No value"
                              : formatTrendValue(value, trend.unit, 1)
                          }
                        >
                          <div
                            className="w-full rounded bg-emerald-300/80"
                            style={{ height: `${normalized}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Range: {formatTrendValue(trend.min, trend.unit, 1)} to{" "}
                    {formatTrendValue(trend.max, trend.unit, 1)}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/10 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  24-hour forecast curve
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Average forecast risk: {forecastData.averageScore}/100
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Source: Open-Meteo weather and air-quality forecasts
              </p>
            </div>
            <div className="mt-5 grid grid-cols-12 gap-2 lg:[grid-template-columns:repeat(24,minmax(0,1fr))]">
              {forecastData.hours.map((hour) => {
                const explanation = buildForecastHourExplanation(hour);

                return (
                  <div
                    className="group relative flex min-h-36 flex-col justify-end gap-2 outline-none"
                    key={hour.time}
                    tabIndex={0}
                  >
                    <div className="flex h-24 items-end rounded bg-white/5 p-1 transition group-hover:bg-white/10 group-focus:bg-white/10">
                      <div
                        className={`forecast-pulse-bar w-full rounded ${
                          hour.score >= 67
                            ? "bg-rose-400"
                            : hour.score >= 34
                            ? "bg-amber-300"
                            : "bg-emerald-300"
                        }`}
                        style={{ height: `${Math.max(8, hour.score)}%` }}
                      />
                    </div>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a1513] p-3 text-left text-xs shadow-2xl shadow-black/35 group-hover:block group-focus:block">
                      <p className="font-semibold text-white">
                        {hour.displayTime} · {hour.score}/100
                      </p>
                      <p className="mt-1 leading-5 text-slate-300">
                        {explanation.drivers}
                      </p>
                      <p className="mt-2 leading-5 text-slate-400">
                        {explanation.metrics}
                      </p>
                    </div>
                    <p className="truncate text-[10px] leading-4 text-slate-500 group-hover:text-slate-200 group-focus:text-slate-200">
                      {hour.displayTime.replace(/^[A-Za-z]+,?\s?/, "")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Hourly details
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Expand when you want to inspect the underlying forecast
                  values.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHourlyDetails((current) => !current)}
                className="h-10 rounded-lg border border-white/15 px-4 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/10"
              >
                {showHourlyDetails ? "Hide details" : "Show details"}
              </button>
            </div>

            {showHourlyDetails && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {forecastData.hours.slice(0, 12).map((hour) => (
                  <article
                    className="rounded-lg border border-white/10 bg-black/10 p-3"
                    key={hour.time}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {hour.displayTime}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          AQI {hour.usAqi ?? "n/a"} · PM2.5{" "}
                          {hour.pm25?.toFixed(1) ?? "n/a"} · Ozone{" "}
                          {hour.ozone?.toFixed(1) ?? "n/a"} · Feels{" "}
                          {hour.apparentTemperature?.toFixed(0) ?? "n/a"}°F ·
                          UV {hour.uvIndex?.toFixed(1) ?? "n/a"} · Pollen{" "}
                          {hour.pollenIndex ?? "n/a"} ({hour.pollenRisk})
                        </p>
                      </div>
                      <RiskBadge value={hour.risk} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {hour.drivers.length > 0
                        ? hour.drivers.join(", ")
                        : "No major forecast driver."}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
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
    return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  }

  if (score >= 34) {
    return "border-amber-300/40 bg-amber-300/15 text-amber-100";
  }

  return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
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
    <section className="rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
            Exposure Timeline
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Estimate how today&apos;s routine changes exposure
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Each block can use the current {city}, {state} snapshot or a
            different ZIP code, then adjusts exposure by time, indoor/outdoor
            setting, and activity intensity.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
            Estimated day score
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {dailyScore}/100
          </p>
          <RiskBadge value={exposureLabel(dailyScore)} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Local signals used
          </p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-200">
            <p>Base risk index: {baseScore}/100</p>
            <p>Default ZIP: {zipCode}</p>
            <p>Overall risk: {healthRisk}</p>
            <p>Respiratory risk: {respiratoryRisk}</p>
            <p>Air quality: {airQuality}</p>
            <p>Heat: {heatRisk}</p>
            <p>UV: {uvRisk}</p>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Highest exposure block
          </p>
          <p className="mt-3 text-lg font-semibold text-white">
            {highestBlock?.label ?? "Unavailable"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {highestBlock
              ? `${highestBlock.start}-${highestBlock.end}, ${highestBlock.snapshot.city}, ${highestBlock.snapshot.state}, ${highestBlock.setting.toLowerCase()}, ${highestBlock.intensity.toLowerCase()} intensity.`
              : "Add a timeline block to estimate exposure."}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Outdoor suggestion
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {safestOutdoorBlock
              ? `${safestOutdoorBlock.label} in ${safestOutdoorBlock.snapshot.city}, ${safestOutdoorBlock.snapshot.state} is currently the lowest outdoor exposure block in this schedule.`
              : "Add an outdoor block to compare outdoor exposure windows."}
          </p>
        </div>
      </div>

      {timelineError && (
        <p className="mt-5 rounded-lg border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {timelineError}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {timeline.map((block) => (
          <article
            className="rounded-lg border border-white/10 bg-white/5 p-4"
            key={block.id}
          >
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Activity
                <input
                  value={block.label}
                  onChange={(event) =>
                    updateBlock(block.id, "label", event.target.value)
                  }
                  className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-emerald-300"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                ZIP
                <input
                  inputMode="numeric"
                  value={block.zipCode}
                  onChange={(event) =>
                    updateBlock(block.id, "zipCode", event.target.value)
                  }
                  className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal tracking-normal text-white outline-none focus:border-emerald-300"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Start
                <input
                  type="time"
                  value={block.start}
                  onChange={(event) =>
                    updateBlock(block.id, "start", event.target.value)
                  }
                  className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal tracking-normal text-white outline-none focus:border-emerald-300"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                End
                <input
                  type="time"
                  value={block.end}
                  onChange={(event) =>
                    updateBlock(block.id, "end", event.target.value)
                  }
                  className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal tracking-normal text-white outline-none focus:border-emerald-300"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                  className="h-11 rounded-lg border border-white/15 bg-[#12322c] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-emerald-300"
                >
                  <option>Indoors</option>
                  <option>Outdoors</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                  className="h-11 rounded-lg border border-white/15 bg-[#12322c] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-emerald-300"
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
                className="h-11 rounded-lg bg-teal-500 px-3 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {loadingBlockId === block.id ? "Loading" : "Load ZIP"}
              </button>
              <button
                type="button"
                onClick={() => removeBlock(block.id)}
                className="h-11 rounded-lg border border-white/15 px-3 text-sm font-semibold text-slate-200 transition hover:border-rose-300/50 hover:bg-rose-500/10"
              >
                Remove
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-300 md:grid-cols-3">
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
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-400"
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
          className="h-12 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-400"
        >
          Add timeline block
        </button>
        <p className="text-xs leading-5 text-slate-400">
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
    <section className="rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
            AI Health Plan
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Turn this dashboard into a daily action plan
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This uses the current ZIP code, risk model drivers, public health
            signals, local news, and your saved profile context when available.
          </p>
        </div>
        <button
          type="button"
          onClick={generatePlan}
          disabled={loadingPlan}
          className="h-12 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {loadingPlan ? "Generating" : plan ? "Refresh plan" : "Generate plan"}
        </button>
      </div>

      {planError && (
        <p className="mt-5 rounded-lg border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {planError}
        </p>
      )}

      {!plan && !planError && (
        <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm leading-6 text-slate-300">
            Generate a plan when you want the AI to synthesize the current
            dashboard into plain-English next steps. This may use a small amount
            of your OpenAI API credits.
          </p>
        </div>
      )}

      {plan && (
        <div className="mt-5 grid gap-4">
          <article className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              {plan.headline}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-100">
              {plan.summary}
            </p>
          </article>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Today&apos;s priority
              </p>
              <p className="mt-3 text-base leading-7 text-white">
                {plan.priority}
              </p>
            </article>

            <article className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Watch list
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-200">
                {plan.watch.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>

          <article className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Suggested actions
            </p>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {plan.actions.map((item) => (
                <li
                  className="rounded-lg border border-white/10 bg-black/10 p-3 text-sm leading-6 text-slate-200"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <p className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            {plan.uncertainty} This is informational only and is not medical
            advice.
          </p>
        </div>
      )}
    </section>
  );
}

function SymptomCheckinPanel({
  user,
  zipCode,
  latestSnapshot,
  snapshotStatus,
}: {
  user: User | null;
  zipCode: string;
  latestSnapshot: SavedHealthSnapshot | null;
  snapshotStatus: string;
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
    "h-4 w-4 rounded border-white/20 bg-white/10 text-teal-400";

  return (
    <section className="rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
            Symptom Check-in
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            How are you feeling today?
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This optional check-in helps connect today&apos;s local conditions
            with how people actually feel. Your responses can improve future
            risk estimates.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
          Snapshot: {latestSnapshot ? "linked" : "not saved yet"}
        </div>
      </div>

      {snapshotStatus && (
        <p className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-300">
          {snapshotStatus}
        </p>
      )}

      {!user && (
        <p className="mt-5 rounded-lg border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
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
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200"
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

        <label className="grid gap-2 text-sm font-semibold text-slate-300">
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

        <label className="grid gap-2 text-sm font-semibold text-slate-300">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context, such as outdoor time or symptoms noticed."
            className="min-h-24 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-normal text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={saving || !user}
            className="h-12 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {saving ? "Saving" : "Save check-in"}
          </button>
          <p className="text-xs leading-5 text-slate-400">
            Do not enter urgent symptoms here. Seek medical care for serious
            symptoms.
          </p>
        </div>

        {message && (
          <p className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
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
    <section className="mt-5 rounded-lg border border-emerald-300/20 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
            Health Assistant
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">
            Ask about {context.city}, {context.state}
          </h3>
        </div>
        <p className="text-sm text-slate-400">
          Uses this dashboard&apos;s data and local news context
        </p>
      </div>

      <div className="mt-5 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-black/15 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg border p-3 ${
              message.role === "user"
                ? "ml-auto max-w-[85%] border-amber-300/30 bg-amber-500/15 text-amber-50"
                : "mr-auto max-w-[90%] border-emerald-300/20 bg-emerald-400/10 text-slate-100"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {message.role === "user" ? "You" : "MyLocalHealth"}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {message.content}
            </p>
          </div>
        ))}
        {chatLoading && (
          <p className="text-sm text-slate-300">
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
          className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-teal-300/20"
        />
        <button
          type="submit"
          disabled={chatLoading}
          className="h-12 rounded-lg bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {chatLoading ? "Asking" : "Ask"}
        </button>
      </form>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        This assistant is informational only and is not medical advice. Avoid
        entering sensitive personal medical details here.
      </p>
    </section>
  );
}

export default function Home() {
  const restoredZipRef = useRef("");
  const [user, setUser] = useState<User | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [searched, setSearched] = useState(false);
  const [dashboardView, setDashboardView] =
    useState<DashboardView>("overview");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [aqi, setAqi] = useState<number | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [equityError, setEquityError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [fluActivity, setFluActivity] = useState("Unknown");
  const [covidData, setCovidData] =
    useState<CovidActivityData | null>(null);
  const [environmentData, setEnvironmentData] =
    useState<EnvironmentData | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>(
    []
  );
  const [airComponents, setAirComponents] =
    useState<Record<string, number>>();
  const [localNews, setLocalNews] = useState<LocalHealthNewsArticle[]>(
    []
  );
  const [healthEquityData, setHealthEquityData] =
    useState<HealthEquityData | null>(null);
  const [healthForecastData, setHealthForecastData] =
    useState<HealthForecastData | null>(null);
  const [latestSnapshot, setLatestSnapshot] =
    useState<SavedHealthSnapshot | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    airQuality: false,
    pollutants: false,
    heatUv: false,
    weatherAlerts: false,
    flu: false,
    covid: false,
    news: false,
  });

  const covidActivity = covidData?.activity ?? "Unknown";
  const heatRisk = getHeatRiskLabel(
    environmentData?.apparentTemperatureMax ??
      environmentData?.apparentTemperature ??
      null
  );
  const uvRisk = getUvRiskLabel(environmentData?.uvIndexMax ?? null);
  const alertRisk = summarizeAlertRisk(weatherAlerts);
  const pollutantRisk = getPollutantRiskLabel(airComponents);
  const dominantPollutant = getDominantPollutant(airComponents);
  const airQualityLabel = getAirQualityLabel(aqi);
  const riskModel = evaluateRiskModel({
    aqi,
    airQualityLabel,
    pollutantRisk,
    heatRisk,
    uvRisk,
    alertRisk,
    fluActivity,
    covidActivity,
    covidCoverage: covidData?.coverage ?? "Unknown",
    dataStatus,
    profile: userProfile,
  });
  const healthRisk = riskModel.healthRisk;
  const respiratoryRisk = riskModel.respiratoryRisk;
  const personalizationSummary = riskModel.personalizationSummary;
  const scoreBreakdown = riskModel.scoreBreakdown;
  const dataConfidence = riskModel.dataConfidence;
  const latitudeValue = Number(latitude);
  const longitudeValue = Number(longitude);
  const hasMapLocation =
    !Number.isNaN(latitudeValue) && !Number.isNaN(longitudeValue);
  const mapUrl = hasMapLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        longitudeValue - 0.08
      }%2C${latitudeValue - 0.05}%2C${longitudeValue + 0.08}%2C${
        latitudeValue + 0.05
      }&layer=mapnik&marker=${latitudeValue}%2C${longitudeValue}`
    : "";
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

    setZipCode(zipToSearch);
    setError("");
    setNewsError("");
    setEquityError("");
    setForecastError("");
    setLocalNews([]);
    setHealthEquityData(null);
    setHealthForecastData(null);
    setLatestSnapshot(null);
    setSnapshotStatus("");
    setEnvironmentData(null);
    setWeatherAlerts([]);
    setAirComponents(undefined);
    setDataStatus({
      airQuality: false,
      pollutants: false,
      heatUv: false,
      weatherAlerts: false,
      flu: false,
      covid: false,
      news: false,
    });
    setSearched(false);
    setDashboardView(nextView);
    setLoading(true);

    try {
      const location = await getLocation(zipToSearch);

      setCity(location.city);
      setState(location.state);
      setLatitude(location.latitude);
      setLongitude(location.longitude);

      const fluData = await getFluData(location.state).catch((error) => {
        console.error("Flu data unavailable", error);
        return "Unknown";
      });
      setFluActivity(fluData);
      setDataStatus((current) => ({
        ...current,
        flu: fluData !== "Unknown",
      }));

      const covidActivityData = await getCovidData(location.state).catch(
        (error) => {
          console.error("COVID wastewater data unavailable", error);
          return unknownCovidData;
        }
      );
      setCovidData(covidActivityData);
      setDataStatus((current) => ({
        ...current,
        covid: covidActivityData.activity !== "Unknown",
      }));

      const [airData, environment, alerts, forecast] = await Promise.all([
        getAirQuality(location.latitude, location.longitude).catch(
          (error) => {
            console.error("Air quality data unavailable", error);
            return {} as AirQualityData;
          }
        ),
        getEnvironmentData(location.latitude, location.longitude).catch(
          (error) => {
            console.error("Heat and UV data unavailable", error);
            return {
              temperature: null,
              apparentTemperature: null,
              humidity: null,
              uvIndexMax: null,
              temperatureMax: null,
              apparentTemperatureMax: null,
            };
          }
        ),
        getWeatherAlerts(location.latitude, location.longitude).catch(
          (error) => {
            console.error("Weather alerts unavailable", error);
            return [];
          }
        ),
        getHealthForecast(location.latitude, location.longitude).catch(
          (error) => {
            setForecastError(
              error instanceof Error
                ? error.message
                : "Forecast data is temporarily unavailable."
            );
            return null;
          }
        ),
      ]);

      setAqi(airData.list?.[0]?.main.aqi ?? null);
      setAirComponents(airData.list?.[0]?.components);
      setEnvironmentData(environment);
      setWeatherAlerts(alerts);
      setHealthForecastData(forecast);
      setDataStatus((current) => ({
        ...current,
        airQuality: airData.list?.[0]?.main.aqi !== undefined,
        pollutants: Boolean(airData.list?.[0]?.components),
        heatUv:
          environment.apparentTemperature !== null ||
          environment.apparentTemperatureMax !== null ||
          environment.uvIndexMax !== null,
        weatherAlerts: true,
      }));
      setSearched(true);
      restoredZipRef.current = zipToSearch;

      if (options.updateUrl !== false && typeof window !== "undefined") {
        window.history.pushState(
          { zipCode: zipToSearch, view: nextView },
          "",
          getDashboardUrl(zipToSearch, nextView)
        );
      }

      let loadedEquityData: HealthEquityData | null = null;

      try {
        const equityData = await getHealthEquityData(
          zipToSearch,
          location.latitude,
          location.longitude
        );
        setHealthEquityData(equityData);
        loadedEquityData = equityData;
      } catch (error) {
        setEquityError(
          error instanceof Error
            ? error.message
            : "Health equity data is temporarily unavailable."
        );
      }

      if (user) {
        const nextAqi = airData.list?.[0]?.main.aqi ?? null;
        const nextAirQualityLabel = getAirQualityLabel(nextAqi);
        const nextAirComponents = airData.list?.[0]?.components;
        const nextPollutantRisk = getPollutantRiskLabel(nextAirComponents);
        const nextDominantPollutant =
          getDominantPollutant(nextAirComponents);
        const nextHeatRisk = getHeatRiskLabel(
          environment.apparentTemperatureMax ??
            environment.apparentTemperature ??
            null
        );
        const nextUvRisk = getUvRiskLabel(environment.uvIndexMax ?? null);
        const nextAlertRisk = summarizeAlertRisk(alerts);
        const nextRiskModel = evaluateRiskModel({
          aqi: nextAqi,
          airQualityLabel: nextAirQualityLabel,
          pollutantRisk: nextPollutantRisk,
          heatRisk: nextHeatRisk,
          uvRisk: nextUvRisk,
          alertRisk: nextAlertRisk,
          fluActivity: fluData,
          covidActivity: covidActivityData.activity,
          covidCoverage: covidActivityData.coverage,
          dataStatus: {
            airQuality: nextAqi !== null,
            pollutants: Boolean(nextAirComponents),
            heatUv: true,
            weatherAlerts: true,
            flu: true,
            covid: true,
            news: false,
          },
          profile: userProfile,
        });

        try {
          const snapshot = await saveHealthSnapshot({
            userId: user.id,
            zipCode: zipToSearch,
            city: location.city,
            state: location.state,
            latitude: location.latitude,
            longitude: location.longitude,
            modelVersion: nextRiskModel.modelVersion,
            modelScore: nextRiskModel.scoreBreakdown.score,
            healthRisk: nextRiskModel.healthRisk,
            respiratoryRisk: nextRiskModel.respiratoryRisk,
            airQuality: nextAirQualityLabel,
            aqi: nextAqi,
            dominantPollutant: nextDominantPollutant,
            pollutantRisk: nextPollutantRisk,
            heatRisk: nextHeatRisk,
            uvRisk: nextUvRisk,
            alertRisk: nextAlertRisk,
            fluActivity: fluData,
            covidActivity: covidActivityData.activity,
            covidCoverage: covidActivityData.coverage,
            forecastAverageScore: forecast?.averageScore ?? null,
            forecastPeakScore: forecast?.peakScore ?? null,
            forecastBestWindow:
              forecast?.bestWindow?.displayTime ?? null,
            forecastWorstWindow:
              forecast?.worstWindow?.displayTime ?? null,
            forecastAllergyPeakScore:
              forecast?.allergyPeakScore ?? null,
            forecastAllergyPeakWindow:
              forecast?.allergyPeakWindow?.displayTime ?? null,
            forecastPollenRisk:
              forecast?.allergyPeakWindow?.pollenRisk ?? null,
            equityScore: loadedEquityData?.equityScore ?? null,
            equityLevel: loadedEquityData?.equityLevel ?? null,
            placesChronicBurdenScore:
              loadedEquityData?.cdcPlaces?.chronicBurdenScore ?? null,
            placesAsthma: loadedEquityData?.cdcPlaces?.asthma ?? null,
            placesCopd: loadedEquityData?.cdcPlaces?.copd ?? null,
            placesSmoking: loadedEquityData?.cdcPlaces?.smoking ?? null,
            placesObesity: loadedEquityData?.cdcPlaces?.obesity ?? null,
            placesDiabetes: loadedEquityData?.cdcPlaces?.diabetes ?? null,
            profileSummary: nextRiskModel.personalizationSummary,
          });
          setLatestSnapshot(snapshot);
          setSnapshotStatus("Today's local conditions were saved for this check-in.");
        } catch (error) {
          setSnapshotStatus(
            error instanceof Error
              ? `Snapshot not saved: ${error.message}`
              : "Snapshot not saved."
          );
        }
      }

      setNewsLoading(true);
      try {
        const news = await getLocalHealthNews(
          location.city,
          location.state
        );
        setLocalNews(news);
        setDataStatus((current) => ({ ...current, news: true }));
      } catch {
        setNewsError(
          "Local health news is temporarily unavailable."
        );
      } finally {
        setNewsLoading(false);
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Unable to retrieve health data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const restoredZipCode = params.get("zipCode");
      const viewParam = params.get("view");
      const restoredView: DashboardView = isDashboardView(viewParam)
        ? viewParam
        : "overview";

      if (!restoredZipCode) {
        restoredZipRef.current = "";
        setSearched(false);
        setDashboardView("overview");
        setError("");
        setZipCode("");
        return;
      }

      if (restoredZipCode !== restoredZipRef.current) {
        restoredZipRef.current = restoredZipCode;
        setZipCode(restoredZipCode);
        void searchZipCode(restoredZipCode, {
          updateUrl: false,
          view: restoredView,
        });
        return;
      }

      setDashboardView(restoredView);
    };

    restoreFromUrl();
    window.addEventListener("popstate", restoreFromUrl);

    return () => {
      window.removeEventListener("popstate", restoreFromUrl);
    };
    // This restores shared URLs and browser Back/Forward without re-triggering searches unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        void loadUserProfile(data.user.id);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          void loadUserProfile(nextUser.id);
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await searchZipCode(zipCode);
  };

  const navigateDashboardView = (view: DashboardView) => {
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
    setSearched(false);
    setDashboardView("overview");
    setError("");
    setLoading(false);
    setZipCode("");
    restoredZipRef.current = "";

    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <main className="public-health-bg min-h-screen text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header
          className={`border-b border-white/10 ${
            searched ? "pb-4" : "pb-0"
          }`}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center">
                <Link
                  href="/"
                  onClick={(event) => {
                    event.preventDefault();
                    resetToHome();
                  }}
                  className="flex w-fit items-center gap-3 text-white"
                  aria-label="MyLocalHealth home"
                >
                  <Image
                    src="/mylocalhealth-icon-white.png"
                    alt=""
                    width={154}
                    height={123}
                    priority
                    className={`h-auto shrink-0 drop-shadow-[0_10px_26px_rgba(0,0,0,0.35)] ${
                      searched ? "w-11" : "w-14 sm:w-16"
                    }`}
                  />
                  <span
                    className={`font-bold tracking-normal text-white ${
                      searched ? "text-2xl" : "text-4xl sm:text-5xl"
                    }`}
                  >
                    MyLocalHealth
                  </span>
                </Link>
              </div>
              {!searched && (
                <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/80">
                  Local public-health forecasts from air, heat, pollen,
                  illness, equity, and community data.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {searched && (
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
                    className="h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-teal-300/20"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 rounded-lg bg-teal-500 px-4 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {loading ? "..." : "Search"}
                  </button>
                </form>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/account"
                  className="w-fit rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/10"
                >
                  {user ? "Account" : "Sign in"}
                </Link>
                {!user && (
                  <Link
                    href="/signup"
                    className="w-fit rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
                  >
                    Sign up
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {searched && (
          <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1412]/88 pt-4 backdrop-blur-xl">
            <DashboardNav
              activeView={dashboardView}
              onChange={navigateDashboardView}
            />
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-rose-300/30 bg-rose-500/10 p-4 text-sm font-medium text-rose-100">
            {error}
          </div>
        )}

        {!searched && !error && (
          <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
            <div className="max-w-2xl text-left">
              <p className="eyebrow-text">Ready when you are</p>
              <h2 className="display-heading mt-3 text-5xl leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                See what could affect your health near home today.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                Enter a ZIP code for a plain-language read on air quality,
                heat, pollen, respiratory illness, local context, and what to
                watch next.
              </p>
              <form
                onSubmit={handleSearch}
                className="quiet-surface mt-8 flex w-full max-w-xl flex-col gap-3 rounded-lg p-3 sm:flex-row"
              >
                <label className="sr-only" htmlFor="zip-code">
                  ZIP code
                </label>
                <input
                  id="zip-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter ZIP code"
                  value={zipCode}
                  onChange={(event) => setZipCode(event.target.value)}
                  className="h-14 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-4 text-base text-white shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-teal-300/20"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="h-14 rounded-lg bg-teal-500 px-6 text-sm font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {loading ? "Searching" : "Search"}
                </button>
              </form>
              <LiveSignalTape />
            </div>

            <div className="min-w-0">
              <AnimatedHealthMapGraphic />
            </div>
          </section>
        )}

        {searched && (
          <section className="py-8">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Results for {zipCode}
                </p>
                <h2 className="mt-1 text-3xl font-bold text-white">
                  {city}, {state}
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                Informational only, not medical advice.
              </p>
            </div>

            {dashboardView === "overview" && (
              <>
                <section className="editorial-surface rounded-lg p-6 sm:p-7">
                  <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
                    <div>
                      <p className="eyebrow-text">
                        Today&apos;s Local Health Forecast
                      </p>
                      <h3 className="display-heading mt-3 max-w-4xl text-4xl leading-tight text-white sm:text-5xl">
                        {healthBrief.headline}
                      </h3>
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                        MyLocalHealth combines local air quality, heat, UV,
                        pollen, flu activity, COVID wastewater, weather alerts,
                        health equity context, and your profile when available.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-emerald-100">
                        {personalizationSummary}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => navigateDashboardView("forecast")}
                          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
                        >
                          View forecast
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateDashboardView("plan")}
                          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/10"
                        >
                          Generate AI plan
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateDashboardView("assistant")}
                          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/10"
                        >
                          Ask a question
                        </button>
                      </div>
                    </div>

                    <div className="inset-surface rounded-lg p-5">
                      <p className="text-xs font-semibold text-slate-400">
                        Overall Risk
                      </p>
                      <p className="mt-3 text-6xl font-bold text-white">
                        {healthRisk}
                      </p>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-400"
                          style={{ width: `${scoreBreakdown.score}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Risk index {scoreBreakdown.score}/100 ·{" "}
                        {riskModel.modelVersion}
                      </p>
                      {riskModel.isPersonalized && (
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          Base environmental risk: {riskModel.baseHealthRisk}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <ForecastPulseStrip forecastData={healthForecastData} />

                <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                  <article className="quiet-surface rounded-lg p-5">
                    <p className="text-sm font-semibold text-slate-300">
                      Best Window Today
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {healthForecastData?.bestWindow?.displayTime ??
                        "Unavailable"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {healthForecastData?.bestWindow
                        ? `Estimated exposure risk ${healthForecastData.bestWindow.score}/100.`
                        : "Run a ZIP search with forecast data available to see the lowest-risk window."}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="inset-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-400">
                          Watch Window
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {healthForecastData?.worstWindow?.displayTime ??
                            "Unavailable"}
                        </p>
                      </div>
                      <div className="inset-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-400">
                          Allergy Peak
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {healthForecastData?.allergyPeakWindow
                            ? `${healthForecastData.allergyPeakWindow.displayTime} · ${healthForecastData.allergyPeakWindow.pollenRisk}`
                            : "Unavailable"}
                        </p>
                      </div>
                    </div>
                  </article>

                  <article className="quiet-surface rounded-lg p-5">
                    <p className="text-sm font-semibold text-slate-300">
                      Suggested Focus
                    </p>
                    <div className="mt-3 grid gap-3">
                      {healthBrief.focusItems.map((item) => (
                        <p
                          className="border-l border-emerald-300/40 bg-white/[0.03] py-2 pl-3 text-left text-sm leading-6 text-slate-200"
                          key={item}
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                    <p className="mt-4 border-l border-emerald-300/40 bg-emerald-400/10 py-3 pl-3 text-left text-xs leading-5 text-emerald-100">
                      {healthBrief.profileNote}
                    </p>
                  </article>
                </section>

                <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="quiet-surface rounded-lg p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-300">
                          Top Reasons
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-white">
                          What is driving today&apos;s reading
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateDashboardView("model")}
                        className="shrink-0 text-xs font-semibold text-teal-100 hover:text-white"
                      >
                        See model
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {scoreBreakdown.topDrivers.slice(0, 4).map((driver) => (
                        <div
                          className="border-b border-white/10 py-3 last:border-b-0"
                          key={driver.label}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">
                              {driver.label}
                            </p>
                            <p className="text-sm font-semibold text-emerald-100">
                              +{driver.points}
                            </p>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {driver.detail}
                          </p>
                        </div>
                      ))}
                      {scoreBreakdown.topDrivers.length === 0 && (
                        <p className="border-l border-white/15 py-3 pl-3 text-sm leading-6 text-slate-300">
                          No single driver is elevated right now.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="quiet-surface rounded-lg p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-300">
                          Why It Matters Locally
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-white">
                          Equity and baseline health context
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateDashboardView("equity")}
                        className="shrink-0 text-xs font-semibold text-teal-100 hover:text-white"
                      >
                        See context
                      </button>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">
                      {healthEquityData
                        ? healthEquityData.summary
                        : "Health equity context is still loading or unavailable for this ZIP code."}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="inset-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-400">
                          Equity Score
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {healthEquityData
                            ? `${healthEquityData.equityScore}/100`
                            : "n/a"}
                        </p>
                      </div>
                      <div className="inset-surface rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-400">
                          Chronic Burden
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
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
                  <section className="quiet-surface mt-5 overflow-hidden rounded-lg">
                    <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Search Location
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-white">
                          {city}, {state}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-400">
                        ZIP {zipCode} · {latitude}, {longitude}
                      </p>
                    </div>
                    <iframe
                      title={`Map centered on ${city}, ${state}`}
                      src={mapUrl}
                      className="h-80 w-full border-0"
                      loading="lazy"
                    />
                  </section>
                )}
              </>
            )}

            {dashboardView === "model" && (
              <>
            <RiskTransparencyPanel
              score={scoreBreakdown.score}
              items={scoreBreakdown.items}
              topDrivers={scoreBreakdown.topDrivers}
              categoryScores={scoreBreakdown.categoryScores}
              methodology={riskModel.methodology}
            />
                <DataConfidencePanel confidence={dataConfidence} />
                <ModelDataSourcesPanel
                  forecastData={healthForecastData}
                  equityData={healthEquityData}
                />
              </>
            )}

            {dashboardView === "plan" && (
              <AiHealthPlanPanel planContext={healthPlanContext} />
            )}

            {dashboardView === "forecast" && (
              <ForecastPanel
                forecastData={healthForecastData}
                forecastError={forecastError}
                city={city}
                state={state}
              />
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
            <section className="mt-5 rounded-lg border border-white/10 bg-[#0f211d]/90 p-5 shadow-xl shadow-black/25">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Local Health News
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    Recent health-related articles near {city}, {state}
                  </h3>
                </div>
                <p className="text-sm text-slate-400">
                  Sources: GDELT and Google News RSS
                </p>
              </div>

              {newsLoading && (
                <p className="mt-5 text-sm text-slate-300">
                  Searching recent local health news...
                </p>
              )}

              {newsError && (
                <p className="mt-5 rounded-lg border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {newsError}
                </p>
              )}

              {!newsLoading && !newsError && localNews.length === 0 && (
                <p className="mt-5 text-sm leading-6 text-slate-300">
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
                      className="rounded-lg border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/10"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-200">
                        {article.source}
                      </p>
                      <h4 className="mt-2 text-base font-semibold leading-6 text-white">
                        {article.title}
                      </h4>
                      <p className="mt-3 text-sm text-slate-400">
                        {article.publishedAt} · {article.language}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </section>
            )}

            {dashboardView === "assistant" && (
            <HealthChatPanel context={chatContext} />
            )}
          </section>
        )}
      </section>
    </main>
  );
}
