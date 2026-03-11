// src/app/login/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  LogIn,
  Mail,
  Lock,
  ArrowLeft,
  Loader2,
  Chrome,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const callbackUrl = useMemo(() => {
    return searchParams.get("callbackUrl") || "/";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const role = ((session?.user as any)?.role ?? "USER").toString().toUpperCase();

    if (role === "ADMIN") {
      router.replace("/dashboard");
      return;
    }

    router.replace("/");
  }, [status, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!res) {
        setError("Login fehlgeschlagen.");
        return;
      }

      if (res.error) {
        setError("Email oder Passwort ist falsch.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unerwarteter Fehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loginWithGoogle() {
    setError(null);
    setSubmitting(true);

    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Google Login fehlgeschlagen.");
      setSubmitting(false);
    }
  }

  const disabled =
    submitting ||
    status === "loading" ||
    email.trim().length === 0 ||
    password.length === 0;

  return (
    <main className="min-h-[calc(100vh-0px)] w-full bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>

            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
              <LogIn className="h-4 w-4" />
              Login
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1 text-sm text-white/60">
            Melde dich an, um Downloads und Kommentare zu nutzen.
          </p>

          {status === "loading" && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Session wird geladen…
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-white/60">Email</label>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Mail className="h-4 w-4 text-white/60" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/60">Passwort</label>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Lock className="h-4 w-4 text-white/60" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={disabled}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Bitte warten…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Login
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/40">oder</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={submitting || status === "loading"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Chrome className="h-4 w-4" />
            Login mit Google
          </button>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link
              href={`/register${
                callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""
              }`}
              className="text-white/70 hover:text-white"
            >
              Neu? Account erstellen
            </Link>

            <Link href="/" className="text-white/50 hover:text-white/70">
              Zur Startseite
            </Link>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
            Admin wird nach Login automatisch zum{" "}
            <span className="text-white/70">Dashboard</span> weitergeleitet.
          </div>
        </div>
      </div>
    </main>
  );
}