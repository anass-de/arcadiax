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
  Shield,
  Trash2,
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
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
  } | null;
  release: {
    id: string;
    title: string;
    slug: string | null;
  } | null;
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getCommentAuthor(comment: CommentItem) {
  return (
    comment.user?.username ||
    comment.user?.name ||
    comment.user?.email ||
    "Unbekannt"
  );
}

function getReleaseHref(release: { id: string; slug: string | null }) {
  return release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;
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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Kommentar Moderation
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Kommentare verwalten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Verwalte alle Release-Kommentare, filtere nach Release und
                entferne problematische Einträge direkt aus dem Admin-Bereich.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            {total} Kommentar{total === 1 ? "" : "e"} insgesamt
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Gesamt
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{total}</div>
          <div className="mt-2 text-sm text-zinc-400">
            Alle Kommentare im System
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Seite
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{page}</div>
          <div className="mt-2 text-sm text-zinc-400">
            Von insgesamt {totalPages} Seiten
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Filter
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {releaseId
              ? releases.find((release) => release.id === releaseId)?.title ||
                "Release Filter aktiv"
              : "Alle Releases"}
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            Aktuelle Kommentar-Auswahl
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
              Kommentare eingrenzen
            </h2>
          </div>
        </div>

        <form method="GET" className="grid gap-4 md:grid-cols-[1fr_auto]">
          <select
            name="releaseId"
            defaultValue={releaseId ?? ""}
            className="rounded-2xl border border-white/10 bg-black/20 p-3 text-white outline-none transition focus:border-cyan-400/40 focus:bg-zinc-900"
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Filter className="h-4 w-4" />
            Filtern
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {comments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
              <MessageSquare className="h-6 w-6 text-cyan-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              Keine Kommentare gefunden
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Für die aktuelle Auswahl sind keine Kommentare vorhanden.
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const author = getCommentAuthor(comment);

            return (
              <article
                key={comment.id}
                className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {author}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {comment.user?.email || "Keine E-Mail verfügbar"}
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    {formatDate(comment.createdAt)}
                  </div>
                </div>

                {comment.release && (
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Release: {comment.release.title}
                  </div>
                )}

                <div className="mb-5 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-zinc-200">
                  {comment.content}
                </div>

                <div className="flex flex-wrap gap-3">
                  {comment.release && (
                    <Link
                      href={getReleaseHref(comment.release)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Release ansehen
                    </Link>
                  )}

                  <form action={deleteComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-4 w-4" />
                      Löschen
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-500">
          Seite {page} von {totalPages}
        </div>

        <div className="flex gap-3">
          {page > 1 && (
            <Link
              href={buildPageHref(page - 1, releaseId)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Link>
          )}

          {page < totalPages && (
            <Link
              href={buildPageHref(page + 1, releaseId)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Weiter
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}