import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SearchParams = Promise<{
  page?: string;
  status?: string;
  filter?: string;
  releaseId?: string;
  error?: string;
}>;

type ReleaseOption = {
  id: string;
  slug: string;
  title: string;
};

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED";

function parsePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function normalizeStatusFilter(value?: string): CommentStatus | "ALL" {
  if (value === "APPROVED" || value === "PENDING" || value === "REJECTED") {
    return value;
  }
  return "ALL";
}

function getStatusMessage(status?: string) {
  switch (status) {
    case "approved":
      return "Kommentar erfolgreich freigegeben.";
    case "rejected":
      return "Kommentar erfolgreich abgelehnt.";
    case "deleted":
      return "Kommentar erfolgreich gelöscht.";
    default:
      return null;
  }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "not_found":
      return "Kommentar wurde nicht gefunden.";
    case "update_failed":
      return "Status konnte nicht geändert werden.";
    case "delete_failed":
      return "Kommentar konnte nicht gelöscht werden.";
    default:
      return null;
  }
}

function getReleaseLabel(release: ReleaseOption) {
  const title = release.title?.trim() || "Ohne Titel";
  const slug = release.slug?.trim() || "kein-slug";
  return `${title} (${slug})`;
}

function buildCommentsHref({
  page,
  filter,
  releaseId,
}: {
  page: number;
  filter: CommentStatus | "ALL";
  releaseId?: string;
}) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  if (filter !== "ALL") {
    params.set("filter", filter);
  }

  if (releaseId && releaseId !== "all") {
    params.set("releaseId", releaseId);
  }

  return `/dashboard/comments?${params.toString()}`;
}

function Pagination({
  currentPage,
  totalPages,
  filter,
  releaseId,
}: {
  currentPage: number;
  totalPages: number;
  filter: CommentStatus | "ALL";
  releaseId?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm text-white/60">
        Seite <span className="font-semibold text-white">{currentPage}</span> von{" "}
        <span className="font-semibold text-white">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={buildCommentsHref({
            page: Math.max(1, currentPage - 1),
            filter,
            releaseId,
          })}
          aria-disabled={currentPage <= 1}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage <= 1
              ? "pointer-events-none border-white/10 bg-white/[0.03] text-white/30"
              : "border-white/10 bg-[#07090f] text-white hover:border-blue-400/40 hover:bg-blue-500/10"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </Link>

        <Link
          href={buildCommentsHref({
            page: Math.min(totalPages, currentPage + 1),
            filter,
            releaseId,
          })}
          aria-disabled={currentPage >= totalPages}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage >= totalPages
              ? "pointer-events-none border-white/10 bg-white/[0.03] text-white/30"
              : "border-white/10 bg-[#07090f] text-white hover:border-blue-400/40 hover:bg-blue-500/10"
          }`}
        >
          Weiter
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

async function requireAdminUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return session.user;
}

async function approveCommentAction(formData: FormData) {
  "use server";

  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/dashboard/comments?error=not_found");
  }

  try {
    await prisma.comment.update({
      where: { id },
      data: {
        status: "APPROVED",
      },
    });

    revalidatePath("/dashboard/comments");
    revalidatePath("/releases");
  } catch (error) {
    console.error("APPROVE COMMENT ERROR:", error);
    redirect("/dashboard/comments?error=update_failed");
  }

  redirect("/dashboard/comments?status=approved");
}

async function rejectCommentAction(formData: FormData) {
  "use server";

  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/dashboard/comments?error=not_found");
  }

  try {
    await prisma.comment.update({
      where: { id },
      data: {
        status: "REJECTED",
      },
    });

    revalidatePath("/dashboard/comments");
    revalidatePath("/releases");
  } catch (error) {
    console.error("REJECT COMMENT ERROR:", error);
    redirect("/dashboard/comments?error=update_failed");
  }

  redirect("/dashboard/comments?status=rejected");
}

async function deleteCommentAction(formData: FormData) {
  "use server";

  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/dashboard/comments?error=not_found");
  }

  try {
    await prisma.comment.delete({
      where: { id },
    });

    revalidatePath("/dashboard/comments");
    revalidatePath("/releases");
  } catch (error) {
    console.error("DELETE COMMENT ERROR:", error);
    redirect("/dashboard/comments?error=delete_failed");
  }

  redirect("/dashboard/comments?status=deleted");
}

export default async function AdminCommentsPage(props: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const searchParams = await props.searchParams;
  const currentPage = parsePage(searchParams.page);
  const filter = normalizeStatusFilter(searchParams.filter);
  const releaseId = searchParams.releaseId?.trim() || "all";

  const releases: ReleaseOption[] = await prisma.release.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const where = {
    ...(filter !== "ALL" ? { status: filter } : {}),
    ...(releaseId !== "all" ? { releaseId } : {}),
  };

  const totalCount = await prisma.comment.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const comments = await prisma.comment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip,
    take: PAGE_SIZE,
    include: {
      author: {
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

  const pendingCount = await prisma.comment.count({
    where: { status: "PENDING" },
  });

  const approvedCount = await prisma.comment.count({
    where: { status: "APPROVED" },
  });

  const rejectedCount = await prisma.comment.count({
    where: { status: "REJECTED" },
  });

  const statusMessage = getStatusMessage(searchParams.status);
  const errorMessage = getErrorMessage(searchParams.error);

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
                Prüfe neue Kommentare, filtere nach Release oder Status und
                moderiere Inhalte zentral im Admin-Bereich.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white/60">
            {totalCount} Treffer
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Gesamt
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {pendingCount + approvedCount + rejectedCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Alle Kommentare</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Pending
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {pendingCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Warten auf Prüfung</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Approved
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {approvedCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Freigegeben</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Rejected
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {rejectedCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Abgelehnt</div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <Eye className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/50">Filter</div>
            <h2 className="text-2xl font-semibold text-white">
              Kommentare filtern
            </h2>
          </div>
        </div>

        <form method="GET" className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              Status
            </label>
            <select
              name="filter"
              defaultValue={filter}
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
            >
              <option value="ALL">Alle</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              Release
            </label>
            <select
              name="releaseId"
              defaultValue={releaseId}
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
            >
              <option value="all">Alle Releases</option>
              {releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {getReleaseLabel(release)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
            >
              <MessageSquare className="h-4 w-4 text-blue-300" />
              <span>Filter anwenden</span>
            </button>

            <Link
              href="/dashboard/comments"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07090f] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              Zurücksetzen
            </Link>
          </div>
        </form>
      </section>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        filter={filter}
        releaseId={releaseId}
      />

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/40">
              Moderation
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Kommentare
            </h2>
          </div>

          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/55 md:block">
            Seite {safePage} / {totalPages}
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8 text-white/55">
            Keine Kommentare für diesen Filter gefunden.
          </div>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => {
              const authorName =
                comment.author?.username ||
                comment.author?.name ||
                comment.author?.email ||
                "Unbekannt";

              return (
                <article
                  key={comment.id}
                  className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#07090f] px-3 py-1 text-xs font-medium text-white/75">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-300" />
                          Kommentar
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            comment.status === "APPROVED"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : comment.status === "REJECTED"
                                ? "border-red-500/20 bg-red-500/10 text-red-300"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {comment.status}
                        </span>

                        {comment.release ? (
                          <Link
                            href={`/releases/${comment.release.slug}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#07090f] px-3 py-1 text-xs font-medium text-white/70 transition hover:border-blue-400/40 hover:text-white"
                          >
                            Release: {comment.release.title || comment.release.slug}
                          </Link>
                        ) : null}
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-5">
                        <div className="text-sm font-medium text-white/50">
                          Inhalt
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/80">
                          {comment.content}
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-[#07090f] p-4 text-sm">
                          <div className="text-white/45">Autor</div>
                          <div className="mt-2 font-medium text-white">
                            {authorName}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#07090f] p-4 text-sm">
                          <div className="text-white/45">E-Mail</div>
                          <div className="mt-2 break-all font-medium text-white">
                            {comment.author?.email || "—"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#07090f] p-4 text-sm">
                          <div className="text-white/45">Erstellt</div>
                          <div className="mt-2 font-medium text-white">
                            {new Intl.DateTimeFormat("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(comment.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-[220px]">
                      <form action={approveCommentAction}>
                        <input type="hidden" name="id" value={comment.id} />
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/30 hover:bg-emerald-500/15"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Freigeben</span>
                        </button>
                      </form>

                      <form action={rejectCommentAction}>
                        <input type="hidden" name="id" value={comment.id} />
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400/30 hover:bg-amber-500/15"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Ablehnen</span>
                        </button>
                      </form>

                      <form action={deleteCommentAction}>
                        <input type="hidden" name="id" value={comment.id} />
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Löschen</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        filter={filter}
        releaseId={releaseId}
      />
    </div>
  );
}