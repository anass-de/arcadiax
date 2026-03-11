"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProfileComment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  release: {
    id: string;
    title: string;
    slug: string;
    version: string;
  };
};

export default function ProfileCommentsManager() {
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadComments() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/profile/comments", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Laden");
      }

      setComments(data.comments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadComments();
  }, []);

  function startEdit(comment: ProfileComment) {
    setEditingId(comment.id);
    setEditingText(comment.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEdit(commentId: string) {
    const content = editingText.trim();
    if (!content) return;

    try {
      setBusyId(commentId);
      setError(null);

      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Kommentar konnte nicht gespeichert werden."
        );
      }

      setEditingId(null);
      setEditingText("");
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteComment(commentId: string) {
    const confirmed = window.confirm(
      "Möchtest du diesen Kommentar wirklich löschen?"
    );
    if (!confirmed) return;

    try {
      setBusyId(commentId);
      setError(null);

      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Kommentar konnte nicht gelöscht werden."
        );
      }

      if (editingId === commentId) {
        setEditingId(null);
        setEditingText("");
      }

      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Kommentare werden geladen...</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {comments.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-400">
          Du hast noch keine Kommentare geschrieben.
        </div>
      ) : (
        comments.map((comment) => {
          const isEditing = editingId === comment.id;
          const isBusy = busyId === comment.id;

          return (
            <article
              key={comment.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-400">
                    Zu Release{" "}
                    <Link
                      href={`/releases/${comment.release.slug}`}
                      className="text-white hover:underline"
                    >
                      {comment.release.title}
                    </Link>
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Version {comment.release.version}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(comment.createdAt).toLocaleString("de-DE")}
                    {comment.updatedAt !== comment.createdAt
                      ? " · bearbeitet"
                      : ""}
                  </p>
                </div>

                <div className="flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => startEdit(comment)}
                    disabled={isBusy}
                    className="text-zinc-300 hover:text-white disabled:opacity-50"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteComment(comment.id)}
                    disabled={isBusy}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {isBusy ? "Lösche..." : "Löschen"}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="mt-4">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="min-h-[110px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
                  />
                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isBusy}
                      className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(comment.id)}
                      disabled={isBusy || !editingText.trim()}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {isBusy ? "Speichert..." : "Speichern"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-200">
                  {comment.content}
                </p>
              )}

              <div className="mt-4">
                <Link
                  href={`/releases/${comment.release.slug}`}
                  className="text-xs text-zinc-400 hover:text-white hover:underline"
                >
                  Zum Release öffnen
                </Link>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}