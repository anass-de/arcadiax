"use client";

import { useEffect, useMemo, useState } from "react";

type UserMini = { id: string; name: string | null; image: string | null; username: string | null };
type Reply = { id: string; content: string; createdAt: string; user: UserMini };
type CommentNode = { id: string; content: string; createdAt: string; user: UserMini; replies: Reply[] };

function Avatar({ user }: { user: UserMini }) {
  const letter = (user.name?.[0] ?? user.username?.[0] ?? "?").toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center text-sm">
      {letter}
    </div>
  );
}

export default function CommentsPanel({
  releaseId,
  currentUserId,
}: {
  releaseId: string;
  currentUserId?: string | null;
}) {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [newText, setNewText] = useState("");

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/releases/${releaseId}/comments`, { cache: "no-store" });
    const data = await res.json();
    setComments(data.comments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseId]);

  const totalCount = useMemo(
    () => comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0),
    [comments]
  );

  async function post(content: string, parentId?: string | null) {
    const res = await fetch(`/api/releases/${releaseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId: parentId ?? null }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(e.error ?? "Failed");
      return;
    }
    await load();
  }

  async function del(commentId: string) {
    if (!confirm("Delete comment?")) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(e.error ?? "Failed");
      return;
    }
    await load();
  }

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">Comments</h2>
        <div className="text-sm text-zinc-400">{totalCount} total</div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        {currentUserId ? (
          <>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 outline-none focus:border-zinc-600"
              placeholder="Write a comment…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setNewText("")}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-zinc-200 hover:border-zinc-600"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const text = newText.trim();
                  if (!text) return;
                  setNewText("");
                  await post(text, null);
                }}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-zinc-950 hover:bg-white"
                type="button"
              >
                Comment
              </button>
            </div>
          </>
        ) : (
          <div className="text-zinc-300">Please log in to comment.</div>
        )}
      </div>

      {replyTo && currentUserId && (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-sm text-zinc-400">Replying…</div>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 outline-none focus:border-zinc-600"
            placeholder="Write a reply…"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setReplyTo(null);
                setReplyText("");
              }}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-zinc-200 hover:border-zinc-600"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const text = replyText.trim();
                if (!text) return;
                const parent = replyTo;
                setReplyTo(null);
                setReplyText("");
                await post(text, parent);
              }}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-zinc-950 hover:bg-white"
              type="button"
            >
              Reply
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {loading ? (
          <div className="text-zinc-400">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="text-zinc-400">No comments yet.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="space-y-3">
              <div className="flex gap-3">
                <Avatar user={c.user} />
                <div className="flex-1">
                  <div className="text-sm text-zinc-400">
                    <span className="text-zinc-200 font-medium">
                      {c.user.username ? `@${c.user.username}` : c.user.name ?? "User"}
                    </span>
                    <span className="ml-2 text-xs">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="text-zinc-100 mt-1 whitespace-pre-wrap">{c.content}</div>

                  <div className="mt-2 flex gap-3 text-sm text-zinc-400">
                    {currentUserId && (
                      <button
                        className="hover:text-zinc-200"
                        onClick={() => {
                          setReplyTo(c.id);
                          setReplyText("");
                        }}
                        type="button"
                      >
                        Reply
                      </button>
                    )}
                    {currentUserId === c.user.id && (
                      <button
                        className="hover:text-red-300"
                        onClick={() => del(c.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {c.replies?.length > 0 && (
                <div className="ml-11 space-y-3 border-l border-zinc-800 pl-4">
                  {c.replies.map((r) => (
                    <div key={r.id} className="flex gap-3">
                      <Avatar user={r.user} />
                      <div className="flex-1">
                        <div className="text-sm text-zinc-400">
                          <span className="text-zinc-200 font-medium">
                            {r.user.username ? `@${r.user.username}` : r.user.name ?? "User"}
                          </span>
                          <span className="ml-2 text-xs">
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-zinc-100 mt-1 whitespace-pre-wrap">{r.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}