"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Package,
  Reply,
  Trash2,
  User,
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
    "Unknown user"
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(108,92,231,0.08),rgba(255,255,255,0.02))] shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
        <div className="border-b border-white/10 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                <MessageSquare className="h-3.5 w-3.5" />
                Comment moderation
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Community Comments
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                Review, manage, and remove release comments in a clean ArcadiaX
                moderation workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                  Results
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {filteredCount}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                  Selected
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {selectedCount}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={selectedCount === 0}
                className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                  selectedCount === 0
                    ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/30"
                    : "border-red-500/25 bg-red-500/10 text-red-200 hover:border-red-400/40 hover:bg-red-500/15"
                }`}
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </button>
            </div>
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="px-6 py-12 sm:px-8">
            <div className="rounded-[28px] border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <MessageSquare className="h-6 w-6 text-white/40" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                No comments found
              </h3>
              <p className="mt-2 text-sm text-white/55">
                There are no comments matching the current filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-left text-[11px] uppercase tracking-[0.24em] text-white/35">
                  <th className="px-6 py-4 sm:px-8">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 rounded border-white/20 bg-[#07090f]"
                      />
                      <span>Select</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 sm:px-8">Type</th>
                  <th className="px-6 py-4 sm:px-8">Author</th>
                  <th className="px-6 py-4 sm:px-8">Release</th>
                  <th className="px-6 py-4 sm:px-8">Comment</th>
                  <th className="px-6 py-4 sm:px-8">Actions</th>
                </tr>
              </thead>

              <tbody>
                {comments.map((comment) => {
                  const isReply = !!comment.parentId;
                  const isSelected = selectedIds.includes(comment.id);

                  return (
                    <tr
                      key={comment.id}
                      className="border-b border-white/5 align-top transition hover:bg-white/[0.025]"
                    >
                      <td className="px-6 py-6 sm:px-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(comment.id)}
                          className="h-4 w-4 rounded border-white/20 bg-[#07090f]"
                        />
                      </td>

                      <td className="px-6 py-6 sm:px-8">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                            isReply
                              ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                              : "border-[#6c5ce7]/25 bg-[#6c5ce7]/10 text-[#b7abff]"
                          }`}
                        >
                          {isReply ? (
                            <Reply className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          {isReply ? "Reply" : "Comment"}
                        </span>
                      </td>

                      <td className="px-6 py-6 sm:px-8">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
                            <User className="h-4 w-4 text-[#9f8cff]" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white">
                              {getAuthorLabel(comment)}
                            </div>
                            <div className="mt-1 text-sm text-white/45">
                              {comment.user.email || "No email provided"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-6 sm:px-8">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
                            <Package className="h-4 w-4 text-cyan-300" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white">
                              {getReleaseLabel(comment)}
                            </div>
                            <div className="mt-1 text-sm text-white/45">
                              /releases/{comment.release.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-6 sm:px-8">
                        <div className="max-w-xl space-y-3">
                          <p className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4 text-sm leading-7 text-white/80">
                            {truncate(comment.content, 180)}
                          </p>

                          {comment.parent ? (
                            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.05] px-4 py-3 text-xs leading-6 text-white/55">
                              <span className="font-semibold text-cyan-300">
                                Replying to:
                              </span>{" "}
                              {truncate(comment.parent.content, 100)}
                            </div>
                          ) : null}

                          {!isReply && comment._count.replies > 0 ? (
                            <div className="text-xs font-medium text-white/45">
                              {comment._count.replies} repl
                              {comment._count.replies === 1 ? "y" : "ies"}
                            </div>
                          ) : null}

                          <div className="text-xs uppercase tracking-[0.18em] text-white/30">
                            {formatDate(comment.createdAt)}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-6 sm:px-8">
                        <div className="flex flex-col gap-3">
                          <Link
                            href={`/releases/${comment.release.slug}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                          >
                            View release
                          </Link>

                          <button
                            type="button"
                            onClick={() => setSingleDeleteId(comment.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
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

        <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="text-sm text-white/55">
            Page <span className="font-semibold text-white">{currentPage}</span> of{" "}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-3">
            {prevHref ? (
              <Link
                href={prevHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/30">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </span>
            )}

            {nextHref ? (
              <Link
                href={nextHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/30">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </section>

      {singleDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-[#0b0f17] p-6 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">
                  Delete this comment?
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  This action will permanently remove the selected comment and
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeSingleDeleteModal}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06]"
              >
                Cancel
              </button>

              <form action={`/api/admin/comments/${singleDeleteId}`} method="POST">
                <input type="hidden" name="_method" value="DELETE" />
                <button
                  type="submit"
                  className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15"
                >
                  Yes, delete
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-white/10 bg-[#0b0f17] p-6 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">
                  Delete selected comments?
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  You are about to permanently remove{" "}
                  <span className="font-semibold text-white">{selectedCount}</span>{" "}
                  selected comment{selectedCount === 1 ? "" : "s"}. This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeBulkDeleteModal}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06]"
              >
                Cancel
              </button>

              <form action="/api/admin/comments/bulk-delete" method="POST">
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="ids" value={id} />
                ))}
                <button
                  type="submit"
                  className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15"
                >
                  Yes, delete selected
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}