// src/components/home/CommentThread.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

type CommentTarget = "HOME" | "RELEASE";

export type UiComment = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;

  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type Props = {
  canPost: boolean;
  target?: CommentTarget; // default HOME
  releaseId?: string; // required when target=RELEASE
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CommentThread({ canPost, target = "HOME", releaseId }: Props) {
  const [comments, setComments] = useState<UiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [newBody, setNewBody] = useState("");

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const qs =
        target === "RELEASE"
          ? `?releaseId=${encodeURIComponent(releaseId ?? "")}`
          : `?target=home`;

      const res = await fetch(`/api/comments${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // akzeptiere Array ODER { items: [] }
      const list: UiComment[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];

      setComments(list);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Laden der Kommentare.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, releaseId]);

  const byParent = useMemo(() => {
    const map = new Map<string, UiComment[]>();
    for (const c of comments) {
      const key = c.parentId ?? "__root__";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      map.set(k, arr);
    }
    return map;
  }, [comments]);

  const root = byParent.get("__root__") ?? [];

  async function post(payload: { body: string; parentId?: string | null }) {
    if (!canPost) {
      await signIn();
      return;
    }
    if (target === "RELEASE" && !releaseId) {
      setErr("releaseId fehlt (target=RELEASE).");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: payload.body,
          parentId: payload.parentId ?? null,
          target,
          releaseId: target === "RELEASE" ? releaseId : undefined,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setNewBody("");
      setReplyBody("");
      setReplyTo(null);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kommentar konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  function Node({ c, depth }: { c: UiComment; depth: number }) {
    const replies = byParent.get(c.id) ?? [];
    const isReplying = replyTo === c.id;

    return (
      <div
        className="rounded-xl border border-white/10 bg-black/20 p-3"
        style={{ marginLeft: Math.min(depth, 6) * 16 }}
      >
        <div className="flex gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.author.image ? (
              <img src={c.author.image} alt={c.author.name ?? "User"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                {c.author.name?.slice(0, 1)?.toUpperCase() ?? "U"}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-white/90">{c.author.name ?? "User"}</span>
              <span className="text-xs text-white/50">{formatTime(c.createdAt)}</span>
            </div>

            <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">{c.body}</p>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                onClick={() => setReplyTo((p) => (p === c.id ? null : c.id))}
              >
                Antworten
              </button>
            </div>

            {isReplying && (
              <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2">
                {!canPost ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Login nötig zum Antworten.</span>
                    <button
                      type="button"
                      className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                      onClick={() => signIn()}
                    >
                      Login
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      className="min-h-[72px] w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white outline-none placeholder:text-white/40"
                      placeholder="Antwort schreiben…"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      disabled={busy}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                        onClick={() => {
                          setReplyTo(null);
                          setReplyBody("");
                        }}
                        disabled={busy}
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-50"
                        onClick={() => post({ body: replyBody.trim(), parentId: c.id })}
                        disabled={busy || replyBody.trim().length === 0}
                      >
                        Antworten senden
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {replies.length > 0 && (
              <div className="mt-3 space-y-2">
                {replies.map((r) => (
                  <Node key={r.id} c={r} depth={depth + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white/90">
          Kommentare {target === "HOME" ? "zur Startseite" : "zum Release"}
        </h2>

        {!canPost && (
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            onClick={() => signIn()}
          >
            Login zum Kommentieren
          </button>
        )}
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* New comment */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
        <textarea
          className="min-h-[90px] w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-white/40"
          placeholder={canPost ? "Schreibe einen Kommentar…" : "Nur lesen – Login nötig zum Schreiben."}
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          disabled={!canPost || busy}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
            onClick={() => setNewBody("")}
            disabled={!canPost || busy || newBody.length === 0}
          >
            Leeren
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-50"
            onClick={() => post({ body: newBody.trim(), parentId: null })}
            disabled={!canPost || busy || newBody.trim().length === 0}
          >
            Kommentar senden
          </button>
        </div>
      </div>

      {/* list */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="text-sm text-white/60">Lade…</div>
        ) : root.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
            Noch keine Kommentare.
          </div>
        ) : (
          root.map((c) => <Node key={c.id} c={c} depth={0} />)
        )}
      </div>
    </section>
  );
}