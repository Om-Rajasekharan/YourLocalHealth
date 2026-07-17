"use client";

import Image from "next/image";
import Link from "next/link";

// Shared chrome for /signup and the signed-out state of /account, so both
// read as one deliberately-designed pair rather than two separately-styled
// forms. Split-screen (brand panel + form) instead of a centered boxed card,
// since the boxed-card-with-uppercase-microlabels look is the generic
// template pattern this was built to move away from.
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  points,
  wide = false,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  points: string[];
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell-page min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <aside className="auth-shell-brand relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <div className="auth-shell-grain absolute inset-0" aria-hidden="true" />
          <Link
            href="/"
            className="relative z-10 flex w-fit items-center gap-3"
          >
            <Image
              src="/mylocalhealth-icon-white.png"
              alt=""
              width={154}
              height={123}
              priority
              className="h-9 w-9 shrink-0"
            />
            <span className="font-heading text-lg font-semibold text-white">
              MyLocalHealth
            </span>
          </Link>

          <div className="relative z-10">
            <p className="font-stat text-xs uppercase tracking-[0.3em] text-white/60">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-md font-editorial text-4xl font-semibold leading-[1.05] text-white">
              {title}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              {subtitle}
            </p>
            <ul className="mt-8 grid gap-3">
              {points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2.5 text-sm leading-6 text-white/85"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 text-xs leading-5 text-white/45">
            Informational only. Not a medical diagnosis or treatment.
          </p>
        </aside>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.87 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  onClick,
  disabled,
  label = "Continue with Google",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="auth-shell-google flex h-11 w-full items-center justify-center gap-2.5 border border-[var(--border)] bg-white text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
    >
      <GoogleGlyph />
      {label}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--foreground-faint)]">
      <span className="h-px flex-1 bg-[var(--border)]" />
      or
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
