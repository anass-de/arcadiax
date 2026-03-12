import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Filter, Shield } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import CommentsTable from "@/components/dashboard/comments/comments-table";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  release?: string;
  page?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

const PAGE_SIZE = 20;

function getReleaseLabel(release?: {
  title?: string | null;
  version?: string | null;
} | null) {
  if (!release?.title) return "Unbekanntes Release";
  if (release.version?.trim()) return `${release.title} (${release.version})`;
  return release.title;
}

function buildCommentsUrl(params: {
  q?: string;
  type?: string;
  release?: string;
  page?: number | string;
}) {
  const search = new URLSearchParams();

  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.type?.trim() && params.type !== "all") {
    search.set("type", params.type);
  }
  if (params.release?.trim() && params.release !== "all") {
    search.set("release", params.release);
  }
  if (String(params.page) !== "1") {
    search.set("page", String(params.page));
  }

  const qs = search.toString();
  return qs ? `/dashboard/comments?${qs}` : "/dashboard/comments";
}

export default async function DashboardCommentsPage({
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;

  const q = params.q?.trim() || "";
  const type = params.type?.trim() || "all";
  const releaseFilter = params.release?.trim() || "all";

  const rawPage = Number(params.page || "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const where: {
    content?: { contains: string; mode: "insensitive" };
    parentId?: string | null | { not: null };
    releaseId?: string;
  } = {};

  if (q) {
    where.content = {
      contains: q,
      mode: "insensitive",
    };
  }

  if (type === "top") {
    where.parentId = null;
  } else if (type === "reply") {
    where.parentId = { not: null };
  }

  if (releaseFilter !== "all") {
    where.releaseId = releaseFilter;
  }

  const filteredCount = await prisma.comment.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const skip = (safeCurrentPage - 1) * PAGE_SIZE;

  const [releases, comments, totalComments, totalTopLevel, totalReplies] =
    await Promise.all([
      prisma.release.findMany({
        orderBy: [{ title: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          version: true,
        },
      }),
      prisma.comment.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: PAGE_SIZE,
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
      }),
      prisma.comment.count(),
      prisma.comment.count({
        where: {
          parentId: null,
        },
      }),
      prisma.comment.count({
        where: {
          parentId: { not: null },
        },
      }),
    ]);

  const prevHref =
    safeCurrentPage > 1
      ? buildCommentsUrl({
          q,
          type,
          release: releaseFilter,
          page: safeCurrentPage - 1,
        })
      : null;

  const nextHref =
    safeCurrentPage < totalPages
      ? buildCommentsUrl({
          q,
          type,
          release: releaseFilter,
          page: safeCurrentPage + 1,
        })
      : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Shield className="h-4 w-4" />
              Kommentar Moderation
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Kommentare verwalten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Prüfe Kommentare, filtere nach Typ und Release und entferne
                problematische Inhalte direkt aus dem Admin-Bereich.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                Gesamt
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {totalComments}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                Top-Level
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {totalTopLevel}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                Replies
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {totalReplies}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <Filter className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/50">Filter</div>
            <h2 className="text-2xl font-semibold text-white">
              Suche und Auswahl
            </h2>
          </div>
        </div>

        <form className="grid gap-4 lg:grid-cols-[1.2fr_0.6fr_0.8fr_auto] lg:items-end">
          <div>
            <label
              htmlFor="q"
              className="mb-2 block text-sm font-medium text-white/70"
            >
              Suche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Nach Kommentarinhalt suchen..."
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
            />
          </div>

          <div>
            <label
              htmlFor="type"
              className="mb-2 block text-sm font-medium text-white/70"
            >
              Typ
            </label>
            <select
              id="type"
              name="type"
              defaultValue={type}
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/30"
            >
              <option value="all">Alle</option>
              <option value="top">Nur Kommentare</option>
              <option value="reply">Nur Replies</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="release"
              className="mb-2 block text-sm font-medium text-white/70"
            >
              Release
            </label>
            <select
              id="release"
              name="release"
              defaultValue={releaseFilter}
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/30"
            >
              <option value="all">Alle Releases</option>
              {releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {getReleaseLabel(release)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
            >
              Anwenden
            </button>

            <a
              href="/dashboard/comments"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              Reset
            </a>
          </div>
        </form>
      </section>

      <CommentsTable
        comments={comments.map((comment) => ({
          ...comment,
          createdAt: comment.createdAt.toISOString(),
        }))}
        filteredCount={filteredCount}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </div>
  );
}