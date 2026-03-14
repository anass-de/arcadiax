"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Reply,
  Send,
  User,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";

type CommentUser = {
  id: string;
  name: string | null;
  username?: string | null;
  image?: string | null;
};

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  userId?: string | null;
  user: CommentUser;
  replies: CommentItem[];
};

type ReleaseCommentsProps = {
  releaseId: string;
  currentUser?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
    image?: string | null;
    role?: string | null;
  } | null;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDisplayName(user?: CommentUser | ReleaseCommentsProps["currentUser"]) {
  if (!user) return "Unknown User";
  return user.username?.trim() || user.name?.trim() || "User";
}

function getInitials(user?: CommentUser | ReleaseCommentsProps["currentUser"]) {
  const source = getDisplayName(user);
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function ReleaseComments({
  releaseId,
  currentUser,
}: ReleaseCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyPostingFor, setReplyPostingFor] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<Record<string, string>>({});
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isLoggedIn = !!currentUser?.id;
  const isAdmin = currentUser?.role === "ADMIN";

  const totalCount = useMemo(() => {
    return comments.reduce((sum, comment) => {
      return sum + 1 + (comment.replies?.length ?? 0);
    }, 0);
  }, [comments]);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingError(null);

      const response = await fetch(`/api/releases/${releaseId}/comments`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load comments.");
      }

      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load comments.";

      setLoadingError(message);
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  function canManageComment(comment: CommentItem) {
    if (!currentUser?.id) return false;
    if (isAdmin) return true;
    return comment.user?.id === currentUser.id;
  }

  async function handleCreateComment() {
    const content = newComment.trim();

    if (!content || posting) return;

    try {
      setPosting(true);
      setLoadingError(null);

      const response = await fetch(`/api/releases/${releaseId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create comment.");
      }

      setNewComment("");
      await loadComments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create comment.";

      setLoadingError(message);
    } finally {
      setPosting(false);
    }
  }

  async function handleCreateReply(parentId: string) {
    const content = (replyText[parentId] || "").trim();

    if (!content || replyPostingFor === parentId) return;

    try {
      setReplyPostingFor(parentId);
      setLoadingError(null);

      const response = await fetch(`/api/releases/${releaseId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          parentId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create reply.");
      }

      setReplyText((prev) => ({ ...prev, [parentId]: "" }));
      setReplyOpenFor(null);
      await loadComments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create reply.";

      setLoadingError(message);
    } finally {
      setReplyPostingFor(null);
    }
  }

  async function handleSaveEdit(commentId: string) {
    const content = (editText[commentId] || "").trim();

    if (!content || savingEditId === commentId) return;

    try {
      setSavingEditId(commentId);
      setLoadingError(null);

      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update comment.");
      }

      setEditingId(null);
      await loadComments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update comment.";

      setLoadingError(message);
    } finally {
      setSavingEditId(null);
    }
  }

  async function handleDeleteComment(commentId: string) {
    const confirmed = window.confirm(
      "Do you really want to delete this comment?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(commentId);
      setLoadingError(null);

      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete comment.");
      }

      await loadComments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete comment.";

      setLoadingError(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <MessageSquare className="h-5 w-5 text-blue-300" />
          </div>

          <div>
            <div className="text-sm font-medium text-white/50">Community</div>
            <h2 className="text-2xl font-semibold text-white">
              Comments {totalCount > 0 ? `(${totalCount})` : ""}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadComments()}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
        >
          Refresh
        </button>
      </div>

      {!isLoggedIn ? (
        <div className="mb-6 rounded-[24px] border border-white/10 bg-[#07090f] p-5">
          <div className="text-sm font-semibold text-white">
            Please log in to comment
          </div>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Guests can read comments. Only signed-in users can post new comments
            or replies.
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-[24px] border border-white/10 bg-[#07090f] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white">
              {getInitials(currentUser)}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {getDisplayName(currentUser)}
              </div>
              <div className="text-xs text-white/45">Write a new comment</div>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Write your comment about this release..."
              className="w-full rounded-2xl border border-white/10 bg-[#05070b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/40">
                {newComment.length}/2000 characters
              </div>

              <button
                type="button"
                onClick={() => void handleCreateComment()}
                disabled={posting || !newComment.trim()}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4 text-blue-300" />
                <span>{posting ? "Posting..." : "Post Comment"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingError ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {loadingError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-5 text-sm text-white/60">
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-5">
          <div className="text-sm font-semibold text-white">
            No comments yet
          </div>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Be the first person to say something about this release.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const isReplyOpen = replyOpenFor === comment.id;
            const replyValue = replyText[comment.id] || "";
            const isReplyPosting = replyPostingFor === comment.id;

            const isEditing = editingId === comment.id;
            const isSavingEdit = savingEditId === comment.id;
            const canManage = canManageComment(comment);

            return (
              <article
                key={comment.id}
                className="rounded-[24px] border border-white/10 bg-[#07090f] p-5"
              >
                <div className="flex items-start gap-4">
                  {comment.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comment.user.image}
                      alt={getDisplayName(comment.user)}
                      className="h-11 w-11 rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white">
                      {getInitials(comment.user)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {getDisplayName(comment.user)}
                        </div>

                        <div className="mt-1 inline-flex items-center gap-2 text-xs text-white/40">
                          <User className="h-3.5 w-3.5" />
                          <span>{formatDateTime(comment.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isLoggedIn ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReplyOpenFor((prev) =>
                                prev === comment.id ? null : comment.id
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                          >
                            <Reply className="h-3.5 w-3.5" />
                            <span>Reply</span>
                          </button>
                        ) : null}

                        {canManage ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditText((prev) => ({
                                  ...prev,
                                  [comment.id]: comment.content,
                                }));
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDeleteComment(comment.id)}
                              disabled={deletingId === comment.id}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>
                                {deletingId === comment.id ? "Deleting..." : "Delete"}
                              </span>
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-[#05070b] p-4">
                        <div className="space-y-3">
                          <textarea
                            value={editText[comment.id] || ""}
                            onChange={(e) =>
                              setEditText((prev) => ({
                                ...prev,
                                [comment.id]: e.target.value,
                              }))
                            }
                            rows={4}
                            maxLength={2000}
                            className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-white/40">
                              {(editText[comment.id] || "").length}/2000 characters
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Cancel</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleSaveEdit(comment.id)}
                                disabled={
                                  isSavingEdit || !(editText[comment.id] || "").trim()
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/12 px-3 py-2 text-xs font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:opacity-50"
                              >
                                <Save className="h-3.5 w-3.5 text-blue-300" />
                                <span>
                                  {isSavingEdit ? "Saving..." : "Save"}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/68">
                        {comment.content}
                      </p>
                    )}

                    {isReplyOpen ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-[#05070b] p-4">
                        <div className="space-y-3">
                          <textarea
                            value={replyValue}
                            onChange={(e) =>
                              setReplyText((prev) => ({
                                ...prev,
                                [comment.id]: e.target.value,
                              }))
                            }
                            rows={3}
                            maxLength={2000}
                            placeholder={`Reply to ${getDisplayName(comment.user)}...`}
                            className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-white/40">
                              {replyValue.length}/2000 characters
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyOpenFor(null);
                                  setReplyText((prev) => ({
                                    ...prev,
                                    [comment.id]: "",
                                  }));
                                }}
                                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCreateReply(comment.id)}
                                disabled={isReplyPosting || !replyValue.trim()}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/12 px-3 py-2 text-xs font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Send className="h-3.5 w-3.5 text-blue-300" />
                                <span>
                                  {isReplyPosting ? "Posting..." : "Post Reply"}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {comment.replies?.length ? (
                      <div className="mt-5 space-y-3 border-l border-white/10 pl-4 sm:pl-5">
                        {comment.replies.map((reply) => {
                          const canManageReply = canManageComment(reply);
                          const isEditingReply = editingId === reply.id;
                          const isSavingReply = savingEditId === reply.id;

                          return (
                            <div
                              key={reply.id}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                            >
                              <div className="flex items-start gap-3">
                                {reply.user?.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={reply.user.image}
                                    alt={getDisplayName(reply.user)}
                                    className="h-9 w-9 rounded-xl border border-white/10 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#05070b] text-xs font-semibold text-white">
                                    {getInitials(reply.user)}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="truncate text-sm font-semibold text-white">
                                        {getDisplayName(reply.user)}
                                      </div>
                                      <div className="mt-1 text-xs text-white/40">
                                        {formatDateTime(reply.createdAt)}
                                      </div>
                                    </div>

                                    {canManageReply ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingId(reply.id);
                                            setEditText((prev) => ({
                                              ...prev,
                                              [reply.id]: reply.content,
                                            }));
                                          }}
                                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#05070b] px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                          <span>Edit</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteComment(reply.id)}
                                          disabled={deletingId === reply.id}
                                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15 disabled:opacity-50"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          <span>
                                            {deletingId === reply.id
                                              ? "Deleting..."
                                              : "Delete"}
                                          </span>
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>

                                  {isEditingReply ? (
                                    <div className="mt-3 rounded-2xl border border-white/10 bg-[#05070b] p-4">
                                      <div className="space-y-3">
                                        <textarea
                                          value={editText[reply.id] || ""}
                                          onChange={(e) =>
                                            setEditText((prev) => ({
                                              ...prev,
                                              [reply.id]: e.target.value,
                                            }))
                                          }
                                          rows={3}
                                          maxLength={2000}
                                          className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/30"
                                        />

                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                            <span>Cancel</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => void handleSaveEdit(reply.id)}
                                            disabled={
                                              isSavingReply ||
                                              !(editText[reply.id] || "").trim()
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/12 px-3 py-2 text-xs font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:opacity-50"
                                          >
                                            <Save className="h-3.5 w-3.5 text-blue-300" />
                                            <span>
                                              {isSavingReply
                                                ? "Saving..."
                                                : "Save"}
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/68">
                                      {reply.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}