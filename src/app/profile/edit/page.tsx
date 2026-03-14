"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  KeyRound,
  Mail,
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

const BRAND = "#6c5ce7";

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
              ? data.error || "Failed to load profile."
              : "Failed to load profile."
          );
        }

        if (!active) return;

        setUsername("username" in data ? data.username : "");
        setEmail("email" in data ? data.email : "");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error.";

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
      setError("Username is required.");
      return;
    }

    if (trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }

    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password || passwordRepeat) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }

      if (password !== passwordRepeat) {
        setError("Passwords do not match.");
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
        throw new Error(data.error || "Failed to save profile.");
      }

      setSuccess("Profile saved successfully.");
      setPassword("");
      setPasswordRepeat("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: CSSProperties = {
    borderColor: "rgba(255,255,255,0.10)",
  };

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-6 py-8 shadow-xl shadow-black/15 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -left-16 top-0 h-56 w-56 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(108, 92, 231, 0.16)" }}
          />
          <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div
            className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(108, 92, 231, 0.08)" }}
          />
        </div>

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-4">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]"
              style={{
                borderColor: "rgba(108, 92, 231, 0.25)",
                backgroundColor: "rgba(108, 92, 231, 0.12)",
                color: BRAND,
              }}
            >
              <Shield className="h-4 w-4" />
              Profile Settings
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Edit Profile
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Update your username, email address, and password for your
                ArcadiaX account.
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </div>
      </section>

      {loading ? (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
            Loading profile...
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                    <UserIcon className="h-5 w-5" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Username
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      Change Username
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
                  className="w-full rounded-2xl border bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black focus:border-[rgba(108,92,231,0.35)]"
                  style={inputStyle}
                  placeholder="Your username"
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                    <Mail className="h-5 w-5" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Contact
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      Change Email
                    </h2>
                  </div>
                </div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black focus:border-[rgba(108,92,231,0.35)]"
                  style={inputStyle}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                  <KeyRound className="h-5 w-5" style={{ color: BRAND }} />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Security
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Change Password
                  </h2>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black focus:border-[rgba(108,92,231,0.35)]"
                    style={inputStyle}
                    placeholder="New password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="passwordRepeat"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Repeat Password
                  </label>
                  <input
                    id="passwordRepeat"
                    type="password"
                    value={passwordRepeat}
                    onChange={(e) => setPasswordRepeat(e.target.value)}
                    className="w-full rounded-2xl border bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:bg-black focus:border-[rgba(108,92,231,0.35)]"
                    style={inputStyle}
                    placeholder="Repeat password"
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
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(108, 92, 231, 0.25)",
                  backgroundColor: "rgba(108, 92, 231, 0.12)",
                  color: "#ddd6fe",
                }}
              >
                {success}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: BRAND }}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}