"use client";

import type { Session } from "next-auth";
import { signIn } from "next-auth/react";
import ReleasesBox from "./ReleasesBox";
import CommentThread from "./CommentThread";

export default function HomeClient({ session }: { session: Session | null }) {
  const loggedIn = !!session?.user;

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <section className="rounded-2xl border p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">ArcadiaX</h1>
            <p className="mt-2 text-sm opacity-80">
              Deine App-Plattform: Versionen downloaden, Kommentare wie YouTube, Profile.
            </p>

            {!loggedIn && (
              <div className="mt-4 text-sm">
                <span className="opacity-80">Für Download & Kommentare bitte einloggen.</span>{" "}
                <button
                  onClick={() => signIn(undefined, { callbackUrl: "/" })}
                  className="underline"
                >
                  Login
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border px-4 py-3 text-sm">
            {loggedIn ? (
              <>
                <div className="font-medium">{session.user?.name ?? "User"}</div>
                <div className="opacity-70">{session.user?.email}</div>
                <a className="mt-2 inline-block underline" href="/profile">
                  Profil öffnen →
                </a>
              </>
            ) : (
              <div className="opacity-70">Nicht eingeloggt</div>
            )}
          </div>
        </div>
      </section>

      <ReleasesBox canDownload={loggedIn} />
      <CommentThread canPost={loggedIn} />
    </main>
  );
}