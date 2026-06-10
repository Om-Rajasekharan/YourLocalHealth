"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

type DetailContent = {
  title: string;
  eyebrow: string;
  value: string;
  summary: string;
  source: string;
  rows: { label: string; value: string }[];
  interpretation: string;
};

function getRiskTone(value: string) {
  switch (value) {
    case "Low":
    case "Very Low":
    case "Fair":
    case "Good":
    case "Standard Coverage":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Moderate":
    case "Limited Coverage":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "High":
    case "Very High":
    case "Poor":
    case "Very Poor":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function titleFromTopic(topic: string) {
  return topic
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function DetailsContent() {
  const params = useParams<{ topic: string }>();
  const searchParams = useSearchParams();
  const topic = params.topic;

  const location = `${searchParams.get("city") || "Selected area"}, ${
    searchParams.get("state") || ""
  }`.trim();
  const zipCode = searchParams.get("zipCode") || "Unknown ZIP";
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
        { label: "Location", value: location },
      ],
      interpretation:
        "Higher AQI categories suggest more polluted air. YourLocalHealth uses this value as one input into respiratory and overall health risk.",
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
        "Respiratory risk combines flu activity, COVID wastewater activity, and air quality into one simple signal.",
      source: "YourLocalHealth risk calculation using CDC and OpenWeather data",
      rows: [
        { label: "Respiratory risk", value: respiratoryRisk },
        { label: "Flu activity", value: fluActivity },
        { label: "COVID wastewater", value: covidActivity },
        { label: "Air quality", value: airQuality },
      ],
      interpretation:
        "The current rule flags respiratory risk as high when any major input is high, moderate when any major input is moderate, and low when all inputs are low.",
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
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        >
          Back to dashboard
        </Link>

        <header className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            {detail.eyebrow}
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-950">
                {detail.title}
              </h1>
              <p className="mt-3 text-sm text-slate-500">
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
          <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
            {detail.summary}
          </p>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Reading Details
            </h2>
            <dl className="mt-4 divide-y divide-slate-100">
              {detail.rows.map((row) => (
                <div
                  className="flex items-start justify-between gap-4 py-3"
                  key={row.label}
                >
                  <dt className="text-sm text-slate-500">{row.label}</dt>
                  <dd className="text-right text-sm font-semibold text-slate-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              What This Means
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {detail.interpretation}
            </p>
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data Source
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {detail.source}
              </p>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              YourLocalHealth is informational only and does not provide
              medical advice, diagnosis, or treatment.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}

export default function DetailPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">
          Loading details...
        </main>
      }
    >
      <DetailsContent />
    </Suspense>
  );
}
