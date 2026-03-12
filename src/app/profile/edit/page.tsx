"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
            "error" in data ? data.error || "Profil konnte nicht geladen werden." : "Profil konnte nicht geladen werden."
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

    loadProfile();

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
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">
              Profil bearbeiten
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Hier kannst du Username, E-Mail und Passwort ändern.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
              Profil wird geladen...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm text-white/70">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                  placeholder="Dein Username"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm text-white/70">
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                  placeholder="deine@email.de"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-white/70">
                  Neues Passwort
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                  placeholder="Neues Passwort"
                />
              </div>

              <div>
                <label htmlFor="passwordRepeat" className="mb-2 block text-sm text-white/70">
                  Passwort wiederholen
                </label>
                <input
                  id="passwordRepeat"
                  type="password"
                  value={passwordRepeat}
                  onChange={(e) => setPasswordRepeat(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                  placeholder="Passwort erneut eingeben"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {success}
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-[180px] items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Speichern..." : "Profil speichern"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}