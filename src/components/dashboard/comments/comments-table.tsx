"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  MessageSquare,
  Package,
  Trash2,
  User,
} from "lucide-react";

type CommentRow = {
  id: string;
  content: string;
  createdAt: string | Date;
  parentId: string | null;
  user?: {
    id?: string;
    name?: string | null;
    username?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  release: {
    id: string;
    title?: string | null;
    version?: string | null;
    slug?: string | null;
  };
  parent?: {
    id: string;
    content: string;
  } | null;
  _count: {
    replies: number;
  };
};

type CommentsTableProps = {
  comments: CommentRow[];
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
};

function formatDateTime(dateValue: string | Date) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAuthorName(comment: CommentRow) {
  return (
    comment.user?.username?.trim() ||
    comment.user?.name?.trim() ||
    comment.user?.email?.split("@")[0] ||
    "Unbekannter Benutzer"
  );
}

function getReleaseLabel(release?: {
  title?: string | null;
  version?: string | null;
} | null) {
  if (!release?.title) return "Unbekanntes Release";
  if (release.version?.trim()) return `${release.title} (${release.version})`;
  return release.title;
}

function shorten(text: string, max = 150) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export default function CommentsTable({
  comments,
  filteredCount,
  currentPage,
  totalPages,
  prevHref,
  nextHref,
}: CommentsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingSingleDeleteId, setPendingSingleDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const commentIds = useMemo(() => comments.map((comment) => comment.id), [comments]);

  const allSelected =
    comments.length > 0 && commentIds.every((id) => selectedIds.includes(id));

  const someSelected = selectedIds.length > 0;

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(commentIds);
  }

  async function handleSingleDelete(commentId: string) {
    const confirmed = window.confirm(
      "Möchtest du diesen Kommentar wirklich löschen?"
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        setPendingSingleDeleteId(commentId);

        const response = await fetch(`/api/comments/${commentId}`, {
          method: "DELETE",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Kommentar konnte nicht gelöscht werden.");
        }

        window.location.reload();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Kommentar konnte nicht gelöscht werden.";

        window.alert(message);
      } finally {
        setPendingSingleDeleteId(null);
      }
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) {
      window.alert("Bitte wähle zuerst mindestens einen Kommentar aus.");
      return;
    }

    const confirmed = window.confirm(
      `Möchtest du wirklich ${selectedIds.length} Kommentar${
        selectedIds.length === 1 ? "" : "e"
      } löschen?`
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/comments/bulk-delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ids: selectedIds,
          }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Bulk Delete fehlgeschlagen.");
        }

        setSelectedIds([]);
        window.location.reload();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Bulk Delete fehlgeschlagen.";

        window.alert(message);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-medium text-white/50">Ergebnisse</div>
          <h2 className="text-2xl font-semibold text-white">
            Kommentar-Tabelle
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2 text-sm text-white/60">
            {filteredCount} Treffer
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2 text-sm text-white/60">
            {selectedIds.length} ausgewählt
          </div>

          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={!someSelected || isPending}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span>{isPending ? "Löschen..." : "Auswahl löschen"}</span>
          </button>
        </div>
      </div>

      {comments.length === 0 ? (
        <div className="px-6 py-10 sm:px-8">
          <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-6">
            <div className="text-sm font-semibold text-white">
              Keine Kommentare gefunden
            </div>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Für die aktuellen Filter wurden keine Kommentare gefunden.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#07090f]/80 text-left">
                <th className="px-6 py-4 sm:px-8">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-white/20 bg-[#07090f] accent-blue-500"
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      Auswahl
                    </span>
                  </div>
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Typ
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Autor
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Release
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Inhalt
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Datum
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-white/40 sm:px-8">
                  Aktion
                </th>
              </tr>
            </thead>

            <tbody>
              {comments.map((comment) => {
                const isReply = !!comment.parentId;
                const releaseHref = comment.release.slug
                  ? `/releases/${comment.release.slug}`
                  : `/releases/${comment.release.id}`;

                const isSelected = selectedIds.includes(comment.id);
                const isDeletingThis = pendingSingleDeleteId === comment.id;

                return (
                  <tr
                    key={comment.id}
                    className={`border-b border-white/10 align-top transition hover:bg-white/[0.02] ${
                      isSelected ? "bg-blue-500/[0.06]" : ""
                    }`}
                  >
                    <td className="px-6 py-5 sm:px-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(comment.id)}
                        className="h-4 w-4 rounded border-white/20 bg-[#07090f] accent-blue-500"
                      />
                    </td>

                    <td className="px-6 py-5">
                      {isReply ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/75">
                          <CornerDownRight className="h-3.5 w-3.5 text-blue-300" />
                          Reply
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Kommentar
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex min-w-[180px] items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#07090f] text-sm font-semibold text-white">
                          <User className="h-4 w-4 text-blue-300" />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {getAuthorName(comment)}
                          </div>
                          <div className="truncate text-xs text-white/45">
                            {comment.user?.email ?? "Kein E-Mail-Wert"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="min-w-[200px]">
                        <Link
                          href={releaseHref}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-blue-200"
                        >
                          <Package className="h-4 w-4 text-blue-300" />
                          <span>{getReleaseLabel(comment.release)}</span>
                        </Link>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="min-w-[280px] max-w-[420px]">
                        <div className="text-sm leading-6 text-white/75">
                          {shorten(comment.content, 150)}
                        </div>

                        {comment.parent ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-[#07090f] px-3 py-3 text-xs leading-5 text-white/45">
                            Antwort auf: {shorten(comment.parent.content, 90)}
                          </div>
                        ) : null}

                        {!isReply && comment._count.replies > 0 ? (
                          <div className="mt-3 text-xs text-white/40">
                            {comment._count.replies} Antwort
                            {comment._count.replies === 1 ? "" : "en"}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="min-w-[130px] text-sm text-white/60">
                        {formatDateTime(comment.createdAt)}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-right sm:px-8">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleSingleDelete(comment.id)}
                          disabled={isDeletingThis || isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>{isDeletingThis ? "Löschen..." : "Löschen"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-white/50">
          Seite {currentPage} von {totalPages}
        </div>

        <div className="flex items-center gap-3">
          {prevHref ? (
            <Link
              href={prevHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Zurück</span>
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white/30">
              <ChevronLeft className="h-4 w-4" />
              <span>Zurück</span>
            </span>
          )}

          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <span>Weiter</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white/30">
              <span>Weiter</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
}