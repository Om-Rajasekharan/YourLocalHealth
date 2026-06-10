"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
import {
  getLocalHealthNews,
  type LocalHealthNewsArticle,
} from "../services/localNews";
import {
  deleteSavedLocation,
  getSavedLocations,
  saveLocation,
  type SavedLocation,
} from "../services/savedLocations";
import {
  isSupabaseConfigured,
  supabase,
} from "../lib/supabaseClient";

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

function AuthPanel({
  user,
  onAuthChange,
}: {
  user: User | null;
  onAuthChange: (user: User | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (mode: "sign-in" | "sign-up") => {
    setAuthMessage("");

    if (!supabase) {
      setAuthMessage("Add Supabase environment variables to enable sign in.");
      return;
    }

    setAuthLoading(true);

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setAuthMessage(result.error.message);
    } else {
      onAuthChange(result.data.user);
      setAuthMessage(
        mode === "sign-up"
          ? "Account created. Check your email if confirmation is enabled."
          : "Signed in."
      );
    }

    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onAuthChange(null);
    setAuthMessage("Signed out.");
  };

  if (user) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Account
        </p>
        <p className="mt-2 text-sm text-slate-200">{user.email}</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
        >
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        Personalize
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-300">
        Sign in to start saving locations.
      </p>
      {!isSupabaseConfigured && (
        <p className="mt-3 rounded-lg border border-violet-300/30 bg-violet-500/10 p-3 text-xs leading-5 text-violet-100">
          Supabase is not configured yet.
        </p>
      )}
      <div className="mt-3 grid gap-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10 rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={authLoading}
          onClick={() => void handleAuth("sign-in")}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:bg-slate-700"
        >
          Sign in
        </button>
        <button
          type="button"
          disabled={authLoading}
          onClick={() => void handleAuth("sign-up")}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10 disabled:text-slate-400"
        >
          Sign up
        </button>
      </div>
      {authMessage && (
        <p className="mt-3 text-xs leading-5 text-slate-300">
          {authMessage}
        </p>
      )}
    </section>
  );
}

function SavedLocationsPanel({
  locations,
  onSelect,
  onDelete,
  message,
}: {
  locations: SavedLocation[];
  onSelect: (zipCode: string) => void;
  onDelete: (id: string) => void;
  message: string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        My Locations
      </p>
      {message && (
        <p className="mt-2 text-xs leading-5 text-slate-300">
          {message}
        </p>
      )}
      {locations.length === 0 ? (
        <p className="mt-2 text-sm leading-5 text-slate-300">
          Search a ZIP code, then save it here for quick access.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {locations.map((location) => (
            <div
              className="rounded-lg border border-white/10 bg-white/5 p-3"
              key={location.id}
            >
              <button
                type="button"
                onClick={() => onSelect(location.zip_code)}
                className="block w-full text-left"
              >
                <span className="block text-sm font-semibold text-white">
                  {location.label}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {location.city}, {location.state} · {location.zip_code}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(location.id)}
                className="mt-2 text-xs font-semibold text-fuchsia-200 hover:text-white"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
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
  const [localNews, setLocalNews] = useState<LocalHealthNewsArticle[]>(
    []
  );
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(
    []
  );
  const [savedLocationMessage, setSavedLocationMessage] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

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

      const airData = await getAirQuality(
        location.latitude,
        location.longitude
      );

      setAqi(airData.list?.[0]?.main.aqi ?? null);
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

  const loadSavedLocations = async (userId: string) => {
    try {
      const locations = await getSavedLocations(userId);
      setSavedLocations(locations);
      setSavedLocationMessage("");
    } catch (error) {
      if (error instanceof Error) {
        setSavedLocationMessage(error.message);
      } else {
        setSavedLocationMessage("Unable to load saved locations.");
      }
    }
  };

  const handleSaveLocation = async () => {
    if (!user || !searched) return;

    const defaultLabel =
      savedLocations.length === 0 ? "Home" : `${city}, ${state}`;
    const label =
      window.prompt("Name this location", defaultLabel) ?? "";

    if (!label.trim()) return;

    setSavingLocation(true);
    setSavedLocationMessage("");

    try {
      await saveLocation({
        userId: user.id,
        label: label.trim(),
        zipCode,
        city,
        state,
        latitude,
        longitude,
      });
      await loadSavedLocations(user.id);
      setSavedLocationMessage("Location saved.");
    } catch (error) {
      if (error instanceof Error) {
        setSavedLocationMessage(error.message);
      } else {
        setSavedLocationMessage("Unable to save this location.");
      }
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!user) return;

    try {
      await deleteSavedLocation(id);
      await loadSavedLocations(user.id);
      setSavedLocationMessage("Location removed.");
    } catch (error) {
      if (error instanceof Error) {
        setSavedLocationMessage(error.message);
      } else {
        setSavedLocationMessage("Unable to remove this location.");
      }
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
        void loadSavedLocations(data.user.id);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          void loadSavedLocations(nextUser.id);
        } else {
          setSavedLocations([]);
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
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
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

          <div className="grid w-full gap-4 sm:max-w-md">
            <AuthPanel user={user} onAuthChange={setUser} />
            {user && (
              <SavedLocationsPanel
                locations={savedLocations}
                message={savedLocationMessage}
                onSelect={(savedZipCode) =>
                  void searchZipCode(savedZipCode)
                }
                onDelete={(id) => void handleDeleteLocation(id)}
              />
            )}
            <form
              onSubmit={handleSearch}
              className="flex w-full flex-col gap-3 sm:flex-row"
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
          </div>
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

            {user && (
              <div className="mb-5 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-300">
                    Save {city}, {state} to your account for quick access.
                  </p>
                  <button
                    type="button"
                    disabled={savingLocation}
                    onClick={() => void handleSaveLocation()}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:bg-slate-700"
                  >
                    {savingLocation ? "Saving" : "Save this location"}
                  </button>
                </div>
              </div>
            )}

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
                    This score combines air quality, CDC respiratory illness
                    activity, and CDC COVID wastewater activity for a simple
                    local risk snapshot.
                  </p>
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
                    quality conditions that may affect breathing.
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
                detail={`AQI category ${aqi ?? "unavailable"} from current air pollution data.`}
                source="Source: OpenWeather Air Pollution API"
                href={detailHref("air-quality")}
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
          </section>
        )}
      </section>
    </main>
  );
}
