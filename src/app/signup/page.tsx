"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveUserProfile,
  type ActivityLevel,
  type AgeRange,
  type ExposureLevel,
  type RespiratorySensitivity,
} from "../../services/userProfile";
import {
  isSupabaseConfigured,
  supabase,
} from "../../lib/supabaseClient";

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

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [ageRange, setAgeRange] = useState<AgeRange>("18-34");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [carType, setCarType] = useState("Other");
  const [outdoorExposure, setOutdoorExposure] =
    useState<ExposureLevel>("Moderate");
  const [activityLevel, setActivityLevel] =
    useState<ActivityLevel>("Moderate");
  const [commuteExposure, setCommuteExposure] =
    useState<ExposureLevel>("Moderate");
  const [respiratorySensitivity, setRespiratorySensitivity] =
    useState<RespiratorySensitivity>("None");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Enter an email and password to create your account.");
      return;
    }

    if (!supabase) {
      setMessage("Sign-up is not available yet. Please try again later.");
      return;
    }

    setLoading(true);

    const signUpResult = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpResult.error) {
      setMessage(signUpResult.error.message);
      setLoading(false);
      return;
    }

    const user = signUpResult.data.session?.user ?? null;

    if (!user) {
      setMessage(
        "Account created. If email confirmation is turned on, check your inbox, then come back here to sign in."
      );
      setLoading(false);
      return;
    }

    try {
      await saveUserProfile({
        userId: user.id,
        fullName: fullName.trim(),
        ageRange,
        placeOfBirth,
        carType,
        outdoorExposure,
        activityLevel,
        commuteExposure,
        respiratorySensitivity,
      });
      router.push("/account");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Account created, but the profile could not be saved.");
      }
    } finally {
      setLoading(false);
    }
  };

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
                Dashboard
              </Link>
              <Link
                href="/account"
                className="w-fit rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-ink)]"
              >
                Sign in
              </Link>
            </div>
          </div>
          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Create Account
            </p>
            <h1 className="display-heading mt-3 text-4xl leading-tight text-[var(--foreground)] sm:text-5xl">
              Set up your health profile
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
              Create your login and add the few profile factors used to
              personalize your informational ZIP-code snapshot.
            </p>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="auth-card mt-8"
        >
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                Login
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Account details
              </h2>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)]"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                  Password
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              {!isSupabaseConfigured && (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Sign-up is not available yet. Please try again later.
                </p>
              )}
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                Health Profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                Personal details
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                These factors help adjust risk estimates. They are not a
                diagnosis or medical record.
              </p>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                  Name
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
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
              </div>
            </section>
          </div>

          <div className="mt-6 border-t border-[var(--rule)] pt-5">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-ink)] disabled:bg-slate-200 disabled:text-slate-500"
            >
              {loading ? "Creating account" : "Create account"}
            </button>
            {message && (
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                {message}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
