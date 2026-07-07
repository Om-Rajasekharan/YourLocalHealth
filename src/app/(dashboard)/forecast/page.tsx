"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DashboardSidebar,
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
      <main className="public-health-bg min-h-screen">
        <section className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col items-start justify-center px-4 py-8 sm:px-8 lg:px-12">
          <p className="eyebrow-text">Forecast</p>
          <h1 className="display-heading mt-3 text-3xl text-[var(--foreground)]">
            Enter a ZIP code first
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--foreground-muted)]">
            The forecast is built from a local search. Head back to the
            dashboard and search a ZIP code to see it here.
          </p>
          <Link
            href="/"
            className="bespoke-button mt-5 w-fit px-4 py-2 text-sm font-semibold"
          >
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="public-health-bg min-h-screen">
      <section className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <header className="border-b border-[var(--rule)] pb-4">
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
          >
            ← Back to dashboard
          </Link>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <DashboardSidebar
            activeView="forecast"
            onChange={(view) => router.push(getDashboardUrl(zipCode, view))}
            city={city}
            state={state}
            zipCode={zipCode}
          />

          <div className="min-w-0">
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                Results for {zipCode}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                {city}, {state}
              </h2>
            </div>

            <ForecastPanel
              forecastData={healthForecastData}
              forecastError={forecastError}
              city={city}
              state={state}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
