"use client";

import { useMemo, useState } from "react";
import {
  CornerDownRight,
  MessageSquare,
  Pencil,
  Reply,
  Save,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";

type CommunityUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: string | null;
};

type CommunityReply = {
  id: string;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  parentId?: string | null;
  user: CommunityUser;
};

type CommunityPost = {
  id: string;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  parentId?: string | null;
  user: CommunityUser;
  replies: CommunityReply[];
};

type CurrentUser = {
  id?: string | null;
  name?: string | null;
  username?: string | null;
  image?: string | null;
  role?: string | null;
} | null;

type CommunityFeedProps = {
  posts: CommunityPost[];
  currentUser: CurrentUser;
};

type CreatePostResponse =
  | {
      post?: Omit<CommunityPost, "replies"> & {
        replies?: CommunityReply[];
      };
      error?: string;
    }
  | null;

type CreateReplyResponse =
  | {
      post?: CommunityReply;
      error?: string;
    }
  | null;

type UpdateMessageResponse =
  | {
      post?: (Omit<CommunityPost, "replies"> & {
        replies?: CommunityReply[];
      }) | CommunityReply;
      error?: string;
    }
  | null;

type DeleteMessageResponse =
  | {
      success?: boolean;
      error?: string;
    }
  | null;

function formatDateTime(value: string | Date) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDisplayName(user: {
  name?: string | null;
  username?: string | null;
}) {
  return user.name?.trim() || user.username?.trim() || "User";
}

function getInitials(user: {
  name?: string | null;
  username?: string | null;
}) {
  const source = getDisplayName(user);
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function CommunityFeed({
  posts: initialPosts,
  currentUser,
}: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isLoggedIn = Boolean(currentUser?.id);
  const isAdmin = currentUser?.role === "ADMIN";

  const sortedPosts = useMemo(() => {
    return [...posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [posts]);

  function showError(message: string) {
    setFeedback({ type: "error", text: message });
  }

  function showSuccess(message: string) {
    setFeedback({ type: "success", text: message });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingContent("");
  }

  function cancelReply() {
    setReplyingToId(null);
    setReplyContent("");
  }

  function findPostOrReplyById(id: string) {
    for (const post of posts) {
      if (post.id === id) {
        return { kind: "post" as const, post, reply: null };
      }

      for (const reply of post.replies) {
        if (reply.id === id) {
          return { kind: "reply" as const, post, reply };
        }
      }
    }

    return null;
  }

  async function handleCreatePost() {
    const trimmed = content.trim();

    if (!trimmed) {
      showError("Bitte schreibe zuerst eine Nachricht.");
      return;
    }

    if (!isLoggedIn) {
      showError("Du musst eingeloggt sein, um eine Nachricht zu schreiben.");
      return;
    }

    setIsCreating(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
        }),
      });

      const data = (await response.json().catch(() => null)) as CreatePostResponse;

      if (!response.ok || !data?.post) {
        throw new Error(data?.error || "Nachricht konnte nicht erstellt werden.");
      }

      const createdPost = data.post;

      setPosts((prev) => [
        {
          ...createdPost,
          replies: Array.isArray(createdPost.replies) ? createdPost.replies : [],
        },
        ...prev,
      ]);

      setContent("");
      showSuccess("Nachricht erfolgreich erstellt.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Beim Erstellen der Nachricht ist ein Fehler aufgetreten."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateReply(parentPostId: string) {
    const trimmed = replyContent.trim();

    if (!trimmed) {
      showError("Bitte schreibe zuerst eine Antwort.");
      return;
    }

    if (!isLoggedIn) {
      showError("Du musst eingeloggt sein, um zu antworten.");
      return;
    }

    setBusyId(parentPostId);
    setFeedback(null);

    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
          parentId: parentPostId,
        }),
      });

      const data = (await response.json().catch(() => null)) as CreateReplyResponse;

      if (!response.ok || !data?.post) {
        throw new Error(data?.error || "Antwort konnte nicht erstellt werden.");
      }

      const createdReply = data.post;

      setPosts((prev) =>
        prev.map((post) =>
          post.id === parentPostId
            ? {
                ...post,
                replies: [...post.replies, createdReply].sort(
                  (a, b) =>
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime()
                ),
              }
            : post
        )
      );

      setReplyContent("");
      setReplyingToId(null);
      showSuccess("Antwort erfolgreich erstellt.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Beim Erstellen der Antwort ist ein Fehler aufgetreten."
      );
    } finally {
      setBusyId(null);
    }
  }

  function startEditing(item: CommunityPost | CommunityReply) {
    setEditingId(item.id);
    setEditingContent(item.content);
    setFeedback(null);
    cancelReply();
  }

  async function handleSaveEdit(itemId: string) {
    const trimmed = editingContent.trim();

    if (!trimmed) {
      showError("Die Nachricht darf nicht leer sein.");
      return;
    }

    setBusyId(itemId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/community/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
        }),
      });

      const data = (await response.json().catch(() => null)) as UpdateMessageResponse;

      if (!response.ok || !data?.post) {
        throw new Error(
          data?.error || "Nachricht konnte nicht aktualisiert werden."
        );
      }

      const updatedItem = data.post;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === itemId) {
            return {
              ...post,
              id: updatedItem.id,
              content: updatedItem.content,
              createdAt: updatedItem.createdAt,
              updatedAt: updatedItem.updatedAt,
              parentId: updatedItem.parentId,
              user: updatedItem.user,
              replies: post.replies,
            };
          }

          return {
            ...post,
            replies: post.replies.map((reply) =>
              reply.id === itemId
                ? {
                    ...reply,
                    id: updatedItem.id,
                    content: updatedItem.content,
                    createdAt: updatedItem.createdAt,
                    updatedAt: updatedItem.updatedAt,
                    parentId: updatedItem.parentId,
                    user: updatedItem.user,
                  }
                : reply
            ),
          };
        })
      );

      setEditingId(null);
      setEditingContent("");
      showSuccess("Nachricht erfolgreich bearbeitet.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Beim Bearbeiten der Nachricht ist ein Fehler aufgetreten."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(itemId: string) {
    const found = findPostOrReplyById(itemId);

    if (!found) {
      showError("Nachricht nicht gefunden.");
      return;
    }

    const ownerId =
      found.kind === "post" ? found.post.user.id : found.reply?.user.id;
    const allowed = currentUser?.id === ownerId || isAdmin;

    if (!allowed) {
      showError("Du darfst diese Nachricht nicht löschen.");
      return;
    }

    const confirmed = window.confirm(
      "Möchtest du diese Nachricht wirklich löschen?"
    );

    if (!confirmed) return;

    setBusyId(itemId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/community/${itemId}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as DeleteMessageResponse;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Nachricht konnte nicht gelöscht werden.");
      }

      setPosts((prev) =>
        prev
          .filter((post) => post.id !== itemId)
          .map((post) => ({
            ...post,
            replies: post.replies.filter((reply) => reply.id !== itemId),
          }))
      );

      if (editingId === itemId) {
        cancelEditing();
      }

      if (replyingToId === itemId) {
        cancelReply();
      }

      showSuccess("Nachricht erfolgreich gelöscht.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Beim Löschen der Nachricht ist ein Fehler aufgetreten."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white sm:text-2xl">
              Community Feed
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Teile Gedanken, Ideen und Feedback mit der ArcadiaX Community.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70">
            {posts.length} {posts.length === 1 ? "Beitrag" : "Beiträge"}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4 sm:p-5">
          {isLoggedIn ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#6c5ce7]/30 bg-[#6c5ce7]/15 text-sm font-semibold text-[#b8adff]">
                  {getInitials({
                    name: currentUser?.name,
                    username: currentUser?.username,
                  })}
                </div>

                <div>
                  <p className="font-medium text-white">
                    {getDisplayName({
                      name: currentUser?.name,
                      username: currentUser?.username,
                    })}
                  </p>
                  <p className="text-sm text-white/50">
                    @{currentUser?.username || "user"}
                  </p>
                </div>
              </div>

              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="Schreibe einen neuen Beitrag an die ArcadiaX Community..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/45">
                  {content.trim().length}/1000 Zeichen
                </p>

                <button
                  type="button"
                  onClick={handleCreatePost}
                  disabled={isCreating || !content.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6c5ce7] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {isCreating ? "Wird gesendet..." : "Beitrag senden"}
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl border border-white/10 bg-black/20 p-2 text-white/70">
                  <User className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="font-medium text-white">Login erforderlich</h3>
                  <p className="mt-1 text-sm leading-6 text-white/60">
                    Du kannst alle Beiträge und Antworten lesen. Um selbst einen
                    Beitrag zu schreiben oder auf andere zu antworten, musst du
                    eingeloggt sein.
                  </p>
                </div>
              </div>
            </div>
          )}

          {feedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/20 bg-red-500/10 text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        {sortedPosts.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center shadow-xl shadow-black/10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6c5ce7]/30 bg-[#6c5ce7]/10 text-[#a99cff]">
              <MessageSquare className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              Noch keine Beiträge
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Sei der Erste und starte die Unterhaltung in der ArcadiaX Community.
            </p>
          </div>
        ) : (
          sortedPosts.map((post) => {
            const isOwner = currentUser?.id === post.user.id;
            const canEdit = isOwner;
            const canDelete = isOwner || isAdmin;
            const isEditing = editingId === post.id;
            const isBusy = busyId === post.id;

            return (
              <article
                key={post.id}
                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/10 backdrop-blur sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
                      {post.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.user.image}
                          alt={getDisplayName(post.user)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(post.user)
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-white">
                          {getDisplayName(post.user)}
                        </h3>

                        {post.user.role === "ADMIN" ? (
                          <span className="rounded-full border border-[#6c5ce7]/30 bg-[#6c5ce7]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a99cff]">
                            Admin
                          </span>
                        ) : null}

                        {isOwner ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            You
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-white/45">
                        @{post.user.username || "user"} ·{" "}
                        {formatDateTime(post.createdAt)}
                        {new Date(post.updatedAt).getTime() >
                        new Date(post.createdAt).getTime()
                          ? " · bearbeitet"
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isLoggedIn && !isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId((current) =>
                            current === post.id ? null : post.id
                          );
                          setReplyContent("");
                          setFeedback(null);
                          cancelEditing();
                        }}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-2 text-sm text-white/75 transition hover:border-[#6c5ce7]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Reply className="h-4 w-4" />
                        Antworten
                      </button>
                    ) : null}

                    {canEdit && !isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEditing(post)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-2 text-sm text-white/75 transition hover:border-[#6c5ce7]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Bearbeiten
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-sm text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Löschen
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        rows={5}
                        maxLength={1000}
                        className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50"
                      />

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-white/45">
                          {editingContent.trim().length}/1000 Zeichen
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(post.id)}
                            disabled={isBusy || !editingContent.trim()}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {isBusy ? "Speichert..." : "Speichern"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white/75 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-white/85 sm:text-[15px]">
                      {post.content}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-3 text-sm text-white/45">
                  <div className="flex items-center gap-2">
                    <CornerDownRight className="h-4 w-4" />
                    <span>
                      {post.replies.length}{" "}
                      {post.replies.length === 1 ? "Antwort" : "Antworten"}
                    </span>
                  </div>
                </div>

                {replyingToId === post.id ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
                      <Reply className="h-4 w-4" />
                      Antwort an{" "}
                      <span className="font-medium text-white">
                        {getDisplayName(post.user)}
                      </span>
                    </div>

                    <textarea
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder="Schreibe deine Antwort..."
                      className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
                    />

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-white/45">
                        {replyContent.trim().length}/1000 Zeichen
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleCreateReply(post.id)}
                          disabled={busyId === post.id || !replyContent.trim()}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          {busyId === post.id ? "Wird gesendet..." : "Antwort senden"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelReply}
                          disabled={busyId === post.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white/75 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {post.replies.length > 0 ? (
                  <div className="mt-5 space-y-3 border-l border-white/10 pl-4 sm:pl-6">
                    {post.replies.map((reply) => {
                      const replyOwner = currentUser?.id === reply.user.id;
                      const replyCanEdit = replyOwner;
                      const replyCanDelete = replyOwner || isAdmin;
                      const replyIsEditing = editingId === reply.id;
                      const replyIsBusy = busyId === reply.id;

                      return (
                        <div
                          key={reply.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-xs font-semibold text-white">
                                {reply.user.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={reply.user.image}
                                    alt={getDisplayName(reply.user)}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getInitials(reply.user)
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate font-medium text-white">
                                    {getDisplayName(reply.user)}
                                  </h4>

                                  {reply.user.role === "ADMIN" ? (
                                    <span className="rounded-full border border-[#6c5ce7]/30 bg-[#6c5ce7]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a99cff]">
                                      Admin
                                    </span>
                                  ) : null}

                                  {replyOwner ? (
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                                      You
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-1 text-xs text-white/45">
                                  @{reply.user.username || "user"} ·{" "}
                                  {formatDateTime(reply.createdAt)}
                                  {new Date(reply.updatedAt).getTime() >
                                  new Date(reply.createdAt).getTime()
                                    ? " · bearbeitet"
                                    : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {replyCanEdit && !replyIsEditing ? (
                                <button
                                  type="button"
                                  onClick={() => startEditing(reply)}
                                  disabled={replyIsBusy}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75 transition hover:border-[#6c5ce7]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Bearbeiten
                                </button>
                              ) : null}

                              {replyCanDelete ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(reply.id)}
                                  disabled={replyIsBusy}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Löschen
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3">
                            {replyIsEditing ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editingContent}
                                  onChange={(event) =>
                                    setEditingContent(event.target.value)
                                  }
                                  rows={4}
                                  maxLength={1000}
                                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50"
                                />

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm text-white/45">
                                    {editingContent.trim().length}/1000 Zeichen
                                  </p>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(reply.id)}
                                      disabled={
                                        replyIsBusy || !editingContent.trim()
                                      }
                                      className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <Save className="h-4 w-4" />
                                      {replyIsBusy ? "Speichert..." : "Speichern"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      disabled={replyIsBusy}
                                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white/75 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <X className="h-4 w-4" />
                                      Abbrechen
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap text-sm leading-7 text-white/80">
                                {reply.content}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}