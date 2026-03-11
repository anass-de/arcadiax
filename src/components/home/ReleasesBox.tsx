// src/components/home/ReleasesBox.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

type Release = {
  id: string;
  title: string;
  version: string;
  description?: string | null;
  createdAt?: string;
};

type Props = {
  canDownload: boolean;
};

export default function ReleasesBox({ canDownload }: Props) {
  const [items, setItems] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/releases", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // akzeptiere Array ODER { items: [] }
      const list: Release[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setItems(list);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Laden der Releases.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white/90">ArcadiaX Downloads</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            onClick={load}
          >
            Refresh
          </button>

          <Link
            href="/releases"
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
          >
            Alle Releases
          </Link>
        </div>
      </div>

      {!canDownload && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
          Download ist nur nach Login möglich.
          <button
            type="button"
            className="ml-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            onClick={() => signIn()}
          >
            Login
          </button>
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <div className="mt-3 text-sm text-white/60">Lade…</div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
          Noch keine Releases.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">
                    {r.title} <span className="text-white/60">v{r.version}</span>
                  </div>
                  {r.description && (
                    <div className="mt-1 text-sm text-white/70">{r.description}</div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/releases/${r.id}`}
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                  >
                    Details
                  </Link>

                  <a
                    href={canDownload ? `/api/download/${r.id}` : undefined}
                    onClick={(e) => {
                      if (!canDownload) {
                        e.preventDefault();
                        void signIn();
                      }
                    }}
                    className={`rounded-lg px-3 py-2 text-sm text-white ${
                      canDownload ? "bg-white/10 hover:bg-white/15" : "bg-white/5 opacity-60"
                    }`}
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}