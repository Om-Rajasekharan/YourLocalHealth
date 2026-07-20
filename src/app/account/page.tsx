"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  deleteSavedLocation,
  getSavedLocations,
  setLocationAlerts,
  type SavedLocation,
} from "../../services/savedLocations";
import {
  getUserProfile,
  saveUserProfile,
  type ActivityLevel,
  type AgeRange,
  type ExposureLevel,
  type RespiratorySensitivity,
  type UserProfile,
} from "../../services/userProfile";
import {
  isSupabaseConfigured,
  supabase,
} from "../../lib/supabaseClient";
import { AuthDivider, AuthShell, GoogleSignInButton } from "../../components/AuthShell";

const ageRanges: AgeRange[] = [
  "Under 18",
  "18-34",
  "35-49",
  "50-64",
  "65+",
];
const exposureLevels: ExposureLevel[] = ["Low", "Moderate", "High"];
const activityLevels: ActivityLevel[] = ["Low", "Moderate", "High"];
const respiratorySensitivityLevels: RespiratorySensitivity[] = [
  "None",
  "Mild",
  "High",
];
const carTypes = [
  "No car",
  "Gas",
  "Hybrid",
  "Electric",
  "Diesel",
  "Other",
];

function AuthPanel({
  onAuthChange,
}: {
  onAuthChange: (user: User | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    setAuthMessage("");

    if (!email.trim()) {
      setAuthMessage("Enter your email above first, then click \"Forgot password?\".");
      return;
    }

    if (!supabase) {
      setAuthMessage("Password reset is not available yet. Please try again later.");
      return;
    }

    setResetLoading(true);

    const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (result.error) {
      setAuthMessage(result.error.message);
    } else {
      setAuthMessage(
        `If an account exists for ${email.trim()}, a password reset link is on its way.`
      );
    }

    setResetLoading(false);
  };

  const handleSignIn = async () => {
    setAuthMessage("");

    if (!email.trim() || !password) {
      setAuthMessage("Enter your email and password to sign in.");
      return;
    }

    if (!supabase) {
      setAuthMessage("Sign in is not available yet. Please try again later.");
      return;
    }

    setAuthLoading(true);

    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (result.error) {
      setAuthMessage(result.error.message);
    } else {
      const sessionUser = result.data.session?.user ?? null;
      onAuthChange(sessionUser);
      setAuthMessage("Signed in.");
    }

    setAuthLoading(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSignIn();
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setAuthMessage("Sign in is not available yet. Please try again later.");
      return;
    }

    setAuthMessage("");
    setAuthLoading(true);

    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });

    if (result.error) {
      setAuthMessage(result.error.message);
      setAuthLoading(false);
    }
    // On success the browser navigates to Google; the onAuthStateChange
    // listener in AccountPage picks up the resulting session on return.
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="font-stat text-xs uppercase tracking-[0.2em] text-[var(--primary)]">
        Sign in
      </p>
      <h1 className="mt-2 font-editorial text-3xl font-semibold text-[var(--foreground)]">
        Welcome back
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
        Sign in to see your personal Exposure Twin, saved places, and
        check-in streak.
      </p>
      {!isSupabaseConfigured && (
        <p className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Sign in is not available yet. Please try again later.
        </p>
      )}

      <div className="mt-6">
        <GoogleSignInButton onClick={handleGoogleSignIn} disabled={authLoading} />
        <AuthDivider />
      </div>

      <div className="grid gap-3">
        <label className="auth-shell-label">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-shell-input"
          />
        </label>
        <label className="auth-shell-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-shell-input"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3">
        <button
          type="submit"
          disabled={authLoading}
          className="auth-shell-primary-button"
        >
          {authLoading ? "Signing in" : "Sign in"}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/signup"
            className="text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-ink)]"
          >
            Create an account
          </Link>
          <button
            type="button"
            onClick={() => void handleForgotPassword()}
            disabled={resetLoading}
            className="text-sm font-semibold text-[var(--foreground-muted)] underline-offset-2 transition hover:text-[var(--foreground)] hover:underline disabled:text-slate-400"
          >
            {resetLoading ? "Sending reset link" : "Forgot password?"}
          </button>
        </div>
      </div>
      {authMessage && (
        <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
          {authMessage}
        </p>
      )}
    </form>
  );
}

function ProfilePanel({
  profile,
  userId,
  message,
  onSaved,
}: {
  profile: UserProfile | null;
  userId: string;
  message: string;
  onSaved: (profile: UserProfile, message: string) => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [ageRange, setAgeRange] = useState<AgeRange>(
    profile?.age_range ?? "18-34"
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(
    profile?.place_of_birth ?? ""
  );
  const [carType, setCarType] = useState(profile?.car_type ?? "Other");
  const [outdoorExposure, setOutdoorExposure] = useState<ExposureLevel>(
    profile?.outdoor_exposure ?? "Moderate"
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activity_level ?? "Moderate"
  );
  const [commuteExposure, setCommuteExposure] = useState<ExposureLevel>(
    profile?.commute_exposure ?? "Moderate"
  );
  const [respiratorySensitivity, setRespiratorySensitivity] =
    useState<RespiratorySensitivity>(
      profile?.respiratory_sensitivity ?? "None"
    );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setAgeRange(profile?.age_range ?? "18-34");
    setPlaceOfBirth(profile?.place_of_birth ?? "");
    setCarType(profile?.car_type ?? "Other");
    setOutdoorExposure(profile?.outdoor_exposure ?? "Moderate");
    setActivityLevel(profile?.activity_level ?? "Moderate");
    setCommuteExposure(profile?.commute_exposure ?? "Moderate");
    setRespiratorySensitivity(
      profile?.respiratory_sensitivity ?? "None"
    );
  }, [profile]);

  const handleProfileSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");

    try {
      const savedProfile = await saveUserProfile({
        userId,
        fullName: fullName.trim(),
        ageRange,
        placeOfBirth,
        carType,
        outdoorExposure,
        activityLevel,
        commuteExposure,
        respiratorySensitivity,
      });
      onSaved(
        savedProfile,
        "Profile saved. Your dashboard risk snapshot is now personalized."
      );
    } catch (error) {
      if (error instanceof Error) {
        setProfileError(error.message);
      } else {
        setProfileError("Unable to save profile.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <section className="auth-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
        Health Profile
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
        Personal details
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
        These factors are used only to adjust your informational risk snapshot.
      </p>

      <form onSubmit={handleProfileSubmit} className="mt-5 grid gap-4">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
          Name
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Optional"
            className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Age range
            <select
              value={ageRange}
              onChange={(event) =>
                setAgeRange(event.target.value as AgeRange)
              }
              className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            >
              {ageRanges.map((range) => (
                <option key={range}>{range}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Car type
            <select
              value={carType}
              onChange={(event) => setCarType(event.target.value)}
              className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            >
              {carTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Time outside
            <select
              value={outdoorExposure}
              onChange={(event) =>
                setOutdoorExposure(event.target.value as ExposureLevel)
              }
              className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            >
              {exposureLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Activity level
            <select
              value={activityLevel}
              onChange={(event) =>
                setActivityLevel(event.target.value as ActivityLevel)
              }
              className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            >
              {activityLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Traffic exposure
            <select
              value={commuteExposure}
              onChange={(event) =>
                setCommuteExposure(event.target.value as ExposureLevel)
              }
              className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            >
              {exposureLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
            Breathing sensitivity
            <select
              value={respiratorySensitivity}
              onChange={(event) =>
                setRespiratorySensitivity(
                  event.target.value as RespiratorySensitivity
                )
              }
              className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            >
              {respiratorySensitivityLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
          Place of birth
          <input
            type="text"
            value={placeOfBirth}
            onChange={(event) => setPlaceOfBirth(event.target.value)}
            placeholder="Optional"
            className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)]"
          />
        </label>

        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-ink)] disabled:bg-slate-200 disabled:text-slate-500"
        >
          {savingProfile ? "Saving profile" : "Save profile"}
        </button>
      </form>

      {(message || profileError) && (
        <p className="mt-3 text-xs leading-5 text-[var(--foreground-muted)]">
          {profileError || message}
        </p>
      )}
    </section>
  );
}

function SavedLocationsPanel({
  locations,
  onDelete,
  onToggleAlerts,
  message,
}: {
  locations: SavedLocation[];
  onDelete: (id: string) => void;
  onToggleAlerts: (id: string, enabled: boolean) => void;
  message: string;
}) {
  return (
    <section className="auth-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
        My Locations
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
        Saved places
      </h2>
      {message && (
        <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
          {message}
        </p>
      )}
      {locations.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
          Saved locations will appear here after you save them from a ZIP code
          result.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {locations.map((location) => (
            <div
              className="inset-surface rounded-lg p-4"
              key={location.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/?zipCode=${location.zip_code}`}
                  className="min-w-0"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {location.label}
                    </span>
                    <span className="rounded-full border border-[var(--secondary)]/30 bg-[var(--secondary)]/10 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      {location.location_type}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[var(--foreground-faint)]">
                    {location.city}, {location.state} · {location.zip_code}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(location.id)}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                >
                  Remove
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--foreground-muted)]">
                <input
                  type="checkbox"
                  checked={location.alerts_enabled}
                  onChange={(event) =>
                    onToggleAlerts(location.id, event.target.checked)
                  }
                />
                Email me if risk reaches High here
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(
    []
  );
  const [savedLocationMessage, setSavedLocationMessage] = useState("");

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

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
      setProfileMessage(
        profile
          ? "Profile loaded."
          : "Create a profile to personalize your dashboard."
      );
    } catch (error) {
      if (error instanceof Error) {
        setProfileMessage(error.message);
      } else {
        setProfileMessage("Unable to load health profile.");
      }
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

  const handleToggleLocationAlerts = async (id: string, enabled: boolean) => {
    if (!user) return;

    try {
      await setLocationAlerts(id, enabled);
      await loadSavedLocations(user.id);
      setSavedLocationMessage(
        enabled ? "Alerts turned on for this location." : "Alerts turned off."
      );
    } catch (error) {
      if (error instanceof Error) {
        setSavedLocationMessage(error.message);
      } else {
        setSavedLocationMessage("Unable to update alerts for this location.");
      }
    }
  };

  const handleAuthChange = (nextUser: User | null) => {
    setUser(nextUser);

    if (nextUser) {
      void loadSavedLocations(nextUser.id);
      void loadUserProfile(nextUser.id);
    } else {
      setSavedLocations([]);
      setUserProfile(null);
      setProfileMessage("");
    }
  };

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        void loadSavedLocations(data.user.id);
        void loadUserProfile(data.user.id);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          void loadSavedLocations(nextUser.id);
          void loadUserProfile(nextUser.id);
        } else {
          setSavedLocations([]);
          setUserProfile(null);
          setProfileMessage("");
        }
      }
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (!user) {
    return (
      <AuthShell
        eyebrow="Welcome back"
        title="Pick up where you left off."
        subtitle="Sign in to see your personal Exposure Twin, saved places, and check-in streak instead of the generic ZIP-level estimate."
        points={[
          "Personal Exposure Twin score, not just your ZIP's",
          "Your saved places and check-in streak",
          "Profile factors that sharpen your estimate over time",
        ]}
      >
        <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
          <Link href="/" className="text-sm font-semibold text-[var(--primary-ink)]">
            ← Home
          </Link>
          <Link href="/signup" className="text-sm font-semibold text-[var(--primary)]">
            Create account
          </Link>
        </div>
        <AuthPanel onAuthChange={handleAuthChange} />
      </AuthShell>
    );
  }

  return (
    <main className="auth-page-shell min-h-screen public-health-bg text-[var(--foreground)]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="auth-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="flex w-fit items-center gap-3 text-[var(--primary-ink)]"
            >
              <Image
                src="/mylocalhealth-icon-white.png"
                alt=""
                width={154}
                height={123}
                priority
                className="h-auto w-10 shrink-0 invert"
              />
              <span className="font-heading text-xl font-semibold">
                MyLocalHealth
              </span>
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="w-fit rounded-full border border-[var(--rule)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-muted)]"
              >
                Home
              </Link>
            </div>
          </div>
          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              MyLocalHealth Account
            </p>
            <h1 className="display-heading mt-3 text-4xl leading-tight text-[var(--foreground)] sm:text-5xl">
              Sign in and personalize your snapshot
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
              Manage your saved locations and the profile factors that adjust
              your informational risk estimate.
            </p>
          </div>
        </header>

        <section className="auth-grid grid gap-5 py-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="auth-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Account
            </p>
            <p className="mt-2 text-sm text-[var(--foreground)]">{user.email}</p>
            <button
              type="button"
              onClick={() => {
                if (!supabase) return;
                void supabase.auth.signOut().then(() => handleAuthChange(null));
              }}
              className="mt-4 rounded-lg border border-[var(--rule)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-muted)]"
            >
              Sign out
            </button>
          </section>
          <ProfilePanel
            profile={userProfile}
            userId={user.id}
            message={profileMessage}
            onSaved={(profile, message) => {
              setUserProfile(profile);
              setProfileMessage(message);
            }}
          />
        </section>

        <SavedLocationsPanel
          locations={savedLocations}
          message={savedLocationMessage}
          onDelete={(id) => void handleDeleteLocation(id)}
          onToggleAlerts={(id, enabled) =>
            void handleToggleLocationAlerts(id, enabled)
          }
        />
      </section>
    </main>
  );
}
