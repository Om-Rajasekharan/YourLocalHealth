"use client";

import { FormEvent, useState } from "react";
import { getAirQualityLabel } from "../lib/airQuality";
import {
  calculateHealthRisk,
  calculateRespiratoryRisk,
} from "../lib/healthRisk";
import { getLocation } from "../services/location";
import { getAirQuality } from "../services/airsQuality";
import { getFluData } from "../services/flu";
import {
  getCovidData,
  type CovidActivityData,
} from "../services/covid";

function riskBadgeClass(risk: string) {
  switch (risk) {
    case "Low":
    case "Very Low":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Moderate":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "High":
    case "Very High":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
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

function SignalCard({
  title,
  value,
  detail,
  source,
}: {
  title: string;
  value: string;
  detail: string;
  source: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-h-24 flex-col justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </h3>
          <div className="mt-3">
            <RiskBadge value={value} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {detail}
          </p>
        </div>
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
          {source}
        </p>
      </div>
    </article>
  );
}

export default function Home() {
  const [zipCode, setZipCode] = useState("");
  const [searched, setSearched] = useState(false);

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [aqi, setAqi] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fluActivity, setFluActivity] = useState("Unknown");
  const [covidData, setCovidData] =
    useState<CovidActivityData | null>(null);

  const covidActivity = covidData?.activity ?? "Unknown";
  const healthRisk = calculateHealthRisk(
    aqi,
    fluActivity,
    covidActivity
  );
  const respiratoryRisk = calculateRespiratoryRisk(
    aqi,
    fluActivity,
    covidActivity
  );

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSearched(false);
    setLoading(true);

    try {
      const location = await getLocation(zipCode);

      setCity(location.city);
      setState(location.state);

      const fluData = await getFluData(location.state);
      setFluActivity(fluData);

      const covidActivityData = await getCovidData(location.state);
      setCovidData(covidActivityData);

      const airData = await getAirQuality(
        location.latitude,
        location.longitude
      );

      setAqi(airData.list?.[0]?.main.aqi ?? null);
      setSearched(true);
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Local public health dashboard
            </p>
            <h1 className="mt-3 text-4xl font-bold text-slate-950 sm:text-5xl">
              YourLocalHealth
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Enter a ZIP code to view local respiratory and environmental
              health signals from public data sources.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="flex w-full flex-col gap-3 sm:max-w-md sm:flex-row"
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
              className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-950 shadow-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-lg bg-teal-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Searching" : "Search"}
            </button>
          </form>
        </header>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {!searched && !error && (
          <section className="grid flex-1 place-items-center py-16">
            <div className="max-w-xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Ready when you are
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Search any US ZIP code to generate a local health snapshot.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                The dashboard currently combines air quality, CDC respiratory
                illness activity, and CDC wastewater COVID activity.
              </p>
            </div>
          </section>
        )}

        {searched && (
          <section className="py-8">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Results for {zipCode}
                </p>
                <h2 className="mt-1 text-3xl font-bold text-slate-950">
                  {city}, {state}
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Informational only, not medical advice.
              </p>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Overall Health Risk
                  </p>
                  <p className="mt-3 text-5xl font-bold text-slate-950">
                    {healthRisk}
                  </p>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                    This score combines air quality, CDC respiratory illness
                    activity, and CDC COVID wastewater activity for a simple
                    local risk snapshot.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Respiratory Risk
                  </p>
                  <div className="mt-3">
                    <RiskBadge value={respiratoryRisk} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Based on flu activity, COVID wastewater activity, and air
                    quality conditions that may affect breathing.
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 md:grid-cols-2">
              <SignalCard
                title="Air Quality"
                value={getAirQualityLabel(aqi)}
                detail={`AQI category ${aqi ?? "unavailable"} from current air pollution data.`}
                source="Source: OpenWeather Air Pollution API"
              />
              <SignalCard
                title="Flu Activity"
                value={fluActivity}
                detail="CDC respiratory illness activity reported at the state level."
                source="Source: CDC respiratory illness activity dataset"
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
              />
              <SignalCard
                title="Data Coverage"
                value={covidData?.coverage ?? "Unknown"}
                detail="Coverage describes how representative the wastewater data is for the state or territory."
                source="Source: CDC National Wastewater Surveillance System"
              />
            </section>
          </section>
        )}
      </section>
    </main>
  );
}
