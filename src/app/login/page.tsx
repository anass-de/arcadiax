"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Lock,
  LogIn,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

function getErrorMessage(error?: string | null) {
  switch (error) {
    case "CredentialsSignin":
      return "Login fehlgeschlagen. Bitte überprüfe deine Zugangsdaten.";
    case "AccessDenied":
      return "Zugriff verweigert.";
    default:
      return error ? "Login fehlgeschlagen. Bitte versuche es erneut." : null;
  }
}

export default function LoginPage() {
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorMessage = getErrorMessage(error);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await signIn("credentials", {
        identifier,
        password,
        callbackUrl,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-12 top-0 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute right-0 top-10 h-56 w-56 rounded-full bg-cyan-400/5 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl" />
          </div>

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
                <Sparkles className="h-4 w-4" />
                ArcadiaX Access
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Willkommen zurück bei ArcadiaX.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                  Melde dich mit Benutzername oder E-Mail an und greife auf
                  Releases, Profil, Kommentare und das Admin-Dashboard zu.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                  <Lock className="h-5 w-5 text-blue-300" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Sicherer Zugang
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/45">
                    Login für Benutzer und Admins mit sauberem Flow.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                  <User className="h-5 w-5 text-blue-300" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Persönlicher Bereich
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/45">
                    Profile, Kommentare und Releases zentral an einem Ort.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                  <Shield className="h-5 w-5 text-blue-300" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Admin Dashboard
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/45">
                    Direkter Zugang zu Verwaltung, Moderation und Uploads.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
              <div className="text-sm font-medium text-white/55">
                Noch kein Konto?
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Erstelle jetzt dein ArcadiaX Benutzerkonto.
              </div>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Registriere dich, um Kommentare zu schreiben, Profile zu nutzen
                und später weitere Community-Features freizuschalten.
              </p>
              <div className="mt-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                >
                  <span>Zum Register</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
          <div className="mx-auto max-w-lg">
            <div className="mb-8 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                ← Home
              </Link>

              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Registrieren →
              </Link>
            </div>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2 text-sm font-medium text-white/70">
                <LogIn className="h-4 w-4 text-blue-300" />
                Login
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Anmelden
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Melde dich mit Username oder E-Mail bei ArcadiaX an.
              </p>
            </div>

            {errorMessage ? (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="identifier"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Username oder E-Mail
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  placeholder="deinname oder deine@email.de"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Passwort
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3.5 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn className="h-4 w-4 text-blue-300" />
                <span>{isSubmitting ? "Login läuft..." : "Einloggen"}</span>
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/35">oder</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-[#07090f] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              Mit Google anmelden
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4 text-sm text-white/60">
              Noch kein Konto?{" "}
              <Link
                href="/register"
                className="font-semibold text-white transition hover:text-blue-300"
              >
                Jetzt registrieren
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}