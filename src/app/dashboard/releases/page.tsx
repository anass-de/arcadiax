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

type SessionUser = {
  role?: "USER" | "ADMIN" | null;
};

type ReleaseStatus = "DRAFT" | "PUBLISHED";

type ReleaseRow = {
  id: string;
  title: string;
  slug: string | null;
  version: string;
  description: string | null;
  fileUrl: string | null;
  imageUrl: string | null;
  downloadCount: number;
  status: ReleaseStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    comments: number;
  };
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function shorten(text: string, max = 100) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function getReleaseHref(release: { id: string; slug?: string | null }) {
  if (release.slug?.trim()) {
    return `/releases/${release.slug}`;
  }

  return `/releases/${release.id}`;
}

function getStatusClasses(status: ReleaseStatus) {
  if (status === "PUBLISHED") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border border-zinc-700 bg-zinc-800/70 text-zinc-300";
}

function getStatusLabel(status: ReleaseStatus) {
  return status === "PUBLISHED" ? "Veröffentlicht" : "Entwurf";
}

function getStatCards(data: {
  totalReleases: number;
  publishedReleases: number;
  draftReleases: number;
  totalDownloads: number;
}) {
  return [
    {
      title: "Gesamt",
      value: data.totalReleases,
      hint: "Alle Releases im System",
    },
    {
      title: "Published",
      value: data.publishedReleases,
      hint: "Öffentlich sichtbare Releases",
    },
    {
      title: "Drafts",
      value: data.draftReleases,
      hint: "Noch nicht veröffentlichte Versionen",
    },
    {
      title: "Downloads",
      value: data.totalDownloads,
      hint: "Gesamte Release-Downloads",
    },
  ];
}

export default async function DashboardReleasesPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role ?? null;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/releases");
  }

  if (role !== "ADMIN") {
    redirect("/");
  }

  const releases: ReleaseRow[] = await prisma.release.findMany({
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

  const statCards = getStatCards({
    totalReleases,
    publishedReleases,
    draftReleases,
    totalDownloads,
  });

  async function toggleStatusAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    const role = (session?.user as SessionUser | undefined)?.role ?? null;

    if (!session?.user || role !== "ADMIN") {
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

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/releases");
    revalidatePath(`/dashboard/releases/${releaseId}/edit`);
    revalidatePath("/releases");
  }

  async function deleteReleaseAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    const role = (session?.user as SessionUser | undefined)?.role ?? null;

    if (!session?.user || role !== "ADMIN") {
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
        slug: true,
      },
    });

    if (!existing) {
      return;
    }

    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: {
          releaseId,
        },
      }),
      prisma.releaseLike.deleteMany({
        where: {
          releaseId,
        },
      }),
      prisma.download.deleteMany({
        where: {
          releaseId,
        },
      }),
      prisma.release.delete({
        where: {
          id: releaseId,
        },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/releases");
    revalidatePath("/releases");

    if (existing.slug?.trim()) {
      revalidatePath(`/releases/${existing.slug}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Release Verwaltung
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Releases verwalten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Verwalte alle Versionen, ändere den Veröffentlichungsstatus,
                bearbeite bestehende Releases und entferne veraltete Einträge
                direkt aus dem Admin-Bereich.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/releases/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              <span>Neues Release</span>
            </Link>

            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Öffentliche Releases</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              {card.title}
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {card.value}
            </div>
            <div className="mt-2 text-sm text-zinc-400">{card.hint}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
          <div>
            <div className="text-sm font-medium text-zinc-500">Übersicht</div>
            <h2 className="text-2xl font-semibold text-white">
              Release-Tabelle
            </h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-400">
            {releases.length} Einträge
          </div>
        </div>

        {releases.length === 0 ? (
          <div className="px-6 py-10 sm:px-8">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <div className="text-sm font-semibold text-white">
                Noch keine Releases vorhanden
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Erstelle dein erstes Release, um Versionen, Downloads und
                Kommentare zentral zu verwalten.
              </p>

              <div className="mt-5">
                <Link
                  href="/dashboard/releases/new"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  <span>Neues Release erstellen</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20 text-left">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:px-8">
                      Release
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Downloads
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Kommentare
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Erstellt
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Aktualisiert
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:px-8">
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
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white">
                                <FileText className="h-4 w-4 text-cyan-300" />
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-white">
                                  {release.title}
                                </div>

                                <div className="mt-1 text-sm text-zinc-400">
                                  Version {release.version}
                                </div>

                                {release.slug ? (
                                  <div className="mt-1 truncate text-xs text-zinc-500">
                                    /releases/{release.slug}
                                  </div>
                                ) : null}

                                {release.description ? (
                                  <div className="mt-3 text-sm leading-6 text-zinc-400">
                                    {shorten(release.description, 120)}
                                  </div>
                                ) : (
                                  <div className="mt-3 text-sm text-zinc-500">
                                    Keine Beschreibung vorhanden
                                  </div>
                                )}

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Link
                                    href={releaseHref}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>Ansehen</span>
                                  </Link>

                                  {release.fileUrl ? (
                                    <a
                                      href={release.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
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
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${getStatusClasses(
                                release.status
                              )}`}
                            >
                              {getStatusLabel(release.status)}
                            </div>

                            <form action={toggleStatusAction}>
                              <input
                                type="hidden"
                                name="releaseId"
                                value={release.id}
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/15"
                              >
                                {release.status === "PUBLISHED"
                                  ? "Zu Entwurf wechseln"
                                  : "Veröffentlichen"}
                              </button>
                            </form>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="min-w-[120px]">
                            <div className="flex items-center gap-2 text-zinc-500">
                              <Download className="h-4 w-4 text-cyan-300" />
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
                            <div className="flex items-center gap-2 text-zinc-500">
                              <MessageSquare className="h-4 w-4 text-cyan-300" />
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
                          <div className="min-w-[145px] text-sm text-zinc-400">
                            {formatDateTime(release.createdAt)}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="min-w-[145px] text-sm text-zinc-400">
                            {formatDateTime(release.updatedAt)}
                          </div>
                        </td>

                        <td className="px-6 py-5 text-right sm:px-8">
                          <div className="flex min-w-[220px] justify-end gap-2">
                            <Link
                              href={`/dashboard/releases/${release.id}/edit`}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
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

            <div className="space-y-4 p-4 xl:hidden sm:p-6">
              {releases.map((release) => {
                const releaseHref = getReleaseHref(release);

                return (
                  <article
                    key={release.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {release.title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          Version {release.version}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          {release.slug
                            ? `/releases/${release.slug}`
                            : `/releases/${release.id}`}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                          release.status
                        )}`}
                      >
                        {getStatusLabel(release.status)}
                      </span>
                    </div>

                    <div className="mt-4 text-sm leading-6 text-zinc-400">
                      {release.description
                        ? shorten(release.description, 160)
                        : "Keine Beschreibung vorhanden"}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                          <Download className="h-4 w-4 text-cyan-300" />
                          Downloads
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {release.downloadCount ?? 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                          <MessageSquare className="h-4 w-4 text-cyan-300" />
                          Kommentare
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {release._count.comments}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Erstellt
                        </div>
                        <div className="mt-1">{formatDateTime(release.createdAt)}</div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Aktualisiert
                        </div>
                        <div className="mt-1">{formatDateTime(release.updatedAt)}</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={releaseHref}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ansehen
                      </Link>

                      <Link
                        href={`/dashboard/releases/${release.id}/edit`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                        Bearbeiten
                      </Link>

                      {release.fileUrl ? (
                        <a
                          href={release.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                        >
                          <Download className="h-4 w-4" />
                          Datei
                        </a>
                      ) : null}

                      <form action={toggleStatusAction}>
                        <input type="hidden" name="releaseId" value={release.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/15"
                        >
                          {release.status === "PUBLISHED"
                            ? "Zu Entwurf"
                            : "Veröffentlichen"}
                        </button>
                      </form>

                      <form action={deleteReleaseAction}>
                        <input type="hidden" name="releaseId" value={release.id} />
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
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}