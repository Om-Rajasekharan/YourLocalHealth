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

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setMessage("Sign-up is not available yet. Please try again later.");
      return;
    }

    setMessage("");
    setLoading(true);

    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });

    if (result.error) {
      setMessage(result.error.message);
      setLoading(false);
    }
    // On success the browser navigates to Google, so there's nothing else to
    // do here -- /account already listens for the resulting auth session.
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title="Your local health forecast, personalized."
      subtitle="A free account lets your Exposure Twin learn from your profile and daily check-ins instead of showing the generic ZIP-level estimate."
      points={[
        "Personal Exposure Twin score, not just your ZIP's",
        "Daily check-in streaks that sharpen your estimate over time",
        "Save places and revisit your forecast anytime",
      ]}
      wide
    >
      <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
        <Link href="/" className="text-sm font-semibold text-[var(--primary-ink)]">
          ← Home
        </Link>
        <Link href="/account" className="text-sm font-semibold text-[var(--primary)]">
          Sign in instead
        </Link>
      </div>

      <p className="font-stat text-xs uppercase tracking-[0.2em] text-[var(--primary)]">
        Create account
      </p>
      <h1 className="mt-2 font-editorial text-3xl font-semibold text-[var(--foreground)]">
        Set up your health profile
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
        Create your login, then add a few profile factors to personalize
        your informational ZIP-code snapshot.
      </p>

      <div className="mt-6">
        <GoogleSignInButton onClick={handleGoogleSignIn} disabled={loading} />
        <AuthDivider />
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6">
        <section>
          <h2 className="font-stat text-xs uppercase tracking-[0.14em] text-[var(--foreground-faint)]">
            Account details
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="auth-shell-label">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="auth-shell-input"
              />
            </label>
            <label className="auth-shell-label">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-shell-input"
              />
            </label>
          </div>
          {!isSupabaseConfigured && (
            <p className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Sign-up is not available yet. Please try again later.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-stat text-xs uppercase tracking-[0.14em] text-[var(--foreground-faint)]">
            Health profile
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
            Used to adjust risk estimates. Not a diagnosis or medical record.
          </p>

          <div className="mt-3 grid gap-3">
            <label className="auth-shell-label">
              Name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="auth-shell-input"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="auth-shell-label">
                Age range
                <select
                  value={ageRange}
                  onChange={(event) =>
                    setAgeRange(event.target.value as AgeRange)
                  }
                  className="auth-shell-input"
                >
                  {ageRanges.map((range) => (
                    <option key={range}>{range}</option>
                  ))}
                </select>
              </label>

              <label className="auth-shell-label">
                Car type
                <select
                  value={carType}
                  onChange={(event) => setCarType(event.target.value)}
                  className="auth-shell-input"
                >
                  {carTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="auth-shell-label">
                Time outside
                <select
                  value={outdoorExposure}
                  onChange={(event) =>
                    setOutdoorExposure(event.target.value as ExposureLevel)
                  }
                  className="auth-shell-input"
                >
                  {exposureLevels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>

              <label className="auth-shell-label">
                Activity level
                <select
                  value={activityLevel}
                  onChange={(event) =>
                    setActivityLevel(event.target.value as ActivityLevel)
                  }
                  className="auth-shell-input"
                >
                  {activityLevels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="auth-shell-label">
                Traffic exposure
                <select
                  value={commuteExposure}
                  onChange={(event) =>
                    setCommuteExposure(event.target.value as ExposureLevel)
                  }
                  className="auth-shell-input"
                >
                  {exposureLevels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>

              <label className="auth-shell-label">
                Breathing sensitivity
                <select
                  value={respiratorySensitivity}
                  onChange={(event) =>
                    setRespiratorySensitivity(
                      event.target.value as RespiratorySensitivity
                    )
                  }
                  className="auth-shell-input"
                >
                  {respiratorySensitivityLevels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="auth-shell-label">
              Place of birth
              <input
                type="text"
                value={placeOfBirth}
                onChange={(event) => setPlaceOfBirth(event.target.value)}
                placeholder="Optional"
                className="auth-shell-input"
              />
            </label>
          </div>
        </section>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="auth-shell-primary-button"
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
    </AuthShell>
  );
}
