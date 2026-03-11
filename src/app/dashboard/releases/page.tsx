import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shorten(text: string, max = 100) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function getReleaseHref(release: {
  id: string;
  slug?: string | null;
}) {
  if (release.slug?.trim()) {
    return `/releases/${release.slug}`;
  }

  return `/releases/${release.id}`;
}

function getStatusClasses(status: string) {
  if (status === "PUBLISHED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/65";
}

export default async function DashboardReleasesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const releases = await prisma.release.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      version: true,
      description: true,
      fileUrl: true,
      imageUrl: true,
      downloadCount: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  const totalReleases = releases.length;
  const publishedReleases = releases.filter(
    (release) => release.status === "PUBLISHED"
  ).length;
  const draftReleases = releases.filter(
    (release) => release.status === "DRAFT"
  ).length;
  const totalDownloads = releases.reduce(
    (sum, release) => sum + (release.downloadCount ?? 0),
    0
  );

  async function toggleStatusAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      redirect("/");
    }

    const releaseId = String(formData.get("releaseId") || "").trim();

    if (!releaseId) {
      return;
    }

    const existing = await prisma.release.findUnique({
      where: {
        id: releaseId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      return;
    }

    await prisma.release.update({
      where: {
        id: releaseId,
      },
      data: {
        status: existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
      },
    });

    revalidatePath("/dashboard/releases");
    revalidatePath("/dashboard");
    revalidatePath("/releases");
  }

  async function deleteReleaseAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      redirect("/");
    }

    const releaseId = String(formData.get("releaseId") || "").trim();

    if (!releaseId) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({
        where: {
          releaseId,
        },
      });

      await tx.releaseLike.deleteMany({
        where: {
          releaseId,
        },
      });

      await tx.download.deleteMany({
        where: {
          releaseId,
        },
      });

      await tx.release.delete({
        where: {
          id: releaseId,
        },
      });
    });

    revalidatePath("/dashboard/releases");
    revalidatePath("/dashboard");
    revalidatePath("/releases");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Shield className="h-4 w-4" />
              Release Verwaltung
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Releases verwalten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Verwalte alle Versionen, ändere den Veröffentlichungsstatus,
                bearbeite bestehende Releases und entferne veraltete Einträge
                direkt aus dem Admin-Bereich.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/releases/new"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
            >
              <Plus className="h-4 w-4 text-blue-300" />
              <span>Neues Release</span>
            </Link>

            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Öffentliche Releases</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Gesamt
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {totalReleases}
          </div>
          <div className="mt-2 text-sm text-white/50">Alle Releases im System</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Published
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {publishedReleases}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Öffentlich sichtbare Releases
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Drafts
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {draftReleases}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Noch nicht veröffentlichte Versionen
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Downloads
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {totalDownloads}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Gesamte Release-Downloads
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
          <div>
            <div className="text-sm font-medium text-white/50">Übersicht</div>
            <h2 className="text-2xl font-semibold text-white">
              Release-Tabelle
            </h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-2 text-sm text-white/60">
            {releases.length} Einträge
          </div>
        </div>

        {releases.length === 0 ? (
          <div className="px-6 py-10 sm:px-8">
            <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-6">
              <div className="text-sm font-semibold text-white">
                Noch keine Releases vorhanden
              </div>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Erstelle dein erstes Release, um Versionen, Downloads und
                Kommentare zentral zu verwalten.
              </p>

              <div className="mt-5">
                <Link
                  href="/dashboard/releases/new"
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
                >
                  <Plus className="h-4 w-4 text-blue-300" />
                  <span>Neues Release erstellen</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-[#07090f]/80 text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40 sm:px-8">
                    Release
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Downloads
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Kommentare
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Erstellt
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Aktualisiert
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-white/40 sm:px-8">
                    Aktionen
                  </th>
                </tr>
              </thead>

              <tbody>
                {releases.map((release) => {
                  const releaseHref = getReleaseHref(release);

                  return (
                    <tr
                      key={release.id}
                      className="border-b border-white/10 align-top transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-5 sm:px-8">
                        <div className="min-w-[260px] max-w-[380px]">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#07090f] text-white">
                              <FileText className="h-4 w-4 text-blue-300" />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-white">
                                {release.title}
                              </div>

                              <div className="mt-1 text-sm text-white/45">
                                Version {release.version}
                              </div>

                              {release.slug ? (
                                <div className="mt-1 truncate text-xs text-white/35">
                                  /releases/{release.slug}
                                </div>
                              ) : null}

                              {release.description ? (
                                <div className="mt-3 text-sm leading-6 text-white/60">
                                  {shorten(release.description, 120)}
                                </div>
                              ) : (
                                <div className="mt-3 text-sm text-white/35">
                                  Keine Beschreibung vorhanden
                                </div>
                              )}

                              <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                  href={releaseHref}
                                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>Ansehen</span>
                                </Link>

                                {release.fileUrl ? (
                                  <a
                                    href={release.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>Datei</span>
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="min-w-[160px] space-y-3">
                          <div
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${getStatusClasses(
                              release.status
                            )}`}
                          >
                            {release.status}
                          </div>

                          <form action={toggleStatusAction}>
                            <input
                              type="hidden"
                              name="releaseId"
                              value={release.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:border-blue-400/30 hover:bg-blue-500/15"
                            >
                              {release.status === "PUBLISHED"
                                ? "Zu Draft wechseln"
                                : "Veröffentlichen"}
                            </button>
                          </form>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="min-w-[120px]">
                          <div className="flex items-center gap-2 text-white/45">
                            <Download className="h-4 w-4 text-blue-300" />
                            <span className="text-xs uppercase tracking-[0.14em]">
                              Downloads
                            </span>
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {release.downloadCount ?? 0}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="min-w-[120px]">
                          <div className="flex items-center gap-2 text-white/45">
                            <MessageSquare className="h-4 w-4 text-blue-300" />
                            <span className="text-xs uppercase tracking-[0.14em]">
                              Kommentare
                            </span>
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {release._count.comments}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="min-w-[145px] text-sm text-white/60">
                          {formatDateTime(release.createdAt)}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="min-w-[145px] text-sm text-white/60">
                          {formatDateTime(release.updatedAt)}
                        </div>
                      </td>

                      <td className="px-6 py-5 text-right sm:px-8">
                        <div className="flex min-w-[220px] justify-end gap-2">
                          <Link
                            href={`/dashboard/releases/${release.id}/edit`}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Bearbeiten</span>
                          </Link>

                          <form action={deleteReleaseAction}>
                            <input
                              type="hidden"
                              name="releaseId"
                              value={release.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Löschen</span>
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}