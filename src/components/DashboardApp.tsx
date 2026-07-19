"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useDashboardData } from "../contexts/DashboardDataContext";
import {
  HealthEquityPanel,
  SymptomProbabilityPanel,
  SymptomCheckinPanel,
  AiHealthPlanPanel,
  ExposureTimelinePanel,
  AnalyticsEmbedPanel,
  getDashboardUrl,
  getDashboardView,
  isDashboardView,
  type DashboardView,
  type HealthChatContext,
  type HealthPlanContext,
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
  FeatureSnapshotPanel,
  ForecastPanel,
  HealthEquityPanel,
  ModelDataSourcesPanel,
  RiskTransparencyPanel,
  SymptomProbabilityPanel,
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
      className={`${
        small ? "h-8 w-8" : "h-10 w-10"
      } relative grid shrink-0 place-items-center`}
      aria-hidden="true"
    >
      <Image
        src="/mylocalhealth-icon-white.png"
        alt=""
        width={154}
        height={123}
        priority={!small}
        className="h-full w-full object-contain invert"
      />
    </span>
  );
}

function AccountActions({ user }: { user: ReturnType<typeof useDashboardData>["user"] }) {
  if (user) {
    return (
      <Link
        className="bespoke-control px-4 py-2 text-sm"
        href="/account"
      >
        Account
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        className="bespoke-control hidden px-4 py-2 text-sm sm:inline-flex"
        href="/account"
      >
        Sign in
      </Link>
      <Link
        className="bespoke-button px-4 py-2 text-sm"
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

function labelFromScore(score: number) {
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

function clampPercent(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

const visibleDashboardViews: DashboardView[] = [
  "overview",
  "forecast",
  "twin",
  "model",
  "signals",
  "equity",
  "checkin",
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
  const [zipError, setZipError] = useState("");
  const valid = /^\d{5}$/.test(zip.trim());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!valid) {
      setZipError("Enter a valid 5-digit ZIP code to open the dashboard.");
      return;
    }

    setZipError("");
    onSubmit(zip.trim());
  };

  return (
    <main className="landing-video-page min-h-screen">
      <section className="landing-video-hero relative min-h-[100svh] overflow-hidden bg-[var(--primary-ink)]">
        <div className="landing-video-fallback" aria-hidden="true">
          <span className="landing-video-orb landing-video-orb-one" />
          <span className="landing-video-orb landing-video-orb-two" />
          <span className="landing-video-orb landing-video-orb-three" />
          <span className="landing-video-route landing-video-route-one" />
          <span className="landing-video-route landing-video-route-two" />
        </div>
        <video
          aria-hidden="true"
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted
          playsInline
          src="/neighborhood.mp4"
        />
        <div className="landing-video-shade absolute inset-0" />
        <div className="landing-video-grain absolute inset-0" />

        <div className="relative z-10 flex min-h-[100svh] flex-col px-5 py-5 text-white md:px-10 md:py-7">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link
              aria-label="MyLocalHealth home"
              className="landing-video-brand inline-flex items-center gap-3"
              href="/"
            >
              <BrandMark small />
              <span className="brand-wordmark brand-wordmark-compact text-white">
                <span className="brand-wordmark-my">My</span>
                <span className="brand-wordmark-local">Local</span>
                <span className="brand-wordmark-health landing-video-brand-health">Health</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <a
                className="landing-video-link hidden border border-white/35 px-4 py-2 register-mono text-[10px] text-white/85 transition hover:bg-white/10 sm:inline-flex"
                href="#landing-features"
              >
                Learn more
              </a>
              <AccountActions user={user} />
            </div>
          </header>

          <div className="grid flex-1 items-center gap-8 pb-6 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.72fr)] lg:gap-10 lg:pb-8 lg:pt-8">
            <div className="max-w-5xl">
              <span className="landing-video-kicker inline-flex border border-white/35 bg-white/10 px-3 py-2 register-mono text-[10px] text-white/85 backdrop-blur">
                Live local public-health forecast
              </span>
              <h1 className="mt-4 max-w-4xl font-editorial text-[clamp(3.35rem,8.2vw,7.4rem)] font-semibold italic leading-[0.87] tracking-[-0.055em] text-white">
                Health signals around you.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/84 md:text-lg">
                Search any US ZIP code to translate air quality, heat, pollen, flu, COVID wastewater, local context, and personal exposure into a clear daily snapshot.
              </p>

              <form
                id="zip-search"
                className="landing-video-search mt-6 flex max-w-xl items-center border border-white/70 bg-white/12 backdrop-blur-md"
                onSubmit={handleSubmit}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
                  <Icon name="map" className="h-4 w-4 shrink-0 text-white" />
                  <input
                    aria-label="ZIP code"
                    className="w-full bg-transparent py-4 register-mono text-sm text-white placeholder:text-white/60 focus:outline-none"
                    inputMode="numeric"
                    onChange={(event) => {
                      setZip(event.target.value.replace(/[^0-9]/g, "").slice(0, 5));
                      setZipError("");
                    }}
                    placeholder="Enter your ZIP code"
                    value={zip}
                  />
                </div>
                <button
                  className="inline-flex self-stretch items-center gap-2 border-l border-white/70 bg-white px-5 register-mono text-[11px] text-[var(--primary-ink)] transition hover:bg-white/90 disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                  {loading ? "Loading" : "View forecast"}
                </button>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 register-mono text-[10px] text-white/70">
                <span>Try:</span>
                {["27514", "10025", "94110", "60614"].map((sample) => (
                  <button
                    className="border border-white/35 bg-white/5 px-2 py-0.5 text-white transition hover:border-white hover:bg-white/15"
                    key={sample}
                    onClick={() => {
                      setZip(sample);
                      setZipError("");
                    }}
                    type="button"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {!user && (
                <p className="mt-5 max-w-xl text-sm leading-6 text-white/74">
                  Searching is free.{" "}
                  <Link className="font-semibold text-white underline underline-offset-4" href="/signup">
                    Create an account
                  </Link>{" "}
                  to save places and help your Exposure Twin learn from check-ins.
                </p>
              )}
              {loading && <p className="mt-4 register-mono text-xs text-white/80">Building your local health snapshot…</p>}
              {zipError && <p className="mt-4 text-sm font-medium text-white">{zipError}</p>}
              {error && <p className="mt-4 text-sm font-medium text-white">{error}</p>}
            </div>

            <div className="landing-video-card border border-white/24 bg-white/12 p-5 text-white shadow-2xl backdrop-blur-md md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="register-mono text-[10px] text-white/62">Sample live read</p>
                  <h2 className="mt-2 font-editorial text-2xl font-semibold italic leading-tight">
                    Moderate day. Ozone climbs by Friday.
                  </h2>
                </div>
                <span className="rounded-full border border-white/30 px-3 py-1 register-mono text-[9px] text-white/75">
                  92% conf.
                </span>
              </div>

              <div className="mt-6 grid grid-cols-3 border border-white/20">
                <LandingMiniStat icon="wind" label="Air" value="AQI 72" />
                <LandingMiniStat divider icon="spark" label="Pollen" value="High" />
                <LandingMiniStat divider icon="droplet" label="Wastewater" value="↓ 12%" />
              </div>

              <div className="mt-6">
                <div className="register-mono text-[10px] text-white/62">Seven-day exposure index</div>
                <LandingMiniForecast />
              </div>

              <p className="mt-5 border-t border-dashed border-white/25 pt-3 font-editorial text-sm italic text-white/84">
                &quot;Risk climbs late week — driven by ozone and pollen. Morning outdoor windows look best.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="landing-register-paper border border-[var(--border)] bg-[var(--background)] shadow-[0_1px_0_0_rgba(19,41,75,0.06),0_20px_40px_-24px_rgba(19,41,75,0.18)]">
          <section className="border-b border-[var(--border)] bg-[var(--background)]/60">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3 register-mono text-[10px] text-[var(--muted-foreground)] md:px-8">
              <span className="text-[var(--primary-ink)]">Signals included —</span>
              <span>OpenWeather</span>
              <span>NOAA alerts</span>
              <span>CDC FluView</span>
              <span>CDC NWSS</span>
              <span>CDC PLACES</span>
              <span>Census ACS</span>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3" id="landing-features">
            <LandingColumnCard
              body="A calibrated health-risk score for your ZIP, decomposed into the drivers that matter — air, heat, pollen, flu, and wastewater."
              eyebrow="The Forecast"
              icon="activity"
              num="03"
              stat={{ label: "Main view", value: "24-hour pulse" }}
              title="A local exposure outlook."
            />
            <LandingColumnCard
              body="A private simulation turns routine, profile factors, and symptom check-ins into a personalized exposure score — one that gets sharper every time you check in. Free account required."
              ctaHref="/signup"
              ctaLabel="Sign up"
              divider
              eyebrow="The Exposure Twin"
              icon="heart"
              num="04"
              stat={{ label: "Personal context", value: "Routine + profile" }}
              title="Your day, translated into exposure."
            />
            <LandingColumnCard
              body="Each prediction shows the data behind it — source, freshness, confidence, and contributors. No black box."
              divider
              eyebrow="Model & Data"
              icon="shield"
              num="05"
              stat={{ label: "Top promise", value: "Show the work" }}
              title="Every score with sources on record."
            />
          </section>

          <section className="border-t border-[var(--border)] bg-[var(--card)]" id="about">
            <div className="grid grid-cols-1 items-center gap-6 px-5 py-10 md:grid-cols-[1.5fr_1fr] md:px-10">
              <div>
                <span className="register-mono text-[10px] text-[var(--primary)]">
                  How it works
                </span>
                <h3 className="mt-3 font-editorial text-3xl font-semibold leading-tight text-[var(--primary-ink)] md:text-4xl">
                  Public health, translated for the block you live on.
                </h3>
                <p className="mt-3 max-w-xl text-sm text-[var(--muted-foreground)]">
                  Search a ZIP code to open the dashboard: forecast, exposure twin, local context, and model transparency views.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <a
                  className="inline-flex items-center gap-2 border border-[var(--primary-ink)] bg-[var(--primary-ink)] px-5 py-3 register-mono text-[11px] text-[var(--primary-foreground)] hover:bg-[var(--primary)]"
                  href="#zip-search"
                >
                  Search a ZIP <span aria-hidden>↗</span>
                </a>
                <a
                  className="inline-flex items-center gap-2 border border-[var(--primary-ink)] px-5 py-3 register-mono text-[11px] text-[var(--primary-ink)] hover:bg-[var(--primary-ink)] hover:text-[var(--primary-foreground)]"
                  href="#colophon"
                >
                  How the model works
                </a>
              </div>
            </div>
          </section>

          <footer className="border-t border-[var(--border)] px-5 py-6 md:px-8" id="colophon">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <LandingFooterNote
                label="Sources"
                text="OpenWeather, CDC respiratory illness data, CDC wastewater, National Weather Service alerts, CDC PLACES, Census ACS."
              />
              <LandingFooterNote
                label="Method"
                text="Composite local risk score with data freshness, confidence, and contributor views exposed to the user."
              />
              <LandingFooterNote
                label="Safety"
                text="Informational only. MyLocalHealth does not provide medical advice, diagnosis, or treatment."
              />
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function LandingMiniStat({
  icon,
  label,
  value,
  divider,
}: {
  icon: IconName;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div className={`p-3 ${divider ? "border-l border-[var(--border)]" : ""}`}>
      <div className="flex items-center gap-1.5 register-mono text-[9px] text-[var(--muted-foreground)]">
        <Icon name={icon} className="h-3 w-3 text-[var(--primary)]" />
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold tracking-tight text-[var(--primary-ink)]">
        {value}
      </div>
    </div>
  );
}

function LandingMiniForecast() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const scores = [38, 42, 55, 68, 74, 61, 48];
  const max = Math.max(...scores);

  return (
    <div className="mt-2 border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-end gap-1.5" style={{ height: 90 }}>
        {scores.map((score, index) => (
          <div className="flex flex-1 flex-col items-center gap-1" key={`${days[index]}-${index}`}>
            <div
              className="w-full bg-[var(--primary-ink)]"
              style={{ height: `${(score / max) * 78}px` }}
            />
            <span className="register-mono text-[9px] text-[var(--muted-foreground)]">
              {days[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingColumnCard({
  body,
  ctaHref = "#zip-search",
  ctaLabel = "Try it",
  divider,
  eyebrow,
  icon,
  num,
  stat,
  title,
}: {
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  divider?: boolean;
  eyebrow: string;
  icon: IconName;
  num: string;
  stat: { label: string; value: string };
  title: string;
}) {
  return (
    <article className={`landing-column-card flex flex-col p-6 md:p-8 ${divider ? "border-t border-[var(--border)] md:border-l md:border-t-0" : ""}`}>
      <div className="flex items-center gap-2">
        <Icon name={icon} className="h-3.5 w-3.5 text-[var(--primary)]" />
        <span className="register-mono text-[10px] text-[var(--primary)]">
          {num} · {eyebrow}
        </span>
      </div>
      <h3 className="mt-3 font-editorial text-2xl font-semibold leading-tight text-[var(--primary-ink)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{body}</p>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-[var(--border)] pt-4">
        <div>
          <div className="register-mono text-[9px] text-[var(--muted-foreground)]">
            {stat.label}
          </div>
          <div className="font-display text-lg font-bold tracking-tight text-[var(--primary-ink)]">
            {stat.value}
          </div>
        </div>
        <a className="inline-flex items-center gap-1 register-mono text-[10px] text-[var(--primary)] hover:text-[var(--primary-ink)]" href={ctaHref}>
          {ctaLabel} <span aria-hidden>↗</span>
        </a>
      </div>
    </article>
  );
}

function LandingFooterNote({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div>
      <div className="register-mono text-[10px] text-[var(--muted-foreground)]">
        {label}
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{text}</p>
    </div>
  );
}

export function DashboardSidebar({
  activeView,
  onChange,
  onHome,
  city,
  state,
  zipCode,
}: {
  activeView: DashboardView;
  onChange: (view: DashboardView) => void;
  onHome?: () => void;
  city: string;
  state: string;
  zipCode: string;
}) {
  return (
    <aside className="register-sidebar hidden shrink-0 sm:flex sm:flex-col">
      <button
        className="register-brand-button"
        onClick={onHome}
        type="button"
        title="MyLocalHealth home"
      >
        <BrandMark small />
        <span className="brand-wordmark brand-wordmark-sidebar">
          <span className="brand-wordmark-my">My</span>
          <span className="brand-wordmark-local">Local</span>
          <span className="brand-wordmark-health">Health</span>
        </span>
      </button>
      <div className="register-rail-nav">
        {visibleDashboardViews.map((viewId) => {
          const view = getDashboardView(viewId);
          const isActive = activeView === viewId;
          return (
            <button
              className={`register-rail-button ${
                isActive
                  ? "register-rail-button-active"
                  : ""
              }`}
              key={view.id}
              onClick={() => onChange(view.id)}
              title={view.label}
              type="button"
            >
              <span className="register-rail-number">
                {String(visibleDashboardViews.indexOf(viewId) + 1).padStart(2, "0")}
              </span>
              <Icon name={iconForView(view.id)} className="h-5 w-5" />
              <span className="register-rail-label">{view.label}</span>
            </button>
          );
        })}
      </div>
      <div className="register-rail-note">
        <div className="register-mono text-[9px] text-[var(--primary)]">Location note</div>
        <p>{city ? `${city}, ${state} · ${zipCode}` : "Search a ZIP to load local context."}</p>
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
  const router = useRouter();
  const { user, resetSearch } = useDashboardData();
  const dashboardHref = getDashboardUrl(zipCode, "overview");
  const goHome = () => {
    resetSearch();
    router.push("/");
  };

  return (
    <div className="flex min-h-screen public-health-bg lovable-dashboard-shell">
      <DashboardSidebar
        activeView={activeView}
        city={city}
        onHome={goHome}
        onChange={onNavigate}
        state={state}
        zipCode={zipCode}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-4 border-b border-[var(--border)] bg-white/85 px-6 py-3 backdrop-blur lg:px-10">
          <button
            className="flex shrink-0 items-center gap-2 lg:hidden"
            onClick={goHome}
            type="button"
          >
            <BrandMark small />
            <span className="font-heading text-base font-semibold text-[var(--primary-ink)]">
              MyLocalHealth
            </span>
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {eyebrow}
            </div>
            <h1 className="truncate font-heading text-lg font-semibold text-[var(--primary-ink)]">
              {title} · ZIP {zipCode}
            </h1>
          </div>
          <Link
            className="bespoke-control ml-auto px-4 py-2 text-sm"
            href={dashboardHref}
          >
            Dashboard
          </Link>
          <button
            className="bespoke-button hidden px-4 py-2 text-sm sm:inline-flex"
            onClick={goHome}
            type="button"
          >
            New search
          </button>
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
    <main className="grid min-h-screen place-items-center public-health-bg px-6 py-12">
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
            className="bespoke-button mt-6 px-5 py-3 text-sm"
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
  zipCode,
  healthRisk,
  aqi,
  airQualityLabel,
  heatRisk,
  covidActivity,
  detailHref,
}: {
  zipCode: string;
  healthRisk: string;
  aqi: number | null;
  airQualityLabel: string;
  heatRisk: string;
  covidActivity: string;
  detailHref: (topic: string) => string;
}) {
  const stats = [
    {
      icon: "activity" as IconName,
      label: "Overall risk",
      sub: "Composite local snapshot",
      tone: healthRisk,
      value: healthRisk,
      href: getDashboardUrl(zipCode, "model"),
    },
    {
      icon: "wind" as IconName,
      label: "Air quality",
      sub: airQualityLabel,
      tone: airQualityLabel,
      value: aqi != null ? `${aqi}` : "—",
      href: detailHref("air-quality"),
    },
    {
      icon: "thermo" as IconName,
      label: "Heat risk",
      sub: "Outdoor exposure pressure",
      tone: heatRisk,
      value: heatRisk,
      href: detailHref("heat-risk"),
    },
    {
      icon: "droplet" as IconName,
      label: "COVID wastewater",
      sub: "CDC NWSS signal",
      tone: covidActivity,
      value: covidActivity,
      href: detailHref("covid-wastewater"),
    },
  ];

  return (
    <div className="register-summary-grid">
      {stats.map((stat, index) => (
        <Link
          className={`register-tile group ${index === 0 ? "register-tile-featured" : ""}`}
          href={stat.href}
          key={stat.label}
        >
          <span className="register-fig">Signal {String(index + 1).padStart(2, "0")}</span>
          <div className="register-tile-label">
            <Icon name={stat.icon} className="h-4 w-4" />
            {stat.label}
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="register-tile-value">{stat.value}</div>
            {index === 0 && <span className="register-tile-delta">+ live</span>}
          </div>
          <div className="mt-4 border-t border-dashed border-[var(--border)] pt-3 text-sm text-[var(--muted-foreground)]">
            {stat.sub}
          </div>
          {index === 0 && (
            <p className="mt-3 text-sm leading-snug text-[var(--primary-ink)]/80">
              &quot;Current score is driven by the strongest local signals available for this ZIP.&quot;
            </p>
          )}
          <span className="register-open-link">
            Open details →
          </span>
          <span className={`sr-only ${toneClass(stat.tone)}`}>
            {stat.tone}
          </span>
        </Link>
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const bars =
    healthForecastData?.hours.slice(0, 7).map((hour) => ({
      label: hour.displayTime.replace(/^[A-Za-z]+,?\s?/, ""),
      risk: hour.score,
      riskLabel: hour.risk,
      drivers: hour.drivers,
      aqi: hour.usAqi,
      temp: hour.apparentTemperature,
      uv: hour.uvIndex,
      pollen: hour.pollenRisk,
    })) ??
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => ({
      label,
      risk: [38, 42, 55, 68, 74, 61, 48][index],
      riskLabel: labelFromScore([38, 42, 55, 68, 74, 61, 48][index]),
      drivers: ["Estimated from the current local risk profile."],
      aqi: null,
      temp: null,
      uv: null,
      pollen: "Unknown",
    }));
  const selectedBar = bars[Math.min(selectedIndex, bars.length - 1)];
  const selectedDrivers =
    selectedBar?.drivers && selectedBar.drivers.length > 0
      ? selectedBar.drivers.slice(0, 3)
      : ["No dominant driver is available for this time window yet."];

  return (
    <section className="register-panel p-6" id="forecast">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">Forecast</div>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">Local risk pulse</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Air quality is {airQualityLabel.toLowerCase()}; heat risk is {heatRisk.toLowerCase()}.
          </p>
        </div>
        <Link className="register-mini-button" href={getDashboardUrl(zipCode, "forecast")}>
          Full forecast
        </Link>
      </div>
      <div className="register-chart-frame mt-6 flex h-[280px] items-end gap-3 px-3 pb-4">
        {bars.map((bar, index) => {
          const selected = selectedIndex === index;
          return (
          <button
            aria-pressed={selected}
            className="group flex min-w-0 flex-1 flex-col items-center gap-2 focus:outline-none"
            key={`${bar.label}-${index}`}
            onClick={() => setSelectedIndex(index)}
            type="button"
          >
            <div className="relative w-full">
              <div
                className={`register-bar mx-auto w-full transition group-hover:opacity-80 ${
                  selected ? "ring-4 ring-[var(--primary)]/20" : ""
                }`}
                style={{ height: `${Math.max(26, bar.risk * 2.4)}px` }}
              />
              <span className={`register-tooltip absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] ${
                selected ? "block" : "hidden group-hover:block"
              }`}>
                {bar.risk}
              </span>
            </div>
            <span className={`truncate text-[11px] font-medium ${selected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>{bar.label}</span>
          </button>
          );
        })}
      </div>
      {selectedBar && (
        <div className="register-inset-panel mt-4 grid gap-3 p-4 text-sm md:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">
              Selected window
            </div>
            <div className="mt-1 font-heading text-xl font-semibold text-[var(--primary-ink)]">
              {selectedBar.label} · {selectedBar.riskLabel} risk
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
              <span>AQI {selectedBar.aqi ?? "—"}</span>
              <span>Feels like {selectedBar.temp != null ? `${Math.round(selectedBar.temp)}°F` : "—"}</span>
              <span>UV {selectedBar.uv != null ? selectedBar.uv.toFixed(1) : "—"}</span>
              <span>Pollen {selectedBar.pollen}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Why this score
            </div>
            <ul className="mt-2 space-y-1.5 text-[var(--primary-ink)]">
              {selectedDrivers.map((driver) => (
                <li className="flex gap-2" key={driver}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-[var(--warning)]" />
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
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
  const [outsideMinutes, setOutsideMinutes] = useState(userProfile?.outdoor_exposure === "High" ? 120 : userProfile?.outdoor_exposure === "Low" ? 20 : 60);
  const [activityLevel, setActivityLevel] = useState(userProfile?.activity_level === "High" ? 75 : userProfile?.activity_level === "Low" ? 20 : 45);
  const [trafficMinutes, setTrafficMinutes] = useState(userProfile?.commute_exposure === "High" ? 80 : userProfile?.commute_exposure === "Low" ? 10 : 35);
  const [indoorBuffer, setIndoorBuffer] = useState(25);

  useEffect(() => {
    setOutsideMinutes(userProfile?.outdoor_exposure === "High" ? 120 : userProfile?.outdoor_exposure === "Low" ? 20 : 60);
    setActivityLevel(userProfile?.activity_level === "High" ? 75 : userProfile?.activity_level === "Low" ? 20 : 45);
    setTrafficMinutes(userProfile?.commute_exposure === "High" ? 80 : userProfile?.commute_exposure === "Low" ? 10 : 35);
  }, [userProfile]);

  const adjustment =
    outsideMinutes * 0.08 +
    activityLevel * 0.09 +
    trafficMinutes * 0.06 -
    indoorBuffer * 0.12 -
    13;
  const simulatedScore = clampPercent(score + adjustment);
  const simulatedLevel = labelFromScore(simulatedScore);
  const circle = Math.max(0, Math.min(100, simulatedScore));
  const profileSignal = userProfile ? Math.min(92, 28 + activityLevel * 0.38 + outsideMinutes * 0.12) : Math.min(72, 18 + activityLevel * 0.3);
  const outdoorDelta = simulatedScore - score;

  return (
    <section className="register-panel flex flex-col p-6" id="twin">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">Exposure Twin</div>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">Your day, modeled</h2>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass(simulatedLevel)}`}>{simulatedLevel}</div>
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
            <div className="font-heading text-3xl font-semibold text-[var(--primary-ink)]">{Math.round(simulatedScore)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">/ 100</div>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <TwinLine label="Environment" value={percentFromRisk(level, score)} color="primary" />
          <TwinLine label="Respiratory" value={percentFromRisk(respiratoryRisk, 44)} color="warning" />
          <TwinLine label="Profile" value={profileSignal} color="success" />
        </div>
      </div>
      <div className="register-inset-panel mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">
              What-if simulator
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Adjust the day plan to see how the Twin score changes.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${outdoorDelta > 5 ? toneClass("High") : outdoorDelta < -5 ? toneClass("Low") : toneClass("Moderate")}`}>
            {outdoorDelta >= 0 ? "+" : ""}
            {outdoorDelta} vs current
          </span>
        </div>
        <div className="mt-4 grid gap-4">
          <TwinSlider
            label="Time outside"
            max={180}
            min={0}
            onChange={setOutsideMinutes}
            suffix=" min"
            value={outsideMinutes}
          />
          <TwinSlider
            label="Activity intensity"
            max={100}
            min={0}
            onChange={setActivityLevel}
            suffix="%"
            value={activityLevel}
          />
          <TwinSlider
            label="Traffic exposure"
            max={120}
            min={0}
            onChange={setTrafficMinutes}
            suffix=" min"
            value={trafficMinutes}
          />
          <TwinSlider
            label="Indoor/protection buffer"
            max={100}
            min={0}
            onChange={setIndoorBuffer}
            suffix="%"
            value={indoorBuffer}
          />
        </div>
      </div>
      <div className="register-inset-panel mt-6 p-4">
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

function TwinSlider({
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[var(--primary-ink)]">{label}</span>
        <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 font-semibold text-[var(--primary)]">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <input
        className="mt-2 w-full accent-[var(--primary)]"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const rows = scoreBreakdown.categoryScores.slice(0, 6).map((item, index) => ({
    factor: item.label,
    value: Math.max(10, Math.min(100, Math.round(item.score))),
    baseline: [32, 40, 36, 28, 30, 34][index] ?? 30,
    detail: item.detail,
    advice: adviceForContributor(item.label),
  }));
  const selected = rows[Math.min(selectedIndex, Math.max(0, rows.length - 1))];
  const currentPolygon = makeRadarPolygon(rows.map((row) => row.value));
  const baselinePolygon = makeRadarPolygon(rows.map((row) => row.baseline));
  const selectedDelta = selected ? selected.value - selected.baseline : 0;
  const selectedInterpretation =
    selectedDelta > 12
      ? "This contributor is meaningfully above its baseline and is likely pushing the overall score upward."
      : selectedDelta < -12
      ? "This contributor is below baseline for this ZIP snapshot and is likely reducing the overall score."
      : "This contributor is close to baseline, so it is not strongly moving the score either way.";

  return (
    <section className="register-panel p-6" id="model">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">Model & Data</div>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">Interactive risk explorer</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Tap a driver to see what it means, how it compares with baseline, and what to do next.</p>
        </div>
        <Link className="register-mini-button" href={getDashboardUrl(zipCode, "model")}>
          Methodology
        </Link>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {rows.map((row, index) => {
          const active = selectedIndex === index;
          return (
            <button
              className={`register-factor-button shrink-0 border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "register-factor-button-active"
                  : ""
              }`}
              key={row.factor}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              {row.factor}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="register-callout mt-3 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">
                Plain-English readout
              </div>
              <h3 className="mt-1 font-heading text-2xl font-semibold text-[var(--primary-ink)]">
                {selected.factor}
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                {selected.detail}
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--primary-ink)]">
                {selectedInterpretation}
              </p>
              <p className="register-inset-panel mt-3 p-3 text-sm leading-6 text-[var(--primary-ink)]">
                <span className="font-semibold text-[var(--primary)]">What to do:</span>{" "}
                {selected.advice}
              </p>
            </div>
            <div className="grid min-w-[17rem] grid-cols-3 gap-2 text-center">
              <MetricPill label="Current" value={`${selected.value}`} />
              <MetricPill label="Baseline" value={`${selected.baseline}`} />
              <MetricPill label="Change" value={`${selectedDelta >= 0 ? "+" : ""}${selectedDelta}`} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-6 xl:grid-cols-[0.85fr_1fr] xl:items-start">
        <div className="register-inset-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">
                Driver map
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Current conditions are blue; baseline is the dashed amber outline.
              </p>
            </div>
            <div className="flex gap-3 text-[11px] text-[var(--muted-foreground)]">
              <Legend color="var(--primary)" label="Current" />
              <Legend color="var(--warning)" label="Baseline" />
            </div>
          </div>

          <div className="mt-4 grid place-items-center">
            <div className="grid min-h-[260px] w-full place-items-center">
              <svg className="h-[260px] w-full max-w-[430px] overflow-visible" viewBox="0 0 260 260">
                <defs>
                  <filter id="radarGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {[28, 52, 76, 100].map((radius) => (
                  <circle cx="130" cy="130" fill="none" key={radius} r={radius} stroke="var(--border)" />
                ))}
                {rows.map((row, index) => {
                  const total = Math.max(1, rows.length);
                  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
                  const axisX = 130 + Math.cos(angle) * 100;
                  const axisY = 130 + Math.sin(angle) * 100;
                  const pointX = 130 + Math.cos(angle) * (22 + row.value * 0.7);
                  const pointY = 130 + Math.sin(angle) * (22 + row.value * 0.7);
                  const label = radarLabelPosition(angle);
                  const isSelected = selectedIndex === index;

                  return (
                    <g key={row.factor}>
                      <line stroke="var(--border)" x1="130" x2={axisX} y1="130" y2={axisY} />
                      <text
                        fill={isSelected ? "var(--primary)" : "var(--muted-foreground)"}
                        fontSize="8.5"
                        fontWeight={isSelected ? 700 : 500}
                        textAnchor={label.anchor}
                        x={label.x}
                        y={label.y}
                      >
                        {splitFactorLabel(row.factor).map((part, partIndex) => (
                          <tspan
                            dy={partIndex === 0 ? 0 : 10}
                            key={part}
                            x={label.x}
                          >
                            {part}
                          </tspan>
                        ))}
                      </text>
                      <circle
                        aria-label={`View ${row.factor} details`}
                        className="cursor-pointer transition"
                        cx={pointX}
                        cy={pointY}
                        fill={isSelected ? "var(--primary-ink)" : "var(--primary)"}
                        filter={isSelected ? "url(#radarGlow)" : undefined}
                        onClick={() => setSelectedIndex(index)}
                        onFocus={() => setSelectedIndex(index)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        r={isSelected ? 7 : 5}
                        tabIndex={0}
                        role="button"
                      />
                    </g>
                  );
                })}
                <polygon fill="rgba(245,158,11,.08)" points={baselinePolygon} stroke="var(--warning)" strokeDasharray="5 5" strokeWidth="2" pointerEvents="none" />
                <polygon fill="rgba(75,156,211,.22)" points={currentPolygon} stroke="var(--primary)" strokeWidth="3" pointerEvents="none" />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="register-inset-panel p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">
              Tap to inspect
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              The longest bars are not always bad. Compare the current score with baseline to see what is unusual today.
            </p>
          </div>
          <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.factor}>
              <button
                className={`register-factor-row w-full border px-4 py-3 text-left transition ${
                  selected?.factor === row.factor
                    ? "register-factor-row-active"
                    : ""
                }`}
                onClick={() => setSelectedIndex(rows.findIndex((item) => item.factor === row.factor))}
                type="button"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[var(--primary-ink)]">{row.factor}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">Baseline {row.baseline} · Current {row.value}</div>
                  </div>
                  <div className={row.value > row.baseline ? "text-sm font-semibold text-[var(--danger)]" : "text-sm font-semibold text-[var(--success)]"}>
                    {row.value > row.baseline ? "+" : ""}
                    {row.value - row.baseline}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="h-2 overflow-hidden bg-[var(--paper)]">
                    <div className="h-full bg-[var(--primary)]" style={{ width: `${row.value}%` }} />
                  </div>
                  <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                    Inspect →
                  </span>
                </div>
              </button>
            </li>
          ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function makeRadarPolygon(values: number[]) {
  return values
    .map((value, index) => {
      const total = Math.max(1, values.length);
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const radius = 22 + Math.max(0, Math.min(100, value)) * 0.7;
      return `${130 + Math.cos(angle) * radius},${130 + Math.sin(angle) * radius}`;
    })
    .join(" ");
}

function radarLabelPosition(angle: number) {
  const rawX = 130 + Math.cos(angle) * 116;
  const rawY = 134 + Math.sin(angle) * 116;
  const x = Math.max(26, Math.min(234, rawX));
  const y = Math.max(18, Math.min(238, rawY));
  const cosine = Math.cos(angle);
  const anchor: "start" | "middle" | "end" =
    cosine > 0.35 ? "end" : cosine < -0.35 ? "start" : "middle";

  return { x, y, anchor };
}

function splitFactorLabel(label: string) {
  if (label === "Infectious disease") return ["Infectious", "disease"];
  if (label === "Outdoor environment") return ["Outdoor", "environment"];
  if (label === "Personal modifier") return ["Personal", "modifier"];
  return [label];
}

function adviceForContributor(label: string) {
  if (label === "Respiratory") {
    return "If you are sensitive to breathing symptoms, check the air and illness signals before intense outdoor activity.";
  }
  if (label === "Infectious disease") {
    return "Use this as a community signal: consider crowded indoor exposure, recent symptoms, and basic precautions when activity is elevated.";
  }
  if (label === "Outdoor environment") {
    return "Shift harder outdoor activity toward lower-risk windows and watch heat, UV, pollen, and air quality together.";
  }
  if (label === "Personal modifier") {
    return "Sign in and keep your profile/check-ins current so the model can better reflect your routine and sensitivities.";
  }
  return "Open the methodology view to see the source and weight for this contributor.";
}

type TopDriver = ReturnType<typeof useDashboardData>["scoreBreakdown"]["topDrivers"][number];

// Turns the highest-weighted risk factor into one plain-language, actionable
// sentence for the average user -- the technical driver breakdown (radar
// chart, per-category scores) stays available below via ContributorsPanel,
// but most people just want "what's elevated and what should I do."
function driverAdviceSentence(driver: TopDriver) {
  const detail = driver.detail.toLowerCase();
  const isTopFactor = driver.points / driver.maxPoints >= 0.75;
  const lead = isTopFactor ? " — the biggest factor" : "";

  switch (driver.label) {
    case "Air quality":
      return `Air quality is ${detail} right now${lead}. Limit outdoor exertion if you have asthma or another respiratory condition.`;
    case "Pollutant signal":
      return `A specific pollutant is elevated today${lead}. Sensitive groups should limit time outdoors.`;
    case "Heat":
      return `Heat risk is ${detail} today${lead}. Stay hydrated and avoid strenuous activity during peak afternoon heat.`;
    case "UV":
      return `UV levels are ${detail} today${lead}. Wear sunscreen and sun protection if you'll be outside for more than a few minutes.`;
    case "Official alerts":
      return `There's an active local alert${lead}. Check official guidance before heading out.`;
    case "Flu activity":
      return `Flu activity is ${detail} in your area${lead}. Consider extra precautions in crowded indoor spaces.`;
    case "COVID wastewater":
      return `COVID wastewater signal is ${detail} in your area${lead}. Consider extra precautions if you're at higher risk.`;
    case "Profile factors":
      return `Your profile adds some risk today (${driver.detail}). Keep your check-ins current for a more personalized picture.`;
    default:
      return "See the sections below for what's driving today's score.";
  }
}

function buildTodayVerdict(healthRisk: string, topDrivers: TopDriver[]) {
  const leadDriver = topDrivers[0];

  if (!leadDriver || leadDriver.points === 0) {
    return {
      headline: "No major risk factors today.",
      sentence:
        "Conditions look close to normal — a good day for typical outdoor activity.",
      tone: "low" as const,
    };
  }

  const tone =
    healthRisk.toLowerCase() === "high"
      ? ("high" as const)
      : healthRisk.toLowerCase() === "moderate"
      ? ("moderate" as const)
      : ("low" as const);

  return {
    headline: `${healthRisk} risk today.`,
    sentence: driverAdviceSentence(leadDriver),
    tone,
  };
}

function riskToneClass(tone: "low" | "moderate" | "high") {
  switch (tone) {
    case "low":
      return "border-[var(--secondary)] bg-[var(--secondary-soft)] text-[var(--secondary)]";
    case "moderate":
      return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]";
    case "high":
      return "border-[var(--accent-ink)] bg-[var(--accent)]/18 text-[var(--accent-ink)]";
  }
}

// CDC NWSS wastewater data is published roughly weekly; if the freshest
// record we got back is well past that cadence, showing it next to a "Live"
// badge as if it were current would overstate how current the signal is.
const STALE_THRESHOLD_DAYS = 21;

function daysSince(dateString: string | undefined) {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  return (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
}

function buildFreshnessBadge(
  dataConfidence: ReturnType<typeof useDashboardData>["dataConfidence"],
  covidUpdatedAt: string | undefined
) {
  const covidAgeDays = daysSince(covidUpdatedAt);
  const covidStale = covidAgeDays !== null && covidAgeDays > STALE_THRESHOLD_DAYS;

  if (dataConfidence.label === "Low") {
    return {
      text: "Limited data · several sources unavailable",
      tone: "warn" as const,
    };
  }
  if (covidStale) {
    return { text: "Live · some sources delayed", tone: "warn" as const };
  }
  if (dataConfidence.label === "Medium") {
    return { text: "Live · partial data", tone: "info" as const };
  }
  return { text: "Live · data-linked", tone: "ok" as const };
}

function freshnessToneClass(tone: "ok" | "info" | "warn") {
  switch (tone) {
    case "ok":
      return "text-[var(--primary)]";
    case "info":
      return "text-[var(--muted-foreground)]";
    case "warn":
      return "text-[var(--warning)]";
  }
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="register-metric-pill p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-1 font-heading text-lg font-semibold text-[var(--primary-ink)]">
        {value}
      </div>
    </div>
  );
}

function SecondaryPanels({
  zipCode,
  fluActivity,
  localNews,
  healthEquityLevel,
  alertRisk,
  detailHref,
}: {
  zipCode: string;
  fluActivity: string;
  localNews: ReturnType<typeof useDashboardData>["localNews"];
  healthEquityLevel: string;
  alertRisk: string;
  detailHref: (topic: string) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SmallPanel description="CDC respiratory illness signal" href={detailHref("flu-activity")} icon="wind" label="Flu activity" title={fluActivity} />
      <SmallPanel description="Community vulnerability context" href={detailHref("health-equity")} icon="users" label="Health equity" title={healthEquityLevel} />
      <SmallPanel description="Official severe-weather context" href={detailHref("weather-alerts")} icon="alert" label="Weather alerts" title={alertRisk} />
      <SmallPanel description="Recent local health articles" href={getDashboardUrl(zipCode, "news")} icon="bell" label="Local news" title={`${localNews.length} articles`} />
    </div>
  );
}

function SmallPanel({
  description,
  href,
  icon,
  label,
  title,
}: {
  description: string;
  href: string;
  icon: IconName;
  label: string;
  title: string;
}) {
  return (
    <Link className="register-small-panel group p-4" href={href}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
          <div className="mt-2 font-heading text-xl font-semibold text-[var(--primary-ink)]">{title}</div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>
          <div className="mt-2 text-xs font-semibold text-[var(--primary)] opacity-0 transition group-hover:opacity-100">
            Open details →
          </div>
        </div>
        <div className={`grid h-10 w-10 place-items-center ${toneClass(title)}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function NewsPanel({ localNews }: { localNews: ReturnType<typeof useDashboardData>["localNews"] }) {
  const items = localNews.slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section className="register-panel p-6">
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
      <div className="register-panel p-6">
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
            className="register-small-panel p-5"
            key={signal.label}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center border border-[var(--border)] bg-[var(--paper-deep)] text-[var(--primary)]">
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
    covidData,
    environmentData,
    weatherAlerts,
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
    dataConfidence,
    symptomPrediction,
    userProfile,
    user,
    latestSnapshot,
    snapshotStatus,
    checkinStreak,
    searchZipCode,
    resetSearch,
    setZipCode,
    refreshCheckinStreak,
    personalizationSummary,
    personalizedRiskReasons,
    modelVersion,
  } = useDashboardData();
  const [dashboardView, setDashboardView] = useState<DashboardView>("overview");
  const analyticsEmbedUrl =
    process.env.NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL ??
    process.env.NEXT_PUBLIC_TABLEAU_EMBED_URL ??
    "";
  const analyticsProvider = process.env.NEXT_PUBLIC_LOOKER_STUDIO_EMBED_URL
    ? "Looker Studio"
    : process.env.NEXT_PUBLIC_TABLEAU_EMBED_URL
    ? "Tableau"
    : "Ready for Tableau or Looker";
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
    profileReasons: personalizedRiskReasons,
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
      version: modelVersion,
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

  useEffect(() => {
    if (!searched || typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [searched, zipCode]);

  const navigateDashboardView = (view: DashboardView) => {
    setDashboardView(view);
    router.push(getDashboardUrl(zipCode, view));
  };
  const goHome = () => {
    resetSearch();
    router.push("/");
  };

  // Builds a /details/[topic] link with the full signal context that page
  // reads from query params (it doesn't re-fetch on its own -- see
  // src/app/details/[topic]/page.tsx). Every "Open details" link must go
  // through this, not a bare `/details/${topic}?zipCode=${zipCode}` --
  // that was the previous bug, which left every field on the details page
  // reading as "Unavailable".
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
        healthEquityData?.cdcPlaces?.chronicBurdenScore?.toString() ?? "",
      placesAsthma: healthEquityData?.cdcPlaces?.asthma?.toString() ?? "",
      placesCopd: healthEquityData?.cdcPlaces?.copd?.toString() ?? "",
      placesSmoking: healthEquityData?.cdcPlaces?.smoking?.toString() ?? "",
      placesObesity: healthEquityData?.cdcPlaces?.obesity?.toString() ?? "",
      placesDiabetes:
        healthEquityData?.cdcPlaces?.diabetes?.toString() ?? "",
      healthRisk,
      respiratoryRisk,
    });

    return `/details/${topic}?${params.toString()}`;
  };

  const todayVerdict = useMemo(
    () => buildTodayVerdict(healthRisk, scoreBreakdown.topDrivers),
    [healthRisk, scoreBreakdown.topDrivers]
  );

  const freshnessBadge = useMemo(
    () => buildFreshnessBadge(dataConfidence, covidData?.updatedAt),
    [dataConfidence, covidData?.updatedAt]
  );

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
    <div className="register-shell flex min-h-screen">
      <DashboardSidebar
        activeView={dashboardView}
        city={city}
        onHome={goHome}
        onChange={navigateDashboardView}
        state={state}
        zipCode={zipCode}
      />
      <div className="register-document flex min-w-0 flex-1 flex-col">
        <header className="register-topbar">
          <button
            className="flex shrink-0 items-center gap-2 sm:hidden"
            onClick={goHome}
            type="button"
          >
            <BrandMark small />
            <span className="font-heading text-base font-semibold text-[var(--primary-ink)]">
              MyLocalHealth
            </span>
          </button>
          <button className="register-menu-button hidden sm:inline-flex" type="button" aria-label="Menu">
            <span />
            <span />
            <span />
          </button>
          <div className="hidden sm:block">
            <div className="register-mono text-[var(--muted-foreground)]">
              Updated live
            </div>
          </div>
          <form
            className="register-zip-form ml-auto hidden md:flex"
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
          <button
            className="register-icon-button hidden sm:inline-flex"
            onClick={() => navigateDashboardView("signals")}
            title="View alerts and health signals"
            type="button"
            aria-label="View alerts and health signals"
          >
            <Icon name="bell" className="h-5 w-5" />
            <span />
          </button>
          <button className="register-action-button" onClick={goHome} type="button">
            + New search
          </button>
          <AccountActions user={user} />
        </header>

        <section aria-label="Location and status" className="register-masthead">
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="register-mono text-[var(--muted-foreground)]">MyLocalHealth</span>
            <h2>Local health snapshot</h2>
          </div>
          <div className="register-masthead-meta">
            <span>{dashboardTitle}</span>
            <span>ZIP · {zipCode}</span>
            <span className={freshnessToneClass(freshnessBadge.tone)}>
              {freshnessBadge.text}
            </span>
          </div>
        </section>

        <main className="lovable-dashboard-shell flex-1 px-5 py-6 md:px-8 lg:px-10">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {visibleDashboardViews.map((viewId) => {
              const view = getDashboardView(viewId);
              const active = dashboardView === viewId;
              return (
                <button
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--primary-ink)]"
                  }`}
                  key={view.id}
                  onClick={() => navigateDashboardView(view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              );
            })}
          </div>

          {dashboardView === "overview" && (
            <>
              <section className="register-page-intro">
                <span className="spec-tab">Today&apos;s summary</span>
                <h1>Today in {zipCode}.</h1>
                <div
                  className={`mt-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${riskToneClass(
                    todayVerdict.tone
                  )}`}
                >
                  {todayVerdict.headline}
                </div>
                <p className="mt-3">{todayVerdict.sentence}</p>
                <button
                  className="register-action-button mt-6"
                  onClick={() => navigateDashboardView("forecast")}
                  type="button"
                >
                  Open forecast ↗
                </button>
              </section>
              {user ? (
                <button
                  className="mt-6 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left transition hover:border-[var(--primary-ink)]"
                  onClick={() => navigateDashboardView("checkin")}
                  type="button"
                >
                  <p className="text-sm text-[var(--primary-ink)]">
                    {checkinStreak.checkedInToday
                      ? `Checked in today — ${checkinStreak.currentStreak}-day streak. Nice work.`
                      : checkinStreak.currentStreak > 0
                      ? `${checkinStreak.currentStreak}-day check-in streak. Keep it going today.`
                      : "Check in today to start your streak and sharpen your personal exposure score."}
                  </p>
                  <span className="register-mono text-[10px] text-[var(--primary)]">
                    {checkinStreak.checkedInToday ? "View check-in" : "Check in"} →
                  </span>
                </button>
              ) : (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-3">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    This is the ZIP-level snapshot.{" "}
                    <strong className="text-[var(--primary-ink)]">
                      Sign in and check in daily
                    </strong>{" "}
                    to unlock your personal Exposure Twin score.
                  </p>
                  <Link className="register-mini-button" href="/signup">
                    Create free account
                  </Link>
                </div>
              )}
              {dataConfidence.caveats.length > 0 && (
                <div className="mt-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                    {dataConfidence.availableCount}/{dataConfidence.totalCount} data sources loaded
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-[var(--foreground-muted)]">
                    {dataConfidence.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="register-section-kicker">
                <span>Snapshot</span>
                <em>Key signals</em>
                <strong>Live · updated now</strong>
              </div>
              <SummaryRow
                airQualityLabel={airQualityLabel}
                aqi={aqi}
                covidActivity={covidActivity}
                detailHref={detailHref}
                healthRisk={healthRisk}
                heatRisk={heatRisk}
                zipCode={zipCode}
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
              <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
                <ContributorsPanel scoreBreakdown={scoreBreakdown} zipCode={zipCode} />
                <div className="grid content-start gap-4 self-start">
                  <SymptomProbabilityPanel
                    compact
                    prediction={symptomPrediction}
                  />
                  <SecondaryPanels
                    alertRisk={alertRisk}
                    detailHref={detailHref}
                    fluActivity={fluActivity}
                    healthEquityLevel={healthEquityData?.equityLevel ?? "Unknown"}
                    localNews={localNews}
                    zipCode={zipCode}
                  />
                </div>
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

          {dashboardView === "plan" && (
            <div className="lovable-dashboard-shell">
              <AiHealthPlanPanel planContext={healthPlanContext} />
            </div>
          )}

          {dashboardView === "timeline" && (
            <div className="lovable-dashboard-shell">
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
            </div>
          )}

          {dashboardView === "analytics" && (
            <div className="lovable-dashboard-shell">
              <AnalyticsEmbedPanel
                embedUrl={analyticsEmbedUrl}
                provider={analyticsProvider}
              />
            </div>
          )}

          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            MyLocalHealth is informational only and does not provide medical advice,
            diagnosis, or treatment. {contextLine}
          </p>
        </main>
      </div>
    </div>
  );
}
