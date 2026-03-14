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

const BRAND = "#6c5ce7";

function getErrorMessage(error?: string | null) {
  switch (error) {
    case "CredentialsSignin":
      return "Login failed. Please check your credentials.";
    case "AccessDenied":
      return "Access denied.";
    default:
      return error ? "Login failed. Please try again." : null;
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
        identifier: identifier.trim(),
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
                ArcadiaX Access
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Welcome back to ArcadiaX.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                  Sign in with your username or email to access releases,
                  profile, comments, and the admin dashboard.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <Lock className="h-5 w-5" style={{ color: BRAND }} />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Secure Access
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Clean login flow for users and admins.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <User className="h-5 w-5" style={{ color: BRAND }} />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Personal Area
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Profiles, comments, and releases in one place.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <Shield className="h-5 w-5" style={{ color: BRAND }} />
                  <div className="mt-3 text-sm font-semibold text-white">
                    Admin Dashboard
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Direct access to management, moderation, and uploads.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-medium text-zinc-500">
                No account yet?
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Create your ArcadiaX account now.
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Register to post comments, use your profile, and unlock more
                community features.
              </p>
              <div className="mt-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <span>Go to Register</span>
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
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                Register →
              </Link>
            </div>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-300">
                <LogIn className="h-4 w-4" style={{ color: BRAND }} />
                Login
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Sign In
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Log in with your username or email.
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
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Username or Email
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  placeholder="yourname or your@email.com"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(108,92,231,0.35)] focus:bg-zinc-950"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Password
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
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(108,92,231,0.35)] focus:bg-zinc-950"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                <LogIn className="h-4 w-4" />
                <span>{isSubmitting ? "Signing in..." : "Sign In"}</span>
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-zinc-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold transition hover:opacity-90"
                style={{ color: BRAND }}
              >
                Register now
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}