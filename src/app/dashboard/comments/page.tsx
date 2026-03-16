import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Filter, Shield } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CommentsTable from "@/components/dashboard/comments/comments-table";

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

  await prisma.comment.delete({
    where: { id },
  });

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

  const comments = await prisma.comment.findMany({
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

  const normalizedComments = comments
    .filter((comment) => comment.release)
    .map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      parentId: comment.parentId,
      user: {
        id: comment.user?.id ?? "",
        name: comment.user?.name ?? null,
        username: comment.user?.username ?? null,
        email: comment.user?.email ?? null,
        image: comment.user?.image ?? null,
      },
      release: {
        id: comment.release!.id,
        title: comment.release!.title,
        version: comment.release!.version ?? null,
        slug: comment.release!.slug?.trim() || comment.release!.id,
      },
      parent: comment.parent
        ? {
            id: comment.parent.id,
            content: comment.parent.content,
          }
        : null,
      _count: {
        replies: comment._count.replies,
      },
    }));

  const prevHref = page > 1 ? buildPageHref(page - 1, releaseId) : null;
  const nextHref = page < totalPages ? buildPageHref(page + 1, releaseId) : null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
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
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Moderate community discussions, filter comments by release, and
                remove problematic entries from one central ArcadiaX admin area.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            {total} comment{total === 1 ? "" : "s"} total
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Total
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{total}</div>
          <div className="mt-2 text-sm text-zinc-400">
            All comments in the system
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Page
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{page}</div>
          <div className="mt-2 text-sm text-zinc-400">
            Out of {totalPages} pages
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Filter
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {releaseId
              ? releases.find((release) => release.id === releaseId)?.title ||
                "Filtered release"
              : "All releases"}
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            Current moderation selection
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
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

      <CommentsTable
        comments={normalizedComments}
        filteredCount={total}
        currentPage={page}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </div>
  );
}