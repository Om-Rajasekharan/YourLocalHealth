"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getAirQualityLabel,
  getDominantPollutant,
  getPollutantRiskLabel,
} from "../lib/airQuality";
import {
  calculateHealthRisk,
  calculateRespiratoryRisk,
} from "../lib/healthRisk";
import { personalizeRisk } from "../lib/personalizedRisk";
import { getLocation } from "../services/location";
import { getAirQuality } from "../services/airsQuality";
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
import { supabase } from "../lib/supabaseClient";

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

function riskBadgeClass(risk: string) {
  switch (risk) {
    case "Low":
    case "Very Low":
      return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
    case "Moderate":
      return "border-violet-300/40 bg-violet-400/10 text-violet-200";
    case "High":
    case "Very High":
      return "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-200";
    default:
      return "border-white/15 bg-white/10 text-slate-200";
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
      className="group block rounded-lg outline-none transition focus:ring-4 focus:ring-cyan-400/20"
    >
    <article className="rounded-lg border border-white/10 bg-[#111a33]/85 p-5 shadow-lg shadow-black/20 transition group-hover:-translate-y-0.5 group-hover:border-cyan-300/50 group-hover:bg-[#16213f] group-hover:shadow-cyan-950/40">
      <div className="flex min-h-24 flex-col justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 transition group-hover:text-cyan-200">
            {title}
          </h3>
          <div className="mt-3">
            <RiskBadge value={value} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {detail}
          </p>
        </div>
        <p className="border-t border-white/10 pt-3 text-xs text-slate-400">
          {source}
        </p>
        <p className="text-xs font-semibold text-cyan-200">
          View details
        </p>
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

function TodayHealthBrief({
  healthRisk,
  headline,
  drivers,
  focusItems,
  profileNote,
}: {
  healthRisk: string;
  headline: string;
  drivers: { label: string; value: string; note: string }[];
  focusItems: string[];
  profileNote: string;
}) {
  return (
    <section className="mb-5 rounded-lg border border-cyan-300/20 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            Today&apos;s Health Brief
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {headline}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This brief summarizes the strongest signals from today&apos;s local
            air, heat, UV, alert, respiratory illness, wastewater, and profile
            context.
          </p>
        </div>
        <RiskBadge value={healthRisk} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Main drivers
          </p>
          {drivers.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {drivers.map((driver) => (
                <div
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={driver.label}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {driver.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {driver.note}
                    </p>
                  </div>
                  <RiskBadge value={driver.value} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              No moderate or high drivers were detected from the current data.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Suggested focus
          </p>
          <ul className="mt-3 grid gap-3">
            {focusItems.map((item) => (
              <li
                className="rounded-lg border border-white/10 bg-black/10 p-3 text-sm leading-6 text-slate-200"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-3 text-xs leading-5 text-cyan-100">
            {profileNote}
          </p>
        </div>
      </div>
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
    <section className="mt-5 rounded-lg border border-cyan-300/20 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
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
                ? "ml-auto max-w-[85%] border-violet-300/30 bg-violet-500/15 text-violet-50"
                : "mr-auto max-w-[90%] border-cyan-300/20 bg-cyan-400/10 text-slate-100"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {message.role === "user" ? "You" : "YourLocalHealth"}
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
          className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-4 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/20"
        />
        <button
          type="submit"
          disabled={chatLoading}
          className="h-12 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
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

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [aqi, setAqi] = useState<number | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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
  const baseHealthRisk = calculateHealthRisk(
    aqi,
    fluActivity,
    covidActivity,
    {
      heatRisk,
      uvRisk,
      alertRisk,
      pollutantRisk,
    }
  );
  const baseRespiratoryRisk = calculateRespiratoryRisk(
    aqi,
    fluActivity,
    covidActivity,
    {
      alertRisk,
      pollutantRisk,
    }
  );
  const personalizedRisk = personalizeRisk(
    baseHealthRisk,
    baseRespiratoryRisk,
    userProfile
  );
  const healthRisk = personalizedRisk.healthRisk;
  const respiratoryRisk = personalizedRisk.respiratoryRisk;
  const personalizationSummary = personalizedRisk.isPersonalized
    ? personalizedRisk.reasons.length > 0
      ? `Personalized based on ${personalizedRisk.reasons.join(", ")}.`
      : "Personalized with your saved profile. No added exposure factors were found."
    : "Based on public local data only.";
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
  const airQualityLabel = getAirQualityLabel(aqi);
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
    personalizedRiskReasons: personalizedRisk.reasons,
    isPersonalized: personalizedRisk.isPersonalized,
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
    profileReasons: personalizedRisk.reasons,
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
      healthRisk,
      respiratoryRisk,
    });

    return `/details/${topic}?${params.toString()}`;
  };

  const searchZipCode = async (zipToSearch: string) => {
    setZipCode(zipToSearch);
    setError("");
    setNewsError("");
    setLocalNews([]);
    setEnvironmentData(null);
    setWeatherAlerts([]);
    setAirComponents(undefined);
    setSearched(false);
    setLoading(true);

    try {
      const location = await getLocation(zipToSearch);

      setCity(location.city);
      setState(location.state);
      setLatitude(location.latitude);
      setLongitude(location.longitude);

      const fluData = await getFluData(location.state);
      setFluActivity(fluData);

      const covidActivityData = await getCovidData(location.state);
      setCovidData(covidActivityData);

      const [airData, environment, alerts] = await Promise.all([
        getAirQuality(location.latitude, location.longitude),
        getEnvironmentData(location.latitude, location.longitude),
        getWeatherAlerts(location.latitude, location.longitude),
      ]);

      setAqi(airData.list?.[0]?.main.aqi ?? null);
      setAirComponents(airData.list?.[0]?.components);
      setEnvironmentData(environment);
      setWeatherAlerts(alerts);
      setSearched(true);

      setNewsLoading(true);
      try {
        const news = await getLocalHealthNews(
          location.city,
          location.state
        );
        setLocalNews(news);
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
    const params = new URLSearchParams(window.location.search);
    const restoredZipCode = params.get("zipCode");

    if (
      restoredZipCode &&
      restoredZipCode !== restoredZipRef.current
    ) {
      restoredZipRef.current = restoredZipCode;
      setZipCode(restoredZipCode);
      void searchZipCode(restoredZipCode);
    }
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

  return (
    <main className="min-h-screen bg-[#070b1d] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-white/10 pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
                Local public health dashboard
              </p>
              <h1 className="mt-3 text-4xl font-bold text-white sm:text-5xl">
                YourLocalHealth
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Enter a ZIP code to view local respiratory and environmental
                health signals from public data sources.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/account"
                className="w-fit rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
              >
                {user ? "Account" : "Sign in"}
              </Link>
              {!user && (
                <Link
                  href="/signup"
                  className="w-fit rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Sign up
                </Link>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
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
              className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-4 text-base text-white shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/20"
            />

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-lg bg-indigo-500 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {loading ? "Searching" : "Search"}
            </button>
          </form>
        </header>

        {error && (
          <div className="mt-6 rounded-lg border border-fuchsia-300/30 bg-fuchsia-500/10 p-4 text-sm font-medium text-fuchsia-100">
            {error}
          </div>
        )}

        {!searched && !error && (
          <section className="grid flex-1 place-items-center py-16">
            <div className="max-w-xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
                Ready when you are
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Search any US ZIP code to generate a local health snapshot.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
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

            <TodayHealthBrief
              healthRisk={healthRisk}
              headline={healthBrief.headline}
              drivers={healthBrief.drivers}
              focusItems={healthBrief.focusItems}
              profileNote={healthBrief.profileNote}
            />

            <section className="rounded-lg border border-white/10 bg-[#101934]/90 p-6 shadow-xl shadow-black/25">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Overall Health Risk
                  </p>
                  <p className="mt-3 text-5xl font-bold text-white">
                    {healthRisk}
                  </p>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    This score combines air quality, pollutant levels, heat,
                    UV, official weather alerts, CDC respiratory illness
                    activity, CDC COVID wastewater activity, and your saved
                    profile factors when available.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-cyan-100">
                    {personalizationSummary}
                  </p>
                  {personalizedRisk.isPersonalized && (
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Base environmental risk: {baseHealthRisk}. Personalized
                      risk is informational only.
                    </p>
                  )}
                </div>
                <Link
                  href={detailHref("respiratory-risk")}
                  className="group rounded-lg border border-white/10 bg-white/5 p-5 outline-none transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-950/30 focus:ring-4 focus:ring-cyan-400/20"
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Respiratory Risk
                  </p>
                  <div className="mt-3">
                    <RiskBadge value={respiratoryRisk} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Based on flu activity, COVID wastewater activity, and air
                    quality conditions that may affect breathing, adjusted by
                    your profile when available.
                  </p>
                  <p className="mt-4 text-xs font-semibold text-cyan-200">
                    View details
                  </p>
                </Link>
              </div>
            </section>

            {hasMapLocation && (
              <section className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#101934]/90 shadow-xl shadow-black/25">
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
                title="Data Coverage"
                value={covidData?.coverage ?? "Unknown"}
                detail="Coverage describes how representative the wastewater data is for the state or territory."
                source="Source: CDC National Wastewater Surveillance System"
                href={detailHref("data-coverage")}
              />
            </section>

            <section className="mt-5 rounded-lg border border-white/10 bg-[#101934]/90 p-5 shadow-xl shadow-black/25">
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
                <p className="mt-5 rounded-lg border border-violet-300/30 bg-violet-500/10 p-4 text-sm text-violet-100">
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
                      className="rounded-lg border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
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

            <HealthChatPanel context={chatContext} />
          </section>
        )}
      </section>
    </main>
  );
}
