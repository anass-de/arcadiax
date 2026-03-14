"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Pencil,
  Save,
  Shield,
  User as UserIcon,
} from "lucide-react";

type ProfileResponse = {
  username: string;
  email: string;
};

type ApiError = {
  error?: string;
};

export default function EditProfilePage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await res.json()) as ProfileResponse | ApiError;

        if (!res.ok) {
          throw new Error(
            "error" in data
              ? data.error || "Profil konnte nicht geladen werden."
              : "Profil konnte nicht geladen werden."
          );
        }

        if (!active) return;

        setUsername("username" in data ? data.username : "");
        setEmail("email" in data ? data.email : "");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unbekannter Fehler.";

        if (active) {
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername) {
      setError("Username ist erforderlich.");
      return;
    }

    if (trimmedUsername.length < 3) {
      setError("Username muss mindestens 3 Zeichen lang sein.");
      return;
    }

    if (!trimmedEmail) {
      setError("E-Mail ist erforderlich.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      setError("Bitte gib eine gültige E-Mail ein.");
      return;
    }

    if (password || passwordRepeat) {
      if (password.length < 6) {
        setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
        return;
      }

      if (password !== passwordRepeat) {
        setError("Die Passwörter stimmen nicht überein.");
        return;
      }
    }

    try {
      setSaving(true);

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          email: trimmedEmail,
          password: password || undefined,
        }),
      });

      const data = (await res.json()) as ApiError;

      if (!res.ok) {
        throw new Error(data.error || "Profil konnte nicht gespeichert werden.");
      }

      setSuccess("Profil erfolgreich gespeichert.");
      setPassword("");
      setPasswordRepeat("");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-6 py-8 shadow-xl shadow-black/15 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Profileinstellungen
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Profil bearbeiten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Hier kannst du Username, E-Mail-Adresse und Passwort deines
                ArcadiaX Accounts aktualisieren.
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Profil
          </Link>
        </div>
      </section>

      {loading ? (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
            Profil wird geladen...
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                    <UserIcon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Benutzername
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      Username ändern
                    </h2>
                  </div>
                </div>

                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-black"
                  placeholder="Dein Username"
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                    <Mail className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Kontakt
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      E-Mail ändern
                    </h2>
                  </div>
                </div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-black"
                  placeholder="deine@email.de"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                  <KeyRound className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Sicherheit
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Passwort ändern
                  </h2>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Neues Passwort
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-black"
                    placeholder="Neues Passwort"
                  />
                </div>

                <div>
                  <label
                    htmlFor="passwordRepeat"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Passwort wiederholen
                  </label>
                  <input
                    id="passwordRepeat"
                    type="password"
                    value={passwordRepeat}
                    onChange={(e) => setPasswordRepeat(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-black"
                    placeholder="Passwort erneut eingeben"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                Abbrechen
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                {saving ? "Speichert..." : "Profil speichern"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}