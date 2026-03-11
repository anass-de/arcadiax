"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type CommentUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  user: CommentUser;
  replies: CommentItem[];
};

export default function Comments({ releaseId }: { releaseId: string }) {
  const { data: session, status } = useSession();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function canManageComment(commentUserId: string) {
    if (!session?.user?.id) return false;
    return session.user.id === commentUserId || session.user.role === "ADMIN";
  }

  async function loadComments() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/releases/${releaseId}/comments`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load comments");
      }

      setComments(data.comments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function submitComment() {
    const content = text.trim();
    if (!content) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/releases/${releaseId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to post comment");
      }

      setText("");
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply(parentId: string) {
    const content = replyText.trim();
    if (!content) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/releases/${releaseId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          parentId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to post reply");
      }

      setReplyText("");
      setReplyOpenId(null);
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(comment: CommentItem) {
    setEditingId(comment.id);
    setEditingText(comment.content);
    setReplyOpenId(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEdit(commentId: string) {
    const content = editingText.trim();
    if (!content) return;

    try {
      setActionId(commentId);
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
        throw new Error(data.error || "Failed to update comment");
      }

      setEditingId(null);
      setEditingText("");
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionId(null);
    }
  }

  async function deleteComment(commentId: string) {
    const confirmed = window.confirm(
      "Möchtest du diesen Kommentar wirklich löschen?"
    );

    if (!confirmed) return;

    try {
      setActionId(commentId);
      setError(null);

      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete comment");
      }

      if (editingId === commentId) {
        setEditingId(null);
        setEditingText("");
      }

      if (replyOpenId === commentId) {
        setReplyOpenId(null);
        setReplyText("");
      }

      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionId(null);
    }
  }

  function renderUserLink(user: CommentUser) {
    const label = user.name || user.username || "User";

    if (user.username) {
      return (
        <Link
          href={`/u/${user.username}`}
          className="font-medium text-white hover:underline"
        >
          {label}
        </Link>
      );
    }

    return <span className="font-medium text-white">{label}</span>;
  }

  useEffect(() => {
    void loadComments();
  }, [releaseId]);

  function renderComment(comment: CommentItem, isReply = false) {
    const canManage = canManageComment(comment.user.id);
    const isEditing = editingId === comment.id;
    const isBusy = actionId === comment.id;

    return (
      <div
        key={comment.id}
        className={
          isReply
            ? "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
            : "rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {renderUserLink(comment.user)}

            {comment.user.username ? (
              <p className="text-xs text-zinc-500">
                <Link
                  href={`/u/${comment.user.username}`}
                  className="hover:text-white hover:underline"
                >
                  @{comment.user.username}
                </Link>
              </p>
            ) : null}

            <p className="text-xs text-zinc-500">
              {new Date(comment.createdAt).toLocaleString()}
              {comment.updatedAt !== comment.createdAt ? " · edited" : ""}
            </p>
          </div>

          {canManage ? (
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => startEdit(comment)}
                disabled={isBusy}
                className="text-zinc-400 hover:text-white disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteComment(comment.id)}
                disabled={isBusy}
                className="text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {isBusy ? "Working..." : "Delete"}
              </button>
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-3">
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="min-h-[100px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isBusy}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEdit(comment.id)}
                disabled={isBusy || !editingText.trim()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                {isBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">
            {comment.content}
          </p>
        )}

        {!isReply && status === "authenticated" && !isEditing ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() =>
                setReplyOpenId(replyOpenId === comment.id ? null : comment.id)
              }
              className="text-sm text-zinc-300 hover:text-white"
            >
              {replyOpenId === comment.id ? "Cancel" : "Reply"}
            </button>
          </div>
        ) : null}

        {!isReply && replyOpenId === comment.id ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[90px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => submitReply(comment.id)}
                disabled={submitting || !replyText.trim()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post reply"}
              </button>
            </div>
          </div>
        ) : null}

        {!isReply && comment.replies.length > 0 ? (
          <div className="mt-5 space-y-4 border-l border-zinc-800 pl-4">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Comments</h2>
        <span className="text-sm text-zinc-400">
          {comments.length} thread{comments.length === 1 ? "" : "s"}
        </span>
      </div>

      {status === "authenticated" ? (
        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="min-h-[120px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submitComment}
              disabled={submitting || !text.trim()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post comment"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300">
          Sign in to write a comment.
        </div>
      )}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-400">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
          No comments yet.
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}
    </section>
  );
}