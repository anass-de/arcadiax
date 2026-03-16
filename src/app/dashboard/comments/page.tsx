import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Filter,
  MessageSquare,
  Reply,
  Shield,
  Trash2,
  User,
  Package,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SessionUser = {
  role?: "USER" | "ADMIN" | null;
};

type ReleaseOption = {
  id: string;
  slug: string | null;
  title: string;
};

type CommentItem = {
  id: string;
  content: string;
  createdAt: Date;
  parentId: string | null;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
  } | null;
  release: {
    id: string;
    title: string;
    version: string | null;
    slug: string | null;
  } | null;
  parent: {
    id: string;
    content: string;
  } | null;
  _count: {
    replies: number;
  };
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role ?? null;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/comments");
  }

  if (role !== "ADMIN") {
    redirect("/");
  }

  return session.user;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getAuthorLabel(comment: CommentItem) {
  return (
    comment.user?.username ||
    comment.user?.name ||
    comment.user?.email ||
    "Unknown user"
  );
}

function getReleaseLabel(comment: CommentItem) {
  if (!comment.release) return "Unknown release";

  if (comment.release.version?.trim()) {
    return `${comment.release.title} (${comment.release.version})`;
  }

  return comment.release.title;
}

function getReleaseHref(release: {
  id: string;
  slug: string | null;
}) {
  return release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;
}

function truncate(text: string, max = 180) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

async function deleteComment(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role ?? null;

  if (!session?.user || role !== "ADMIN") {
    redirect("/");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return;
  }

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      parentId: true,
      release: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!existing) {
    return;
  }

  if (existing.parentId === null) {
    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: {
          parentId: id,
        },
      }),
      prisma.comment.delete({
        where: { id },
      }),
    ]);
  } else {
    await prisma.comment.delete({
      where: { id },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/comments");
  revalidatePath("/releases");

  if (existing.release) {
    revalidatePath(
      existing.release.slug?.trim()
        ? `/releases/${existing.release.slug}`
        : `/releases/${existing.release.id}`
    );
  }
}

function buildPageHref(page: number, releaseId?: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  if (releaseId) {
    params.set("releaseId", releaseId);
  }

  return `/dashboard/comments?${params.toString()}`;
}

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    releaseId?: string;
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;

  const rawPage = Number(params.page ?? "1");
  const requestedPage =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const releaseId = params.releaseId?.trim() || undefined;

  const where = {
    ...(releaseId ? { releaseId } : {}),
  };

  const releases: ReleaseOption[] = await prisma.release.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.comment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const comments: CommentItem[] = await prisma.comment.findMany({
    where,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          image: true,
        },
      },
      release: {
        select: {
          id: true,
          title: true,
          version: true,
          slug: true,
        },
      },
      parent: {
        select: {
          id: true,
          content: true,
        },
      },
      _count: {
        select: {
          replies: true,
        },
      },
    },
  });

  const activeFilterLabel = releaseId
    ? releases.find((release) => release.id === releaseId)?.title ||
      "Filtered release"
    : "All releases";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(108,92,231,0.14),rgba(0,210,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-xl shadow-black/20 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Comment Moderation
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Manage Comments
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300/80 sm:text-base">
                Moderate community discussions, review replies, and remove
                problematic comments from one central ArcadiaX admin workspace.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-200">
            {total} comment{total === 1 ? "" : "s"} total
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Total
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{total}</div>
          <div className="mt-2 text-sm text-zinc-400">
            All comments currently stored
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Page
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{page}</div>
          <div className="mt-2 text-sm text-zinc-400">
            Out of {totalPages} pages
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Active Filter
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {activeFilterLabel}
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            Current moderation scope
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <Filter className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-500">Filter</div>
            <h2 className="text-2xl font-semibold text-white">
              Narrow Comments
            </h2>
          </div>
        </div>

        <form method="GET" className="grid gap-4 md:grid-cols-[1fr_auto]">
          <select
            name="releaseId"
            defaultValue={releaseId ?? ""}
            className="rounded-2xl border border-white/10 bg-black/20 p-3 text-white outline-none transition focus:border-cyan-400/40 focus:bg-zinc-900"
          >
            <option value="">All releases</option>

            {releases.map((release) => (
              <option key={release.id} value={release.id}>
                {release.title}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Filter className="h-4 w-4" />
            Apply Filter
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {comments.length === 0 ? (
          <div className="rounded-[30px] border border-white/10 bg-zinc-950/70 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
              <MessageSquare className="h-7 w-7 text-cyan-300" />
            </div>

            <h3 className="mt-5 text-xl font-semibold text-white">
              No comments found
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              There are no comments matching the current filter.
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isReply = Boolean(comment.parentId);
            const author = getAuthorLabel(comment);

            return (
              <article
                key={comment.id}
                className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              >
                <div className="border-b border-white/10 px-6 py-5 sm:px-8">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25">
                        <User className="h-5 w-5 text-[#a899ff]" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">
                            {author}
                          </h3>

                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                              isReply
                                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                                : "border-[#6c5ce7]/25 bg-[#6c5ce7]/10 text-[#c0b7ff]"
                            }`}
                          >
                            {isReply ? (
                              <Reply className="h-3.5 w-3.5" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5" />
                            )}
                            {isReply ? "Reply" : "Comment"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-zinc-500">
                          {comment.user?.email || "No email available"}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {formatDate(comment.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-4">
                      {comment.release ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-300">
                          <Package className="h-3.5 w-3.5" />
                          Release: {getReleaseLabel(comment)}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                          {comment.content}
                        </p>
                      </div>

                      {comment.parent ? (
                        <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.05] p-4 text-sm leading-6 text-zinc-300">
                          <span className="font-semibold text-cyan-300">
                            Replying to:
                          </span>{" "}
                          {truncate(comment.parent.content, 120)}
                        </div>
                      ) : null}

                      {!isReply && comment._count.replies > 0 ? (
                        <div className="text-sm text-zinc-400">
                          {comment._count.replies} repl
                          {comment._count.replies === 1 ? "y" : "ies"}
                        </div>
                      ) : null}
                    </div>

                    <aside className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <div className="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Actions
                      </div>

                      <div className="flex flex-col gap-3">
                        {comment.release ? (
                          <Link
                            href={getReleaseHref(comment.release)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View release
                          </Link>
                        ) : null}

                        <form action={deleteComment}>
                          <input type="hidden" name="id" value={comment.id} />
                          <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete comment
                          </button>
                        </form>
                      </div>
                    </aside>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-500">
          Page <span className="font-semibold text-white">{page}</span> of{" "}
          <span className="font-semibold text-white">{totalPages}</span>
        </div>

        <div className="flex gap-3">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1, releaseId)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-500">
              <ArrowLeft className="h-4 w-4" />
              Previous
            </span>
          )}

          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1, releaseId)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-500">
              Next
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </section>
    </div>
  );
}