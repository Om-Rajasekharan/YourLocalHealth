"use client";

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

    if (!supabase) {
      setMessage("Supabase is not configured yet.");
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
        "Account created. Check your email to confirm it, then sign in to finish your profile."
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
    <main className="min-h-screen bg-[#070b1d] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              Create Account
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">
              Personalize YourLocalHealth
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Create your login and add the profile factors used to personalize
              your informational health snapshot.
            </p>
          </div>
          <Link
            href="/account"
            className="w-fit rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
          >
            Already have an account?
          </Link>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5"
        >
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Login
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Account details
              </h2>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Password
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  />
                </label>
              </div>
              {!isSupabaseConfigured && (
                <p className="mt-4 rounded-lg border border-violet-300/30 bg-violet-500/10 p-3 text-xs leading-5 text-violet-100">
                  Supabase is not configured yet.
                </p>
              )}
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Health Profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Personal details
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                These factors help adjust risk estimates. They are not a
                diagnosis or medical record.
              </p>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Name
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Age range
                    <select
                      value={ageRange}
                      onChange={(event) =>
                        setAgeRange(event.target.value as AgeRange)
                      }
                      className="h-11 rounded-lg border border-white/15 bg-[#111a33] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    >
                      {ageRanges.map((range) => (
                        <option key={range}>{range}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Car type
                    <select
                      value={carType}
                      onChange={(event) => setCarType(event.target.value)}
                      className="h-11 rounded-lg border border-white/15 bg-[#111a33] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    >
                      {carTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Time outside
                    <select
                      value={outdoorExposure}
                      onChange={(event) =>
                        setOutdoorExposure(event.target.value as ExposureLevel)
                      }
                      className="h-11 rounded-lg border border-white/15 bg-[#111a33] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    >
                      {exposureLevels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Activity level
                    <select
                      value={activityLevel}
                      onChange={(event) =>
                        setActivityLevel(event.target.value as ActivityLevel)
                      }
                      className="h-11 rounded-lg border border-white/15 bg-[#111a33] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    >
                      {activityLevels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Traffic exposure
                    <select
                      value={commuteExposure}
                      onChange={(event) =>
                        setCommuteExposure(event.target.value as ExposureLevel)
                      }
                      className="h-11 rounded-lg border border-white/15 bg-[#111a33] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    >
                      {exposureLevels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Breathing sensitivity
                    <select
                      value={respiratorySensitivity}
                      onChange={(event) =>
                        setRespiratorySensitivity(
                          event.target.value as RespiratorySensitivity
                        )
                      }
                      className="h-11 rounded-lg border border-white/15 bg-[#111a33] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300"
                    >
                      {respiratorySensitivityLevels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Place of birth
                  <input
                    type="text"
                    value={placeOfBirth}
                    onChange={(event) => setPlaceOfBirth(event.target.value)}
                    placeholder="Optional"
                    className="h-11 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-300"
            >
              {loading ? "Creating account" : "Create account"}
            </button>
            {message && (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {message}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
