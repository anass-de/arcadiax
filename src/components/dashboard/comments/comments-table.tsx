"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Reply,
  Trash2,
  User,
  Package,
  AlertTriangle,
} from "lucide-react";

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
  };
  release: {
    id: string;
    title: string;
    version: string | null;
    slug: string;
  };
  parent: {
    id: string;
    content: string;
  } | null;
  _count: {
    replies: number;
  };
};

type CommentsTableProps = {
  comments: CommentItem[];
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
};

function getAuthorLabel(comment: CommentItem) {
  return (
    comment.user.username ||
    comment.user.name ||
    comment.user.email ||
    "Unbekannt"
  );
}

function getReleaseLabel(comment: CommentItem) {
  if (comment.release.version?.trim()) {
    return `${comment.release.title} (${comment.release.version})`;
  }

  return comment.release.title;
}

function truncate(text: string, max = 140) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
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
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectedCount = selectedIds.length;

  const allVisibleSelected = useMemo(() => {
    if (comments.length === 0) return false;
    return comments.every((comment) => selectedIds.includes(comment.id));
  }, [comments, selectedIds]);

  function toggleOne(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !comments.some((comment) => comment.id === id))
      );
      return;
    }

    setSelectedIds((current) => {
      const merged = new Set(current);
      comments.forEach((comment) => merged.add(comment.id));
      return Array.from(merged);
    });
  }

  function closeSingleDeleteModal() {
    setSingleDeleteId(null);
  }

  function closeBulkDeleteModal() {
    setBulkDeleteOpen(false);
  }

  return (
    <>
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm font-medium text-white/45">Ergebnisse</div>
              <h2 className="text-2xl font-semibold text-white">
                Kommentar-Tabelle
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-white/10 bg-[#07090f] px-4 py-2 text-sm text-white/60">
                {filteredCount} Treffer
              </div>

              <div className="rounded-full border border-white/10 bg-[#07090f] px-4 py-2 text-sm text-white/60">
                {selectedCount} ausgewählt
              </div>

              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={selectedCount === 0}
                className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                  selectedCount === 0
                    ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/30"
                    : "border-red-500/20 bg-red-500/10 text-red-200 hover:border-red-400/30 hover:bg-red-500/15"
                }`}
              >
                <Trash2 className="h-4 w-4" />
                Auswahl löschen
              </button>
            </div>
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="px-6 py-10 text-sm text-white/55 sm:px-8">
            Keine Kommentare für diese Filter gefunden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.22em] text-white/35">
                  <th className="px-6 py-4 sm:px-8">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 rounded border-white/20 bg-[#07090f]"
                      />
                      <span>Auswahl</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 sm:px-8">Typ</th>
                  <th className="px-6 py-4 sm:px-8">Autor</th>
                  <th className="px-6 py-4 sm:px-8">Release</th>
                  <th className="px-6 py-4 sm:px-8">Inhalt</th>
                  <th className="px-6 py-4 sm:px-8">Aktionen</th>
                </tr>
              </thead>

              <tbody>
                {comments.map((comment) => {
                  const isReply = !!comment.parentId;
                  const isSelected = selectedIds.includes(comment.id);

                  return (
                    <tr
                      key={comment.id}
                      className="border-b border-white/5 align-top transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-5 sm:px-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(comment.id)}
                          className="h-4 w-4 rounded border-white/20 bg-[#07090f]"
                        />
                      </td>

                      <td className="px-6 py-5 sm:px-8">
                        <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
                          {isReply ? (
                            <Reply className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          {isReply ? "Reply" : "Kommentar"}
                        </span>
                      </td>

                      <td className="px-6 py-5 sm:px-8">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
                            <User className="h-4 w-4 text-blue-300" />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {getAuthorLabel(comment)}
                            </div>
                            <div className="text-sm text-white/45">
                              {comment.user.email || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 sm:px-8">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
                            <Package className="h-4 w-4 text-blue-300" />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {getReleaseLabel(comment)}
                            </div>
                            <div className="text-sm text-white/45">
                              /releases/{comment.release.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 sm:px-8">
                        <div className="space-y-2">
                          <p className="max-w-xl text-sm leading-6 text-white/75">
                            {truncate(comment.content, 180)}
                          </p>

                          {comment.parent ? (
                            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-xs text-white/50">
                              <span className="text-white/65">Antwort auf:</span>{" "}
                              {truncate(comment.parent.content, 100)}
                            </div>
                          ) : null}

                          {!isReply && comment._count.replies > 0 ? (
                            <div className="text-xs text-white/45">
                              {comment._count.replies} Replies
                            </div>
                          ) : null}

                          <div className="text-xs text-white/35">
                            {new Date(comment.createdAt).toLocaleString("de-DE")}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 sm:px-8">
                        <button
                          type="button"
                          onClick={() => setSingleDeleteId(comment.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                        >
                          <Trash2 className="h-4 w-4" />
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="text-sm text-white/55">
            Seite <span className="font-semibold text-white">{currentPage}</span> von{" "}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-3">
            {prevHref ? (
              <Link
                href={prevHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/30">
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </span>
            )}

            {nextHref ? (
              <Link
                href={nextHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Weiter
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/30">
                Weiter
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </section>

      {singleDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b0f17] p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">
                  Kommentar löschen?
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Möchtest du diesen Kommentar wirklich löschen? Diese Aktion kann
                  nicht rückgängig gemacht werden.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeSingleDeleteModal}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06]"
              >
                Abbrechen
              </button>

              <form action={`/api/admin/comments/${singleDeleteId}`} method="POST">
                <input type="hidden" name="_method" value="DELETE" />
                <button
                  type="submit"
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                >
                  Ja, löschen
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0b0f17] p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">
                  Ausgewählte Kommentare löschen?
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Möchtest du wirklich{" "}
                  <span className="font-semibold text-white">{selectedCount}</span>{" "}
                  ausgewählte Kommentare löschen? Diese Aktion kann nicht
                  rückgängig gemacht werden.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeBulkDeleteModal}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06]"
              >
                Abbrechen
              </button>

              <form action="/api/admin/comments/bulk-delete" method="POST">
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="ids" value={id} />
                ))}
                <button
                  type="submit"
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                >
                  Ja, Auswahl löschen
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}