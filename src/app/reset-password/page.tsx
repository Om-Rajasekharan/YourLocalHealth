"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!password || password.length < 6) {
      setMessage("Choose a password with at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!supabase) {
      setMessage("Password reset is not available yet. Please try again later.");
      return;
    }

    setLoading(true);

    const result = await supabase.auth.updateUser({ password });

    if (result.error) {
      setMessage(result.error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setMessage("Password updated. Taking you to your account...");
    setLoading(false);
    setTimeout(() => router.push("/account"), 1500);
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
                Home
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
              Reset Password
            </p>
            <h1 className="display-heading mt-3 text-4xl leading-tight text-[var(--foreground)] sm:text-5xl">
              Choose a new password
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">
              Set a new password for your MyLocalHealth account.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="auth-card mt-8 max-w-md">
          {!isSupabaseConfigured && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Password reset is not available yet. Please try again later.
            </p>
          )}
          {isSupabaseConfigured && !ready && !done && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              This page only works from the link in your password reset email.
              If you opened it directly, request a new link from the sign-in
              page first.
            </p>
          )}

          <div className="grid gap-4">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
              New password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                disabled={!ready || done}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] disabled:opacity-60"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
              Confirm password
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                disabled={!ready || done}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-11 rounded-lg border border-[var(--rule)] bg-[var(--surface-muted)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-6 border-t border-[var(--rule)] pt-5">
            <button
              type="submit"
              disabled={!ready || loading || done}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-ink)] disabled:bg-slate-200 disabled:text-slate-500"
            >
              {loading ? "Updating password" : "Update password"}
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
