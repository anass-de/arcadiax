// src/app/dashboard/comments/page.tsx

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type ReleaseOption = {
  id: string;
  slug: string;
  title: string;
};

type CommentItem = {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
  } | null;
  release: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return session.user;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function deleteComment(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return;
  }

  await prisma.comment.delete({
    where: { id },
  });

  revalidatePath("/dashboard/comments");
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
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
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
        },
      },
      release: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Kommentare</h1>
        <p className="text-white/60">Verwaltung aller Release-Kommentare</p>
      </div>

      <form method="GET" className="grid gap-4 md:grid-cols-[1fr_auto]">
        <select
          name="releaseId"
          defaultValue={releaseId ?? ""}
          className="rounded-xl border border-white/10 bg-[#07090f] p-3 text-white"
        >
          <option value="">Alle Releases</option>

          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.title}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:bg-white/10"
        >
          Filtern
        </button>
      </form>

      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-white/60">
            Keine Kommentare gefunden.
          </div>
        ) : (
          comments.map((comment) => {
            const author =
              comment.user?.username ||
              comment.user?.name ||
              comment.user?.email ||
              "Unbekannt";

            return (
              <div
                key={comment.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="text-sm text-white/60">{author}</div>

                  <div className="text-xs text-white/40">
                    {formatDate(comment.createdAt)}
                  </div>
                </div>

                {comment.release && (
                  <div className="mb-3 text-xs text-cyan-300/80">
                    Release: {comment.release.title}
                  </div>
                )}

                <div className="mb-4 whitespace-pre-wrap text-white">
                  {comment.content}
                </div>

                <div className="flex flex-wrap gap-3">
                  {comment.release && (
                    <Link
                      href={`/releases/${comment.release.slug}`}
                      className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/5"
                    >
                      Release ansehen
                    </Link>
                  )}

                  <form action={deleteComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-4">
        {page > 1 && (
          <Link
            href={buildPageHref(page - 1, releaseId)}
            className="rounded-lg border border-white/20 px-4 py-2 text-white transition hover:bg-white/5"
          >
            Zurück
          </Link>
        )}

        {page < totalPages && (
          <Link
            href={buildPageHref(page + 1, releaseId)}
            className="rounded-lg border border-white/20 px-4 py-2 text-white transition hover:bg-white/5"
          >
            Weiter
          </Link>
        )}
      </div>
    </div>
  );
}