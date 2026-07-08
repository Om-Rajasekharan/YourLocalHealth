"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useDashboardData } from "../contexts/DashboardDataContext";
import {
  HealthEquityPanel,
  SymptomCheckinPanel,
  getDashboardUrl,
  getDashboardView,
  isDashboardView,
  type DashboardView,
} from "./DashboardApp.panels";

export {
  dashboardGroups,
  dashboardViews,
  getDashboardUrl,
  getDashboardView,
  isDashboardView,
  primaryDashboardViews,
} from "./DashboardApp.panels";
export type { DashboardView } from "./DashboardApp.panels";
export {
  DataConfidencePanel,
  ExposureTwinPanel,
  ForecastPanel,
  HealthEquityPanel,
  ModelDataSourcesPanel,
  RiskTransparencyPanel,
  SymptomCheckinPanel,
} from "./DashboardApp.panels";

type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "chart"
  | "droplet"
  | "heart"
  | "map"
  | "search"
  | "settings"
  | "shield"
  | "spark"
  | "thermo"
  | "users"
  | "wind";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  return (
    <svg aria-hidden="true" {...common}>
      {name === "activity" && <path d="M3 12h4l3-7 4 14 3-7h4" />}
      {name === "alert" && (
        <>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      )}
      {name === "bell" && (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </>
      )}
      {name === "chart" && (
        <>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 4-4 3 3 5-7" />
        </>
      )}
      {name === "droplet" && <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />}
      {name === "heart" && <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />}
      {name === "map" && (
        <>
          <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      )}
      {name === "settings" && (
        <>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </>
      )}
      {name === "shield" && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />}
      {name === "spark" && (
        <>
          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
          <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
        </>
      )}
      {name === "thermo" && (
        <>
          <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
          <path d="M10 9h4" />
        </>
      )}
      {name === "users" && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
          <path d="M16 3.1a4 4 0 0 1 0 7.8" />
        </>
      )}
      {name === "wind" && (
        <>
          <path d="M4 12h12a3 3 0 1 0-3-3" />
          <path d="M4 6h7" />
          <path d="M4 18h10a3 3 0 1 0-3-3" />
        </>
      )}
    </svg>
  );
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`${small ? "h-7 w-7" : "h-9 w-9"} relative grid place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-white shadow-[0_10px_24px_-16px_rgba(46,111,181,0.8)]`}
    >
      <Icon name="heart" className={small ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} />
    </span>
  );
}

function AccountActions({ user }: { user: ReturnType<typeof useDashboardData>["user"] }) {
  if (user) {
    return (
      <Link
        className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]"
        href="/account"
      >
        Account
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        className="hidden rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-soft)] sm:inline-flex"
        href="/account"
      >
        Sign in
      </Link>
      <Link
        className="rounded-full bg-[var(--primary-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary)]"
        href="/signup"
      >
        Sign up
      </Link>
    </div>
  );
}

function toneClass(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("high") || lower.includes("severe")) {
    return "bg-[var(--danger)]/10 text-[var(--danger)]";
  }
  if (lower.includes("moderate") || lower.includes("fair")) {
    return "bg-[var(--warning)]/15 text-[var(--warning)]";
  }
  if (lower.includes("low") || lower.includes("good")) {
    return "bg-[var(--success)]/10 text-[var(--success)]";
  }
  return "bg-[var(--primary-soft)] text-[var(--primary)]";
}

function percentFromRisk(value: string, fallback = 48) {
  const lower = value.toLowerCase();
  if (lower.includes("very high")) return 88;
  if (lower.includes("high") || lower.includes("severe")) return 76;
  if (lower.includes("moderate") || lower.includes("fair")) return 56;
  if (lower.includes("low") || lower.includes("good")) return 28;
  return fallback;
}

const featureLinks: { label: string; href: string; hash?: string }[] = [
  { label: "Forecast", href: "#forecast", hash: "forecast" },
  { label: "Exposure Twin", href: "#twin", hash: "twin" },
  { label: "Model & Data", href: "#model", hash: "model" },
  { label: "Public health", href: "#about", hash: "about" },
];

const visibleDashboardViews: DashboardView[] = [
  "overview",
  "forecast",
  "twin",
  "model",
  "signals",
  "equity",
  "checkin",
  "news",
];

function LandingHero({
  loading,
  error,
  onSubmit,
  user,
}: {
  loading: boolean;
  error: string;
  onSubmit: (zip: string) => void;
  user: ReturnType<typeof useDashboardData>["user"];
}) {
  const [zip, setZip] = useState("");
  const valid = /^\d{5}$/.test(zip.trim());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(valid ? zip.trim() : "27514");
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark />
            <span className="font-heading text-lg font-semibold tracking-tight text-[var(--primary-ink)]">
              MyLocalHealth
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[var(--muted-foreground)] md:flex">
            {featureLinks.map((link) => (
              <a className="hover:text-[var(--primary-ink)]" href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <AccountActions user={user} />
            <button
              className="hidden items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-ink)] lg:inline-flex"
              onClick={() => onSubmit("27514")}
              type="button"
            >
              Open dashboard <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="hero-grid-bg absolute inset-0 opacity-70" />
        <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-[var(--primary-soft)]/70 via-[var(--primary-soft)]/20 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 lg:pt-28">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/20 bg-white px-3 py-1 text-xs font-medium text-[var(--primary)] shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)]/50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--primary)]" />
                </span>
                Live public-health signals by ZIP code
              </div>
              <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--primary-ink)] sm:text-6xl">
                Your neighborhood&apos;s{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">health forecast</span>
                  <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded-sm bg-[var(--accent)]/40" />
                </span>
                , not just the weather.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted-foreground)]">
                Air quality, heat, pollen, flu, COVID wastewater, equity context,
                and personal exposure combined into a readable local risk snapshot.
              </p>

              <form
                className="mt-8 flex max-w-lg items-center gap-2 rounded-full border border-[var(--border)] bg-white p-2 shadow-[0_10px_40px_-12px_rgba(19,41,75,0.18)]"
                onSubmit={handleSubmit}
              >
                <div className="flex flex-1 items-center gap-3 pl-4">
                  <Icon name="map" className="h-4 w-4 text-[var(--primary)]" />
                  <input
                    aria-label="ZIP code"
                    className="w-full bg-transparent py-2 text-base text-[var(--primary-ink)] placeholder:text-[var(--muted-foreground)]/70 focus:outline-none"
                    inputMode="numeric"
                    onChange={(event) => setZip(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                    placeholder="Enter your ZIP code"
                    value={zip}
                  />
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--primary-ink)] disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                >
                  <Icon name="search" className="h-4 w-4" />
                  {loading ? "Loading" : "See my forecast"}
                </button>
              </form>
              {loading && (
                <div className="mt-5 max-w-lg rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)]/50" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-medium text-[var(--primary-ink)]">
                      Building your local health snapshot
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <div className="h-2 rounded-full bg-[var(--primary-soft)]" />
                    <div className="h-2 w-4/5 rounded-full bg-[var(--primary-soft)]" />
                    <div className="h-2 w-2/3 rounded-full bg-[var(--primary-soft)]" />
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                <span>Try:</span>
                {["27514", "10025", "94110", "60614"].map((sample) => (
                  <button
                    className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 font-medium text-[var(--primary)] hover:border-[var(--primary)]"
                    key={sample}
                    onClick={() => setZip(sample)}
                    type="button"
                  >
                    {sample}
                  </button>
                ))}
              </div>
              {error && <p className="mt-4 text-sm font-medium text-[var(--danger)]">{error}</p>}
            </div>

            <HeroForecastCard />
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-6 text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--primary-ink)]">Signals combined from</span>
          <span>OpenWeather</span>
          <span>CDC FluView</span>
          <span>CDC NWSS</span>
          <span>NOAA alerts</span>
          <span>CDC PLACES</span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24" id="forecast">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
            Three lenses on local health
          </p>
          <h2 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-[var(--primary-ink)]">
            Made for people, not just for models.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <LandingFeature id="forecast" icon="activity" title="7-day local risk forecast" eyebrow="Forecast" visual={<ForecastMini />} />
          <LandingFeature id="twin" icon="heart" title="Your personal exposure model" eyebrow="Exposure Twin" visual={<TwinMini />} />
          <LandingFeature id="model" icon="shield" title="Transparent risk contributors" eyebrow="Model & Data" visual={<ModelMini />} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24" id="about">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--primary-ink)] px-10 py-16 text-white">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--accent)]/25 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <h3 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Public health, translated for the block you live on.
              </h3>
              <p className="mt-4 max-w-xl text-white/70">
                Search a ZIP code to explore forecast, exposure twin, and transparent model views.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]"
                onClick={() => onSubmit("27514")}
                type="button"
              >
                Open dashboard <span aria-hidden>→</span>
              </button>
              <a className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-medium text-white hover:bg-white/10" href="#model">
                How the model works
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroForecastCard() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const scores = [38, 42, 55, 68, 74, 61, 48];

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[var(--primary)]/20 via-[var(--accent)]/10 to-transparent blur-2xl" />
      <div className="lifted-shadow relative rounded-3xl border border-[var(--border)] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
              Chapel Hill · 27514
            </div>
            <div className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
              Moderate risk today
            </div>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-white">
            <span className="font-heading text-xl font-semibold">55</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <MiniStat icon="wind" label="AQI" value="72" />
          <MiniStat icon="thermo" label="Heat" value="88°F" tone="warning" />
          <MiniStat icon="droplet" label="Wastewater" value="Low" tone="success" />
        </div>
        <div className="mt-6 flex items-end justify-between gap-2">
          {scores.map((score, index) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={days[index]}>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[var(--primary)] to-[var(--accent)]"
                style={{ height: `${score * 1.45}px` }}
              />
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{days[index]}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--primary-soft)] px-3 py-2 text-xs text-[var(--primary-ink)]">
          <Icon name="chart" className="h-3.5 w-3.5 text-[var(--primary)]" />
          Best outdoor window: before 10am or after 7pm.
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "warning"
      ? "text-[var(--warning)]"
      : "text-[var(--primary)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--primary-soft)]/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        <Icon name={icon} className={`h-3 w-3 ${color}`} />
        {label}
      </div>
      <div className="mt-1 font-heading text-lg font-semibold text-[var(--primary-ink)]">{value}</div>
    </div>
  );
}

function LandingFeature({
  id,
  icon,
  eyebrow,
  title,
  visual,
}: {
  id: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  visual: React.ReactNode;
}) {
  const copy =
    id === "forecast"
      ? "A calibrated daily health-risk score decomposed into the drivers that matter."
      : id === "twin"
      ? "A private exposure model that turns routine, location, and check-ins into a score you recognize."
      : "Every prediction shows the source, freshness, confidence, and contributors behind it.";

  return (
    <div className="soft-shadow group relative flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white transition hover:-translate-y-1 hover:lifted-shadow" id={id}>
      <div className="border-b border-[var(--border)] bg-[var(--primary-soft)]/50 p-6">{visual}</div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">{eyebrow}</span>
        </div>
        <h3 className="mt-4 font-heading text-xl font-semibold text-[var(--primary-ink)]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{copy}</p>
        <div className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">
          Learn more <span aria-hidden>→</span>
        </div>
      </div>
    </div>
  );
}

function ForecastMini() {
  return (
    <div className="flex h-32 items-end gap-1.5">
      {[30, 42, 55, 68, 74, 61, 48].map((height, index) => (
        <div className="flex-1 rounded-t bg-gradient-to-t from-[var(--primary)] to-[var(--accent)]" key={index} style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

function TwinMini() {
  return (
    <svg className="h-32 w-full" viewBox="0 0 200 128">
      <defs>
        <linearGradient id="twinMini" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="54" fill="url(#twinMini)" opacity=".16" r="38" />
      <circle cx="50" cy="42" fill="var(--primary)" r="16" />
      <path d="M28 106c2-28 12-42 22-42s20 14 22 42" fill="var(--primary)" opacity=".8" />
      <path d="M100 32h76M100 64h58M100 96h70" stroke="var(--border)" strokeWidth="8" strokeLinecap="round" />
      <path d="M100 32h54M100 64h38M100 96h48" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function ModelMini() {
  const points = "20,80 45,70 70,72 95,55 120,60 145,40 170,45";
  return (
    <svg className="h-32 w-full" viewBox="0 0 200 128">
      <path d="M20 104h160M20 80h160M20 56h160M20 32h160" stroke="var(--border)" />
      <polyline fill="none" points={points} stroke="var(--primary)" strokeWidth="3" />
      {points.split(" ").map((point) => {
        const [x, y] = point.split(",");
        return <circle cx={x} cy={y} fill="var(--accent)" key={point} r="4" />;
      })}
    </svg>
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
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-6">
        <BrandMark />
        <button className="font-heading text-lg font-semibold text-[var(--primary-ink)]" onClick={() => onChange("overview")} type="button">
          MyLocalHealth
        </button>
      </div>
      <div className="flex-1 space-y-1 p-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Health tools
        </p>
        {visibleDashboardViews.map((viewId) => {
          const view = getDashboardView(viewId);
          const isActive = activeView === viewId;
          return (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--primary)] text-white shadow-[0_6px_18px_-8px_rgba(46,111,181,0.6)]"
                  : "text-[var(--sidebar-foreground)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)]"
              }`}
              key={view.id}
              onClick={() => onChange(view.id)}
              type="button"
            >
              <Icon name={iconForView(view.id)} className="h-4 w-4" />
              {view.label}
            </button>
          );
        })}
      </div>
      <div className="m-4 rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          <Icon name="spark" className="h-3.5 w-3.5" /> Local insight
        </div>
        <p className="mt-2 text-sm text-[var(--primary-ink)]">
          {city ? `${city}, ${state}: ZIP ${zipCode}` : "Search a ZIP to load local context."}
        </p>
      </div>
    </aside>
  );
}

export function DashboardPageShell({
  activeView,
  children,
  city,
  eyebrow,
  onNavigate,
  state,
  title,
  zipCode,
}: {
  activeView: DashboardView;
  children: React.ReactNode;
  city: string;
  eyebrow: string;
  onNavigate: (view: DashboardView) => void;
  state: string;
  title: string;
  zipCode: string;
}) {
  const { user } = useDashboardData();
  const dashboardHref = getDashboardUrl(zipCode, "overview");

  return (
    <div className="flex min-h-screen bg-[var(--primary-soft)]/30">
      <DashboardSidebar
        activeView={activeView}
        city={city}
        onChange={onNavigate}
        state={state}
        zipCode={zipCode}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b border-[var(--border)] bg-white/85 px-6 py-3 backdrop-blur lg:px-10">
          <Link
            className="flex shrink-0 items-center gap-2 lg:hidden"
            href={dashboardHref}
          >
            <BrandMark small />
            <span className="font-heading text-base font-semibold text-[var(--primary-ink)]">
              MyLocalHealth
            </span>
          </Link>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {eyebrow}
            </div>
            <h1 className="truncate font-heading text-lg font-semibold text-[var(--primary-ink)]">
              {title} · ZIP {zipCode}
            </h1>
          </div>
          <Link
            className="ml-auto rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]"
            href={dashboardHref}
          >
            Dashboard
          </Link>
          <Link
            className="hidden rounded-full bg-[var(--primary-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary)] sm:inline-flex"
            href="/"
          >
            New search
          </Link>
          <AccountActions user={user} />
        </header>
        <main className="lovable-dashboard-shell flex-1 px-6 py-6 lg:px-10">
          <div className="mx-auto max-w-[86rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function EmptyDashboardState({
  copy,
  eyebrow,
  title,
}: {
  copy: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-6 py-12">
      <section className="lifted-shadow relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-8">
        <div className="hero-grid-bg absolute inset-0 opacity-60" />
        <div className="relative">
          <BrandMark />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-[var(--primary-ink)]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
            {copy}
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--primary-ink)]"
            href="/"
          >
            Search a ZIP code
          </Link>
        </div>
      </section>
    </main>
  );
}

function iconForView(view: DashboardView): IconName {
  if (view === "forecast") return "activity";
  if (view === "twin") return "heart";
  if (view === "model") return "shield";
  if (view === "equity") return "users";
  if (view === "signals") return "wind";
  if (view === "news") return "bell";
  if (view === "timeline") return "chart";
  if (view === "checkin") return "heart";
  return "chart";
}

function SummaryRow({
  healthRisk,
  aqi,
  airQualityLabel,
  heatRisk,
  covidActivity,
}: {
  healthRisk: string;
  aqi: number | null;
  airQualityLabel: string;
  heatRisk: string;
  covidActivity: string;
}) {
  const stats = [
    {
      icon: "activity" as IconName,
      label: "Overall risk",
      sub: "Composite local snapshot",
      tone: healthRisk,
      value: healthRisk,
    },
    {
      icon: "wind" as IconName,
      label: "Air quality",
      sub: airQualityLabel,
      tone: airQualityLabel,
      value: aqi != null ? `${aqi}` : "—",
    },
    {
      icon: "thermo" as IconName,
      label: "Heat risk",
      sub: "Outdoor exposure pressure",
      tone: heatRisk,
      value: heatRisk,
    },
    {
      icon: "droplet" as IconName,
      label: "COVID wastewater",
      sub: "CDC NWSS signal",
      tone: covidActivity,
      value: covidActivity,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div className="soft-shadow rounded-2xl border border-[var(--border)] bg-white p-5" key={stat.label}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{stat.label}</div>
              <div className="mt-2 font-heading text-3xl font-semibold text-[var(--primary-ink)]">{stat.value}</div>
            </div>
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass(stat.tone)}`}>
              <Icon name={stat.icon} className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-[var(--muted-foreground)]">{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}

function DashboardForecastPanel({
  zipCode,
  healthForecastData,
  heatRisk,
  airQualityLabel,
}: {
  zipCode: string;
  healthForecastData: ReturnType<typeof useDashboardData>["healthForecastData"];
  heatRisk: string;
  airQualityLabel: string;
}) {
  const bars =
    healthForecastData?.hours.slice(0, 7).map((hour) => ({
      label: hour.displayTime.replace(/^[A-Za-z]+,?\s?/, ""),
      risk: hour.score,
    })) ??
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => ({
      label,
      risk: [38, 42, 55, 68, 74, 61, 48][index],
    }));

  return (
    <section className="soft-shadow rounded-3xl border border-[var(--border)] bg-white p-6" id="forecast">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">Forecast</div>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">Local risk pulse</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Air quality is {airQualityLabel.toLowerCase()}; heat risk is {heatRisk.toLowerCase()}.
          </p>
        </div>
        <Link className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]" href={getDashboardUrl(zipCode, "forecast")}>
          Full forecast
        </Link>
      </div>
      <div className="mt-6 flex h-[280px] items-end gap-3 border-b border-l border-[var(--border)] px-3 pb-4">
        {bars.map((bar) => (
          <div className="group flex min-w-0 flex-1 flex-col items-center gap-2" key={bar.label}>
            <div className="relative w-full">
              <div
                className="mx-auto w-full rounded-t-xl bg-gradient-to-t from-[var(--primary)] to-[var(--accent)] transition group-hover:opacity-80"
                style={{ height: `${Math.max(26, bar.risk * 2.4)}px` }}
              />
              <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-full bg-[var(--primary-ink)] px-2 py-1 text-[10px] text-white group-hover:block">
                {bar.risk}
              </span>
            </div>
            <span className="truncate text-[11px] font-medium text-[var(--muted-foreground)]">{bar.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)]">
        <Legend color="var(--primary)" label="Composite risk" />
        <Legend color="var(--accent)" label="Environmental pressure" />
        <span className="ml-auto inline-flex items-center gap-1 text-[var(--primary)]">
          Data confidence <span className="font-semibold">live</span>
        </span>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-0.5 w-6 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

function DashboardTwinPanel({
  score,
  level,
  respiratoryRisk,
  userProfile,
}: {
  score: number;
  level: string;
  respiratoryRisk: string;
  userProfile: ReturnType<typeof useDashboardData>["userProfile"];
}) {
  const circle = Math.max(0, Math.min(100, score));
  return (
    <section className="soft-shadow flex flex-col rounded-3xl border border-[var(--border)] bg-white p-6" id="twin">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">Exposure Twin</div>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">Your day, modeled</h2>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass(level)}`}>{level}</div>
      </div>
      <div className="mt-6 flex items-center gap-6">
        <div className="relative grid h-32 w-32 place-items-center">
          <svg className="absolute inset-0" viewBox="0 0 120 120">
            <circle cx="60" cy="60" fill="none" r="52" stroke="var(--primary-soft)" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              fill="none"
              r="52"
              stroke="var(--primary)"
              strokeDasharray={`${circle * 3.27} 327`}
              strokeLinecap="round"
              strokeWidth="12"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="text-center">
            <div className="font-heading text-3xl font-semibold text-[var(--primary-ink)]">{Math.round(score)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">/ 100</div>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <TwinLine label="Environment" value={percentFromRisk(level, score)} color="primary" />
          <TwinLine label="Respiratory" value={percentFromRisk(respiratoryRisk, 44)} color="warning" />
          <TwinLine label="Profile" value={userProfile ? 64 : 28} color="success" />
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--primary-soft)]/40 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Today&apos;s timeline</div>
        <div className="mt-2 flex h-20 items-end gap-1.5">
          {[20, 42, 55, 68, 74, 62, 48, 30].map((height, index) => (
            <div className="flex flex-1 flex-col items-center gap-1" key={index}>
              <div className="w-full rounded-t bg-[var(--primary)]/80" style={{ height: `${height}%` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TwinLine({
  color,
  label,
  value,
}: {
  color: "primary" | "success" | "warning";
  label: string;
  value: number;
}) {
  const bg =
    color === "success"
      ? "bg-[var(--success)]"
      : color === "warning"
      ? "bg-[var(--warning)]"
      : "bg-[var(--primary)]";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-semibold text-[var(--primary-ink)]">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--primary-soft)]">
        <div className={`${bg} h-full rounded-full`} style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ContributorsPanel({
  zipCode,
  scoreBreakdown,
}: {
  zipCode: string;
  scoreBreakdown: ReturnType<typeof useDashboardData>["scoreBreakdown"];
}) {
  const rows = scoreBreakdown.categoryScores.slice(0, 6).map((item, index) => ({
    factor: item.label,
    value: Math.max(10, Math.min(100, Math.round(item.score))),
    baseline: [32, 40, 36, 28, 30, 34][index] ?? 30,
  }));
  const polygon = rows
    .map((row, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, rows.length) - Math.PI / 2;
      const radius = 28 + row.value * 0.42;
      return `${100 + Math.cos(angle) * radius},${100 + Math.sin(angle) * radius}`;
    })
    .join(" ");

  return (
    <section className="soft-shadow rounded-3xl border border-[var(--border)] bg-white p-6" id="model">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">Model & Data</div>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">Risk contributors</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Current ZIP snapshot compared with baseline.</p>
        </div>
        <Link className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]" href={getDashboardUrl(zipCode, "model")}>
          Methodology
        </Link>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="grid min-h-[300px] place-items-center">
          <svg className="h-[280px] w-full max-w-[360px]" viewBox="0 0 200 200">
            {[35, 60, 85].map((radius) => (
              <circle cx="100" cy="100" fill="none" key={radius} r={radius} stroke="var(--border)" />
            ))}
            {rows.map((row, index) => {
              const angle = (Math.PI * 2 * index) / Math.max(1, rows.length) - Math.PI / 2;
              return (
                <g key={row.factor}>
                  <line stroke="var(--border)" x1="100" x2={100 + Math.cos(angle) * 88} y1="100" y2={100 + Math.sin(angle) * 88} />
                  <text fill="var(--muted-foreground)" fontSize="8" textAnchor="middle" x={100 + Math.cos(angle) * 98} y={104 + Math.sin(angle) * 98}>
                    {row.factor.slice(0, 8)}
                  </text>
                </g>
              );
            })}
            <polygon fill="rgba(75,156,211,.22)" points={polygon} stroke="var(--primary)" strokeWidth="3" />
          </svg>
        </div>
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--primary-soft)]/30 px-4 py-2.5" key={row.factor}>
              <div>
                <div className="font-medium text-[var(--primary-ink)]">{row.factor}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Baseline {row.baseline}</div>
              </div>
              <div className={row.value > row.baseline ? "text-sm font-semibold text-[var(--danger)]" : "text-sm font-semibold text-[var(--success)]"}>
                {row.value > row.baseline ? "+" : ""}
                {row.value - row.baseline}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SecondaryPanels({
  fluActivity,
  localNews,
  healthEquityLevel,
  alertRisk,
}: {
  fluActivity: string;
  localNews: ReturnType<typeof useDashboardData>["localNews"];
  healthEquityLevel: string;
  alertRisk: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SmallPanel icon="wind" label="Flu activity" title={fluActivity} />
      <SmallPanel icon="users" label="Health equity" title={healthEquityLevel} />
      <SmallPanel icon="alert" label="Weather alerts" title={alertRisk} />
      <SmallPanel icon="bell" label="Local news" title={`${localNews.length} articles`} />
    </div>
  );
}

function SmallPanel({ icon, label, title }: { icon: IconName; label: string; title: string }) {
  return (
    <div className="soft-shadow rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
          <div className="mt-2 font-heading text-xl font-semibold text-[var(--primary-ink)]">{title}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass(title)}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function NewsPanel({ localNews }: { localNews: ReturnType<typeof useDashboardData>["localNews"] }) {
  const items = localNews.slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section className="soft-shadow rounded-3xl border border-[var(--border)] bg-white p-6">
      <div className="flex items-center gap-2">
        <Icon name="bell" className="h-5 w-5 text-[var(--muted-foreground)]" />
        <h2 className="font-heading text-xl font-semibold text-[var(--primary-ink)]">Local health news</h2>
      </div>
      <ul className="mt-4 divide-y divide-[var(--border)]">
        {items.map((article) => (
          <li className="py-3" key={article.url}>
            <a className="block text-sm font-medium text-[var(--primary-ink)] hover:text-[var(--primary)]" href={article.url} rel="noopener noreferrer" target="_blank">
              {article.title}
            </a>
            <p className="mt-1 text-xs uppercase tracking-widest text-[var(--muted-foreground)]">{article.source}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignalsView({
  aqi,
  airQualityLabel,
  alertRisk,
  covidActivity,
  dominantPollutant,
  fluActivity,
  heatRisk,
  pollutantRisk,
  respiratoryRisk,
  uvRisk,
}: {
  aqi: number | null;
  airQualityLabel: string;
  alertRisk: string;
  covidActivity: string;
  dominantPollutant: string;
  fluActivity: string;
  heatRisk: string;
  pollutantRisk: string;
  respiratoryRisk: string;
  uvRisk: string;
}) {
  const signals = [
    {
      icon: "activity" as IconName,
      label: "Respiratory risk",
      detail: "Combines flu, COVID wastewater, and air conditions.",
      value: respiratoryRisk,
    },
    {
      icon: "wind" as IconName,
      label: "Air quality",
      detail: aqi === null ? "AQI unavailable" : `AQI ${aqi}`,
      value: airQualityLabel,
    },
    {
      icon: "thermo" as IconName,
      label: "Heat risk",
      detail: "Outdoor heat stress signal.",
      value: heatRisk,
    },
    {
      icon: "spark" as IconName,
      label: "UV risk",
      detail: "Sun exposure risk from forecast data.",
      value: uvRisk,
    },
    {
      icon: "droplet" as IconName,
      label: "COVID wastewater",
      detail: "CDC wastewater viral activity.",
      value: covidActivity,
    },
    {
      icon: "activity" as IconName,
      label: "Flu activity",
      detail: "CDC respiratory illness activity.",
      value: fluActivity,
    },
    {
      icon: "alert" as IconName,
      label: "Weather alerts",
      detail: "National Weather Service alert context.",
      value: alertRisk,
    },
    {
      icon: "wind" as IconName,
      label: dominantPollutant || "Dominant pollutant",
      detail: "Pollutant-specific burden.",
      value: pollutantRisk,
    },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-6 shadow-[0_18px_42px_-34px_rgba(19,41,75,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          Health signals
        </p>
        <h2 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-[var(--primary-ink)]">
          The readings behind today&apos;s snapshot.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
          These are the local environmental and respiratory inputs currently
          feeding the dashboard. Use this page when you want the raw signal
          view instead of the combined forecast.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {signals.map((signal) => (
          <article
            className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_-28px_rgba(19,41,75,0.45)]"
            key={signal.label}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Icon name={signal.icon} className="h-5 w-5" />
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(signal.value)}`}>
                {signal.value}
              </span>
            </div>
            <h3 className="mt-5 font-heading text-xl font-semibold text-[var(--primary-ink)]">
              {signal.label}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {signal.detail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const {
    zipCode,
    city,
    state,
    searched,
    loading,
    error,
    aqi,
    fluActivity,
    covidActivity,
    heatRisk,
    uvRisk,
    alertRisk,
    dominantPollutant,
    pollutantRisk,
    airQualityLabel,
    healthRisk,
    respiratoryRisk,
    mainTwinScore,
    mainTwinLevel,
    localNews,
    healthEquityData,
    equityError,
    healthForecastData,
    scoreBreakdown,
    userProfile,
    user,
    latestSnapshot,
    snapshotStatus,
    checkinStreak,
    searchZipCode,
    resetSearch,
    setZipCode,
    refreshCheckinStreak,
  } = useDashboardData();
  const [dashboardView, setDashboardView] = useState<DashboardView>("overview");

  const navigateDashboardView = (view: DashboardView) => {
    setDashboardView(view);
    router.push(getDashboardUrl(zipCode, view));
  };

  useEffect(() => {
    const syncViewFromUrl = () => {
      if (typeof window === "undefined") return;
      const urlView = new URLSearchParams(window.location.search).get("view");
      if (isDashboardView(urlView)) {
        setDashboardView(urlView);
      } else {
        setDashboardView("overview");
      }
    };

    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);

    return () => {
      window.removeEventListener("popstate", syncViewFromUrl);
    };
  }, []);

  const dashboardTitle = city && state ? `${city}, ${state}` : "Local dashboard";

  const contextLine = useMemo(() => {
    const pieces = [airQualityLabel, heatRisk, uvRisk, dominantPollutant].filter(Boolean);
    return pieces.join(" · ");
  }, [airQualityLabel, heatRisk, uvRisk, dominantPollutant]);

  if (!searched) {
    return (
      <LandingHero
        error={error}
        loading={loading}
        onSubmit={(zip) => {
          setZipCode(zip);
          void searchZipCode(zip);
        }}
        user={user}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--primary-soft)]/30">
      <DashboardSidebar
        activeView={dashboardView}
        city={city}
        onChange={navigateDashboardView}
        state={state}
        zipCode={zipCode}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b border-[var(--border)] bg-white/85 px-6 py-3 backdrop-blur lg:px-10">
          <Link
            className="flex shrink-0 items-center gap-2 lg:hidden"
            href={getDashboardUrl(zipCode, "overview")}
          >
            <BrandMark small />
            <span className="font-heading text-base font-semibold text-[var(--primary-ink)]">
              MyLocalHealth
            </span>
          </Link>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Local health · live snapshot
            </div>
            <h1 className="font-heading text-lg font-semibold text-[var(--primary-ink)]">
              {dashboardTitle} · ZIP {zipCode}
            </h1>
          </div>
          <form
            className="ml-auto hidden items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 md:flex"
            onSubmit={(event) => {
              event.preventDefault();
              void searchZipCode(zipCode);
            }}
          >
            <Icon name="search" className="h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              className="w-48 bg-transparent text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none"
              inputMode="numeric"
              onChange={(event) => setZipCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              placeholder="Search another ZIP..."
              value={zipCode}
            />
          </form>
          <button className="rounded-full bg-[var(--primary-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary)]" onClick={resetSearch} type="button">
            New search
          </button>
          <AccountActions user={user} />
        </header>

        <main className="flex-1 space-y-6 px-6 py-6 lg:px-10">
          {dashboardView === "overview" && (
            <>
              <SummaryRow
                airQualityLabel={airQualityLabel}
                aqi={aqi}
                covidActivity={covidActivity}
                healthRisk={healthRisk}
                heatRisk={heatRisk}
              />
              <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                <DashboardForecastPanel
                  airQualityLabel={airQualityLabel}
                  healthForecastData={healthForecastData}
                  heatRisk={heatRisk}
                  zipCode={zipCode}
                />
                <DashboardTwinPanel
                  level={mainTwinLevel}
                  respiratoryRisk={respiratoryRisk}
                  score={mainTwinScore}
                  userProfile={userProfile}
                />
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                <ContributorsPanel scoreBreakdown={scoreBreakdown} zipCode={zipCode} />
                <SecondaryPanels
                  alertRisk={alertRisk}
                  fluActivity={fluActivity}
                  healthEquityLevel={healthEquityData?.equityLevel ?? "Unknown"}
                  localNews={localNews}
                />
              </div>
              <NewsPanel localNews={localNews} />
            </>
          )}

          {dashboardView === "signals" && (
            <SignalsView
              aqi={aqi}
              airQualityLabel={airQualityLabel}
              alertRisk={alertRisk}
              covidActivity={covidActivity}
              dominantPollutant={dominantPollutant}
              fluActivity={fluActivity}
              heatRisk={heatRisk}
              pollutantRisk={pollutantRisk}
              respiratoryRisk={respiratoryRisk}
              uvRisk={uvRisk}
            />
          )}

          {dashboardView === "equity" && (
            <div className="lovable-dashboard-shell">
              <HealthEquityPanel
                equityData={healthEquityData}
                equityError={equityError}
                heatRisk={heatRisk}
                pollutantRisk={pollutantRisk}
                dominantPollutant={dominantPollutant}
              />
            </div>
          )}

          {dashboardView === "checkin" && (
            <div className="lovable-dashboard-shell">
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
            </div>
          )}

          {dashboardView === "news" && <NewsPanel localNews={localNews} />}

          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            MyLocalHealth is informational only and does not provide medical advice,
            diagnosis, or treatment. {contextLine}
          </p>
        </main>
      </div>
    </div>
  );
}
