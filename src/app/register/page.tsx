"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  Lock,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password.trim()) {
      setErrorMessage("Bitte fülle alle Pflichtfelder aus.");
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage("Der Username muss mindestens 3 Zeichen lang sein.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Registrierung fehlgeschlagen.");
        return;
      }

      setSuccessMessage("Registrierung erfolgreich. Anmeldung läuft...");

      const loginResult = await signIn("credentials", {
        identifier: cleanEmail,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Fehler bei der Registrierung:", error);
      setErrorMessage("Ein unerwarteter Fehler ist aufgetreten.");
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
                ArcadiaX Join
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Erstelle dein ArcadiaX Konto.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                  Registriere dich im gleichen Stil wie die Website und erhalte
                  Zugriff auf Releases, Kommentare, Profilfunktionen und spätere
                  Community-Features.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                  <Users className="h-5 w-5 text-blue-300" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Community
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/45">
                    Kommentiere Releases und werde Teil der Plattform.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                  <Lock className="h-5 w-5 text-blue-300" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Sicher
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/45">
                    Klare Registrierung mit sauberem Benutzer-Flow.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                  <Shield className="h-5 w-5 text-blue-300" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Zukunftsfähig
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/45">
                    Grundlage für Likes, Profile und weitere Features.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
              <div className="text-sm font-medium text-white/55">
                Bereits registriert?
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Melde dich mit deinem bestehenden Konto an.
              </div>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Wenn du schon ein Konto hast, kommst du direkt zurück zur
                Login-Seite.
              </p>
              <div className="mt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                >
                  <span>Zum Login</span>
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
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Zum Login →
              </Link>
            </div>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2 text-sm font-medium text-white/70">
                <UserPlus className="h-4 w-4 text-blue-300" />
                Register
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Neues Konto anlegen
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Erstelle dein Benutzerkonto für ArcadiaX.
              </p>
            </div>

            {errorMessage ? (
              <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Username *
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="z. B. anass"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                />
                <p className="mt-2 text-xs text-white/40">
                  Eindeutiger Benutzername für dein Profil.
                </p>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  E-Mail *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Passwort *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                />
                <p className="mt-2 text-xs text-white/40">
                  Verwende mindestens 8 Zeichen.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3.5 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4 text-blue-300" />
                <span>
                  {isSubmitting ? "Registrierung läuft..." : "Konto erstellen"}
                </span>
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4 text-sm text-white/60">
              Bereits registriert?{" "}
              <Link
                href="/login"
                className="font-semibold text-white transition hover:text-blue-300"
              >
                Jetzt einloggen
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}