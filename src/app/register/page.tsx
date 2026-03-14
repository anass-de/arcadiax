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

const BRAND = "#6c5ce7";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanPasswordRepeat = passwordRepeat.trim();

    if (
      !cleanUsername ||
      !cleanEmail ||
      !cleanPassword ||
      !cleanPasswordRepeat
    ) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage("Username must be at least 3 characters long.");
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      setErrorMessage(
        "Username must be 3 to 20 characters and only use letters, numbers, _ or -."
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (cleanPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (cleanPassword !== cleanPasswordRepeat) {
      setErrorMessage("Passwords do not match.");
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
          password: cleanPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(data?.error || "Registration failed.");
        return;
      }

      setSuccessMessage("Registration successful. Signing you in...");

      const loginResult = await signIn("credentials", {
        identifier: cleanEmail,
        password: cleanPassword,
        redirect: false,
      });

      if (loginResult?.error) {
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Registration error:", error);
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-8 shadow-xl shadow-black/15 sm:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -left-12 top-0 h-52 w-52 rounded-full blur-3xl"
              style={{ backgroundColor: "rgba(108, 92, 231, 0.16)" }}
            />
            <div className="absolute right-0 top-10 h-56 w-56 rounded-full bg-white/[0.03] blur-3xl" />
            <div
              className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full blur-3xl"
              style={{ backgroundColor: "rgba(108, 92, 231, 0.08)" }}
            />
          </div>

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]"
                style={{
                  borderColor: "rgba(108, 92, 231, 0.25)",
                  backgroundColor: "rgba(108, 92, 231, 0.12)",
                  color: BRAND,
                }}
              >
                <Sparkles className="h-4 w-4" />
                ArcadiaX Join
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Create your ArcadiaX account.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                  Register with username, email, and password to access
                  releases, comments, profile features, and more community
                  features.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <Users className="h-5 w-5" style={{ color: BRAND }} />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Community
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Comment on releases and become part of the platform.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <Lock className="h-5 w-5" style={{ color: BRAND }} />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Secure
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Clean registration with a simple user flow.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <Shield className="h-5 w-5" style={{ color: BRAND }} />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Future Ready
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Built for profiles, discussions, and future features.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-medium text-zinc-500">
                Already registered?
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Sign in with your existing account.
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                If you already have an account, you can go straight back to the
                login page.
              </p>
              <div className="mt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <span>Go to Login</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8 sm:p-10">
          <div className="mx-auto max-w-lg">
            <div className="mb-8 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                ← Home
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                Login →
              </Link>
            </div>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-300">
                <UserPlus className="h-4 w-4" style={{ color: BRAND }} />
                Register
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Create New Account
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Create your ArcadiaX user account.
              </p>
            </div>

            {errorMessage ? (
              <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div
                className="mb-5 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(108, 92, 231, 0.25)",
                  backgroundColor: "rgba(108, 92, 231, 0.12)",
                  color: "#ddd6fe",
                }}
              >
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-zinc-300"
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
                  placeholder="e.g. anass"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(108,92,231,0.45)] focus:bg-zinc-950"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Choose a unique username for your profile.
                </p>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Email *
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
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(108,92,231,0.45)] focus:bg-zinc-950"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(108,92,231,0.45)] focus:bg-zinc-950"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Use at least 8 characters.
                </p>
              </div>

              <div>
                <label
                  htmlFor="passwordRepeat"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Repeat Password *
                </label>
                <input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  autoComplete="new-password"
                  value={passwordRepeat}
                  onChange={(event) => setPasswordRepeat(event.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(108,92,231,0.45)] focus:bg-zinc-950"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </span>
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-zinc-400">
              Already registered?{" "}
              <Link
                href="/login"
                className="font-semibold transition hover:opacity-90"
                style={{ color: BRAND }}
              >
                Sign in now
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}