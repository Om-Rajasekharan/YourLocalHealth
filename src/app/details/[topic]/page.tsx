"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { stateRegionMap } from "../../../lib/regions";
import {
  getWastewaterTrends,
  type WastewaterPathogen,
  type WastewaterTrendPoint,
} from "../../../services/wastewaterTrends";

type DetailContent = {
  title: string;
  eyebrow: string;
  value: string;
  summary: string;
  source: string;
  rows: { label: string; value: string }[];
  interpretation: string;
};

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: string, suffix = "") {
  const parsed = parseNumber(value);
  return parsed === null ? "Unavailable" : `${parsed.toFixed(1)}${suffix}`;
}

function meterPercent(value: number | null, max: number) {
  if (value === null) return 0;
  return Math.min(Math.max((value / max) * 100, 0), 100);
}

function RiskMeter({
  label,
  value,
  max,
  ticks,
  unit,
}: {
  label: string;
  value: number | null;
  max: number;
  ticks: { label: string; at: number }[];
  unit?: string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Visual Reading
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {label}
          </h2>
        </div>
        <p className="text-2xl font-bold text-white">
          {value === null ? "Unavailable" : `${value.toFixed(1)}${unit ?? ""}`}
        </p>
      </div>

      <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400"
          style={{ width: `${meterPercent(value, max)}%` }}
        />
      </div>
      <div className="relative mt-3 h-9">
        {ticks.map((tick) => (
          <div
            className="absolute top-0 -translate-x-1/2 text-center"
            key={tick.label}
            style={{ left: `${meterPercent(tick.at, max)}%` }}
          >
            <span className="block h-2 w-px bg-white/30" />
            <span className="mt-1 block whitespace-nowrap text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">
              {tick.label}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function TopicVisualization({
  topic,
  heatIndex,
  heatIndexMax,
  uvIndex,
  alertNames,
  dominantPollutant,
  pollutantRisk,
}: {
  topic: string;
  heatIndex: number | null;
  heatIndexMax: number | null;
  uvIndex: number | null;
  alertNames: string[];
  dominantPollutant: string;
  pollutantRisk: string;
}) {
  if (topic === "heat-risk") {
    return (
      <RiskMeter
        label="Daily max feels-like temperature"
        value={heatIndexMax ?? heatIndex}
        max={115}
        unit="°F"
        ticks={[
          { label: "Low", at: 80 },
          { label: "Moderate", at: 90 },
          { label: "High", at: 103 },
        ]}
      />
    );
  }

  if (topic === "uv-risk") {
    return (
      <RiskMeter
        label="Daily maximum UV index"
        value={uvIndex}
        max={11}
        ticks={[
          { label: "Low", at: 2 },
          { label: "Moderate", at: 6 },
          { label: "High", at: 8 },
        ]}
      />
    );
  }

  if (topic === "weather-alerts") {
    return (
      <article className="rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Active Alert Events
        </p>
        {alertNames.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {alertNames.map((alert) => (
              <span
                className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-3 py-1 text-sm font-semibold text-fuchsia-100"
                key={alert}
              >
                {alert}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-300">
            No active National Weather Service alerts were found for this
            point when the dashboard was generated.
          </p>
        )}
      </article>
    );
  }

  if (topic === "air-quality") {
    return (
      <article className="rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pollutant Context
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {dominantPollutant}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This is the pollutant signal closest to its moderate-risk threshold
          among the pollutants available from the air quality API.
        </p>
        <div className="mt-4">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getRiskTone(
              pollutantRisk
            )}`}
          >
            Pollutant risk: {pollutantRisk}
          </span>
        </div>
      </article>
    );
  }

  return null;
}

function getRiskTone(value: string) {
  switch (value) {
    case "Low":
    case "Very Low":
    case "Fair":
    case "Good":
    case "Standard Coverage":
      return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
    case "Moderate":
    case "Limited Coverage":
      return "border-violet-300/40 bg-violet-400/10 text-violet-200";
    case "High":
    case "Very High":
    case "Poor":
    case "Very Poor":
      return "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-200";
    default:
      return "border-white/15 bg-white/10 text-slate-200";
  }
}

function titleFromTopic(topic: string) {
  return topic
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function TrendChart({
  points,
  region,
  pathogenLabel,
}: {
  points: WastewaterTrendPoint[];
  region: string;
  pathogenLabel: string;
}) {
  const [weeksShown, setWeeksShown] = useState(26);
  const visiblePoints = useMemo(
    () => points.slice(Math.max(points.length - weeksShown, 0)),
    [points, weeksShown]
  );
  const maxValue = Math.max(
    1,
    ...visiblePoints.flatMap((point) => [
      point.nationalValue,
      point.regionalValue,
    ])
  );
  const chartWidth = 720;
  const chartHeight = 260;
  const padding = 36;
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = chartHeight - padding * 2;

  const getX = (index: number) => {
    if (visiblePoints.length <= 1) return padding;
    return padding + (index / (visiblePoints.length - 1)) * plotWidth;
  };

  const getY = (value: number) =>
    padding + plotHeight - (value / maxValue) * plotHeight;

  const buildPoints = (key: "regionalValue" | "nationalValue") =>
    visiblePoints
      .map((point, index) => `${getX(index)},${getY(point[key])}`)
      .join(" ");

  const latestPoint = visiblePoints[visiblePoints.length - 1];
  const earliestPoint = visiblePoints[0];

  return (
    <article className="mt-5 rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Historical Trend
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {pathogenLabel} wastewater activity over time
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Weekly CDC wastewater viral activity levels for the {region} region
            compared with the national trend.
          </p>
        </div>
        {latestPoint && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <p className="font-semibold text-white">
              Latest {region}: {latestPoint.regionalCategory}
            </p>
            <p className="mt-1 text-slate-400">{latestPoint.weekEnd}</p>
          </div>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#080d22] p-3">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-72 w-full"
          role="img"
          aria-label={`${pathogenLabel} wastewater trend chart`}
        >
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke="#475569"
          />
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke="#475569"
          />
          {[0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={padding}
                x2={chartWidth - padding}
                y1={padding + plotHeight - plotHeight * tick}
                y2={padding + plotHeight - plotHeight * tick}
                stroke="#1e293b"
              />
              <text
                fill="#94a3b8"
                fontSize="11"
                textAnchor="end"
                x={padding - 8}
                y={padding + plotHeight - plotHeight * tick + 4}
              >
                {(maxValue * tick).toFixed(1)}
              </text>
            </g>
          ))}
          <polyline
            fill="none"
            points={buildPoints("nationalValue")}
            stroke="#a78bfa"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <polyline
            fill="none"
            points={buildPoints("regionalValue")}
            stroke="#22d3ee"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {latestPoint && (
            <circle
              cx={getX(visiblePoints.length - 1)}
              cy={getY(latestPoint.regionalValue)}
              fill="#22d3ee"
              r="5"
            />
          )}
          <text
            fill="#94a3b8"
            fontSize="12"
            x={padding}
            y={chartHeight - 10}
          >
            {earliestPoint?.weekEnd}
          </text>
          <text
            fill="#94a3b8"
            fontSize="12"
            textAnchor="end"
            x={chartWidth - padding}
            y={chartHeight - 10}
          >
            {latestPoint?.weekEnd}
          </text>
          <text
            fill="#e2e8f0"
            fontSize="13"
            fontWeight="600"
            textAnchor="middle"
            x={chartWidth / 2}
            y={chartHeight - 10}
          >
            Week ending
          </text>
          <text
            fill="#e2e8f0"
            fontSize="13"
            fontWeight="600"
            textAnchor="middle"
            transform={`rotate(-90 ${14} ${chartHeight / 2})`}
            x={14}
            y={chartHeight / 2}
          >
            Wastewater viral activity level
          </text>
        </svg>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <label className="text-sm font-medium text-slate-200">
          Weeks shown: {weeksShown}
          <input
            type="range"
            min="8"
            max={Math.max(points.length, 8)}
            value={weeksShown}
            onChange={(event) => setWeeksShown(Number(event.target.value))}
            className="mt-2 block w-full accent-cyan-300"
          />
        </label>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-2 text-cyan-200">
            <span className="h-1.5 w-6 rounded-full bg-cyan-300" />
            {region}
          </span>
          <span className="inline-flex items-center gap-2 text-violet-200">
            <span className="h-1.5 w-6 rounded-full bg-violet-400" />
            National
          </span>
        </div>
      </div>
    </article>
  );
}

function WastewaterTrendSection({
  topic,
  stateAbbreviation,
}: {
  topic: string;
  stateAbbreviation: string;
}) {
  const isTrendTopic =
    topic === "covid-wastewater" || topic === "flu-activity";
  const region = stateRegionMap[stateAbbreviation] ?? "South";
  const pathogen: WastewaterPathogen =
    topic === "covid-wastewater" ? "SARS-CoV-2" : "Influenza A virus";
  const pathogenLabel =
    topic === "covid-wastewater" ? "COVID-19" : "Influenza A";
  const [points, setPoints] = useState<WastewaterTrendPoint[]>([]);
  const [loading, setLoading] = useState(isTrendTopic);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isTrendTopic) return;

    let isActive = true;
    setLoading(true);
    setError("");

    getWastewaterTrends(pathogen, region)
      .then((trendPoints) => {
        if (isActive) setPoints(trendPoints);
      })
      .catch(() => {
        if (isActive) {
          setError("Unable to load historical trend data.");
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isTrendTopic, pathogen, region]);

  if (!isTrendTopic) return null;

  if (loading) {
    return (
      <section className="mt-5 rounded-lg border border-white/10 bg-[#101934]/90 p-5 text-sm text-slate-300 shadow-xl shadow-black/25">
        Loading historical trend data...
      </section>
    );
  }

  if (error || points.length === 0) {
    return (
      <section className="mt-5 rounded-lg border border-violet-300/30 bg-violet-500/10 p-5 text-sm text-violet-100">
        {error || "Historical trend data is unavailable right now."}
      </section>
    );
  }

  return (
    <TrendChart
      points={points}
      region={region}
      pathogenLabel={pathogenLabel}
    />
  );
}

function DetailsContent() {
  const router = useRouter();
  const params = useParams<{ topic: string }>();
  const searchParams = useSearchParams();
  const topic = params.topic;

  const location = `${searchParams.get("city") || "Selected area"}, ${
    searchParams.get("state") || ""
  }`.trim();
  const zipCode = searchParams.get("zipCode") || "Unknown ZIP";
  const stateAbbreviation =
    searchParams.get("stateAbbreviation") || "";
  const aqi = searchParams.get("aqi") || "Unavailable";
  const airQuality = searchParams.get("airQuality") || "Unavailable";
  const fluActivity = searchParams.get("fluActivity") || "Unknown";
  const covidActivity = searchParams.get("covidActivity") || "Unknown";
  const covidValue = searchParams.get("covidValue") || "Unavailable";
  const covidSites = searchParams.get("covidSites") || "Unavailable";
  const covidCoverage = searchParams.get("covidCoverage") || "Unknown";
  const covidTimePeriod =
    searchParams.get("covidTimePeriod") || "Unavailable";
  const covidUpdatedAt =
    searchParams.get("covidUpdatedAt") || "Unavailable";
  const healthRisk = searchParams.get("healthRisk") || "Unknown";
  const respiratoryRisk =
    searchParams.get("respiratoryRisk") || "Unknown";
  const heatRisk = searchParams.get("heatRisk") || "Unknown";
  const uvRisk = searchParams.get("uvRisk") || "Unknown";
  const alertRisk = searchParams.get("alertRisk") || "Unknown";
  const pollutantRisk = searchParams.get("pollutantRisk") || "Unknown";
  const dominantPollutant =
    searchParams.get("dominantPollutant") || "Unavailable";
  const temperature = searchParams.get("temperature") || "";
  const apparentTemperature =
    searchParams.get("apparentTemperature") || "";
  const humidity = searchParams.get("humidity") || "";
  const uvIndexMax = searchParams.get("uvIndexMax") || "";
  const temperatureMax = searchParams.get("temperatureMax") || "";
  const apparentTemperatureMax =
    searchParams.get("apparentTemperatureMax") || "";
  const activeAlerts = searchParams.get("activeAlerts") || "";
  const alertNames = activeAlerts
    .split("|")
    .map((alert) => alert.trim())
    .filter(Boolean);
  const heatIndexValue =
    parseNumber(apparentTemperatureMax) ?? parseNumber(apparentTemperature);
  const uvIndexValue = parseNumber(uvIndexMax);

  const detailsByTopic: Record<string, DetailContent> = {
    "air-quality": {
      title: "Air Quality",
      eyebrow: "Environmental signal",
      value: airQuality,
      summary:
        "Air quality can affect breathing symptoms, especially for people with asthma, COPD, heart disease, or other respiratory conditions.",
      source: "OpenWeather Air Pollution API",
      rows: [
        { label: "AQI category", value: aqi },
        { label: "Displayed level", value: airQuality },
        { label: "Dominant pollutant", value: dominantPollutant },
        { label: "Pollutant risk", value: pollutantRisk },
        { label: "Location", value: location },
      ],
      interpretation:
        "Higher AQI categories suggest more polluted air. YourLocalHealth also checks the pollutant breakdown to identify which pollutant is most important for the local signal.",
    },
    "heat-risk": {
      title: "Heat Risk",
      eyebrow: "Environmental exposure signal",
      value: heatRisk,
      summary:
        "Heat risk uses current and daily maximum apparent temperature, which estimates how hot conditions feel to the body.",
      source: "Open-Meteo forecast API",
      rows: [
        { label: "Heat risk", value: heatRisk },
        {
          label: "Current temperature",
          value: formatNumber(temperature, "°F"),
        },
        {
          label: "Current feels-like temperature",
          value: formatNumber(apparentTemperature, "°F"),
        },
        {
          label: "Daily max temperature",
          value: formatNumber(temperatureMax, "°F"),
        },
        {
          label: "Daily max feels-like temperature",
          value: formatNumber(apparentTemperatureMax, "°F"),
        },
        { label: "Relative humidity", value: formatNumber(humidity, "%") },
      ],
      interpretation:
        "Higher apparent temperatures can increase risk for dehydration, heat exhaustion, and heat illness, especially during outdoor work or exercise.",
    },
    "uv-risk": {
      title: "UV Risk",
      eyebrow: "Environmental exposure signal",
      value: uvRisk,
      summary:
        "UV risk uses the forecast daily maximum UV index for the searched location.",
      source: "Open-Meteo forecast API",
      rows: [
        { label: "UV risk", value: uvRisk },
        { label: "Daily max UV index", value: formatNumber(uvIndexMax) },
        { label: "Location", value: location },
      ],
      interpretation:
        "Higher UV index values mean faster sunburn and greater skin and eye exposure risk. Outdoor time, time of day, shade, clothing, and sunscreen all matter.",
    },
    "weather-alerts": {
      title: "Active Alerts",
      eyebrow: "Official alert signal",
      value: alertRisk,
      summary:
        "This checks active National Weather Service alerts for the searched latitude and longitude.",
      source: "National Weather Service alerts API",
      rows: [
        { label: "Alert risk", value: alertRisk },
        { label: "Active alert count", value: String(alertNames.length) },
        {
          label: "Alert events",
          value: alertNames.length ? alertNames.join(", ") : "None found",
        },
      ],
      interpretation:
        "Official alerts can include heat, air quality, severe weather, flood, winter weather, and other hazards that may change local health risk.",
    },
    "flu-activity": {
      title: "Flu Activity",
      eyebrow: "Respiratory illness signal",
      value: fluActivity,
      summary:
        "This reflects CDC-reported respiratory illness activity for the state matched to the ZIP code you searched.",
      source: "CDC respiratory illness activity dataset",
      rows: [
        { label: "Activity level", value: fluActivity },
        { label: "Geography", value: location },
        { label: "ZIP searched", value: zipCode },
      ],
      interpretation:
        "Higher flu or respiratory illness activity can increase community risk, especially for older adults, infants, pregnant people, and people with chronic conditions.",
    },
    "covid-wastewater": {
      title: "COVID Wastewater",
      eyebrow: "Wastewater surveillance signal",
      value: covidActivity,
      summary:
        "CDC wastewater surveillance measures SARS-CoV-2 activity in wastewater, which can indicate community-level COVID activity.",
      source: "CDC National Wastewater Surveillance System",
      rows: [
        { label: "Wastewater activity", value: covidActivity },
        { label: "WVAL value", value: covidValue },
        { label: "Reporting sites", value: covidSites },
        { label: "Time period", value: covidTimePeriod },
        { label: "Updated", value: covidUpdatedAt },
      ],
      interpretation:
        "Wastewater data can show viral activity even when testing patterns change. YourLocalHealth uses this as the COVID input for respiratory risk.",
    },
    "data-coverage": {
      title: "Data Coverage",
      eyebrow: "Data quality context",
      value: covidCoverage,
      summary:
        "Coverage describes how representative the CDC wastewater data is for the state or territory.",
      source: "CDC National Wastewater Surveillance System",
      rows: [
        { label: "Coverage", value: covidCoverage },
        { label: "Reporting sites", value: covidSites },
        { label: "Time period", value: covidTimePeriod },
        { label: "Updated", value: covidUpdatedAt },
      ],
      interpretation:
        "Limited coverage means the wastewater result may be based on a smaller share of the population and should be interpreted with extra caution.",
    },
    "respiratory-risk": {
      title: "Respiratory Risk",
      eyebrow: "Combined risk score",
      value: respiratoryRisk,
      summary:
        "Respiratory risk combines flu activity, COVID wastewater activity, air quality, pollutant risk, and active alert context into one simple signal.",
      source:
        "YourLocalHealth risk calculation using CDC, OpenWeather, Open-Meteo, and National Weather Service data",
      rows: [
        { label: "Respiratory risk", value: respiratoryRisk },
        { label: "Flu activity", value: fluActivity },
        { label: "COVID wastewater", value: covidActivity },
        { label: "Air quality", value: airQuality },
        { label: "Pollutant risk", value: pollutantRisk },
        { label: "Active alert risk", value: alertRisk },
      ],
      interpretation:
        "The current rule flags respiratory risk as high when a major respiratory input is high, moderate when a major input is moderate, and low when all inputs are low.",
    },
  };

  const detail =
    detailsByTopic[topic] ?? {
      title: titleFromTopic(topic),
      eyebrow: "Health signal",
      value: "Unknown",
      summary: "No detail page has been configured for this reading yet.",
      source: "YourLocalHealth",
      rows: [{ label: "Overall health risk", value: healthRisk }],
      interpretation:
        "Return to the dashboard and choose one of the available health signals.",
    };

  return (
    <main className="min-h-screen bg-[#070b1d] text-white">
      <section className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={() =>
            router.push(`/?zipCode=${encodeURIComponent(zipCode)}`)
          }
          className="inline-flex text-sm font-semibold text-cyan-300 hover:text-white"
        >
          Back to summary
        </button>

        <header className="mt-8 rounded-lg border border-white/10 bg-[#101934]/90 p-6 shadow-xl shadow-black/25">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            {detail.eyebrow}
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white">
                {detail.title}
              </h1>
              <p className="mt-3 text-sm text-slate-400">
                {location} · {zipCode}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-4 py-2 text-base font-semibold ${getRiskTone(
                detail.value
              )}`}
            >
              {detail.value}
            </span>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">
            {detail.summary}
          </p>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Reading Details
            </h2>
            <dl className="mt-4 divide-y divide-white/10">
              {detail.rows.map((row) => (
                <div
                  className="flex items-start justify-between gap-4 py-3"
                  key={row.label}
                >
                  <dt className="text-sm text-slate-400">{row.label}</dt>
                  <dd className="text-right text-sm font-semibold text-white">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              What This Means
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {detail.interpretation}
            </p>
            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Data Source
              </p>
              <p className="mt-2 text-sm text-slate-200">
                {detail.source}
              </p>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-400">
              YourLocalHealth is informational only and does not provide
              medical advice, diagnosis, or treatment.
            </p>
          </article>
        </section>

        <section className="mt-5">
          <TopicVisualization
            topic={topic}
            heatIndex={parseNumber(apparentTemperature)}
            heatIndexMax={heatIndexValue}
            uvIndex={uvIndexValue}
            alertNames={alertNames}
            dominantPollutant={dominantPollutant}
            pollutantRisk={pollutantRisk}
          />
        </section>

        <WastewaterTrendSection
          topic={topic}
          stateAbbreviation={stateAbbreviation}
        />
      </section>
    </main>
  );
}

export default function DetailPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#070b1d] text-slate-300">
          Loading details...
        </main>
      }
    >
      <DetailsContent />
    </Suspense>
  );
}
