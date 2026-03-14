import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Download,
  FolderOpen,
  MessageSquare,
  Package,
  Plus,
  Users,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  role?: "USER" | "ADMIN" | null;
};

type DashboardRelease = {
  id: string;
  title: string;
  slug: string | null;
  version: string;
  status: "DRAFT" | "PUBLISHED";
  createdAt: Date;
  downloadCount: number;
};

type DashboardComment = {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    username: string | null;
    name: string | null;
    email: string | null;
  };
  release: {
    id: string;
    slug: string | null;
    title: string;
    version: string;
  };
};

type DashboardUser = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  role: "USER" | "ADMIN";
  createdAt: Date;
};

function getReleaseHref(release: { id: string; slug: string | null }) {
  return release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getCommentAuthor(comment: DashboardComment) {
  return (
    comment.user.username ||
    comment.user.name ||
    comment.user.email ||
    "Unbekannt"
  );
}

function getUserDisplayName(user: DashboardUser) {
  return user.username || user.name || user.email || "Unbekannt";
}

function getStatusLabel(status: DashboardRelease["status"]) {
  return status === "PUBLISHED" ? "Veröffentlicht" : "Entwurf";
}

function getStatCards(data: {
  releaseCount: number;
  mediaCount: number;
  commentCount: number;
  userCount: number;
  totalDownloadCount: number;
}) {
  return [
    {
      title: "Releases",
      value: data.releaseCount,
      hint: "Alle Versionen im System",
      icon: Package,
    },
    {
      title: "Medien",
      value: data.mediaCount,
      hint: "Bilder und Videos für Home",
      icon: FolderOpen,
    },
    {
      title: "Kommentare",
      value: data.commentCount,
      hint: "Community Aktivität gesamt",
      icon: MessageSquare,
    },
    {
      title: "Benutzer",
      value: data.userCount,
      hint: "Registrierte Accounts",
      icon: Users,
    },
    {
      title: "Downloads",
      value: data.totalDownloadCount,
      hint: "Gesamte Release Downloads",
      icon: Download,
    },
  ];
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role ?? null;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (role !== "ADMIN") {
    redirect("/");
  }

  const [
    releaseCount,
    mediaCount,
    commentCount,
    userCount,
    totalDownloads,
    latestReleases,
    latestComments,
    recentUsers,
  ] = await Promise.all([
    prisma.release.count(),
    prisma.homeMedia.count(),
    prisma.comment.count(),
    prisma.user.count(),
    prisma.release.aggregate({
      _sum: {
        downloadCount: true,
      },
    }),
    prisma.release.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        slug: true,
        version: true,
        status: true,
        createdAt: true,
        downloadCount: true,
      },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            name: true,
            email: true,
          },
        },
        release: {
          select: {
            id: true,
            slug: true,
            title: true,
            version: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  const typedLatestReleases: DashboardRelease[] = latestReleases;
  const typedLatestComments: DashboardComment[] = latestComments;
  const typedRecentUsers: DashboardUser[] = recentUsers;

  const totalDownloadCount = totalDownloads._sum.downloadCount ?? 0;

  const statCards = getStatCards({
    releaseCount,
    mediaCount,
    commentCount,
    userCount,
    totalDownloadCount,
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">{card.title}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">{card.hint}</p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/10 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Schnellzugriff</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Die wichtigsten Admin-Aktionen direkt erreichbar.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/releases/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Neues Release
            </Link>

            <Link
              href="/dashboard/media"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <FolderOpen className="h-4 w-4" />
              Media verwalten
            </Link>

            <Link
              href="/dashboard/comments"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <MessageSquare className="h-4 w-4" />
              Kommentare prüfen
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Letzte Releases
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Neueste Versionen und ihr Status.
              </p>
            </div>

            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              Alle ansehen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {typedLatestReleases.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
              Noch keine Releases vorhanden.
            </div>
          ) : (
            <div className="space-y-4">
              {typedLatestReleases.map((release) => (
                <div
                  key={release.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-zinc-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={getReleaseHref(release)}
                        className="text-base font-semibold text-white transition hover:text-cyan-300"
                      >
                        {release.title}
                      </Link>

                      <p className="mt-1 text-sm text-zinc-400">
                        Version {release.version}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        {formatDateTime(release.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          release.status === "PUBLISHED"
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border border-zinc-700 bg-zinc-800/70 text-zinc-300"
                        }`}
                      >
                        {getStatusLabel(release.status)}
                      </span>

                      <p className="mt-3 text-sm text-zinc-400">
                        {release.downloadCount} Downloads
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/releases/${release.id}/edit`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                      Bearbeiten
                    </Link>

                    <Link
                      href={getReleaseHref(release)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                      Öffentlich ansehen
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Letzte Kommentare
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Aktuelle Aktivität aus der Community.
              </p>
            </div>

            <Link
              href="/dashboard/comments"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              Zur Moderation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {typedLatestComments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
              Noch keine Kommentare vorhanden.
            </div>
          ) : (
            <div className="space-y-4">
              {typedLatestComments.map((comment) => {
                const author = getCommentAuthor(comment);

                return (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-zinc-700"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-zinc-300">
                        <span className="font-medium text-white">{author}</span>{" "}
                        bei{" "}
                        <Link
                          href={getReleaseHref(comment.release)}
                          className="font-medium text-cyan-400 transition hover:text-cyan-300"
                        >
                          {comment.release.title}
                        </Link>
                      </p>

                      <p className="text-xs text-zinc-500">
                        {formatDateTime(comment.createdAt)}
                      </p>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">
                      {comment.content}
                    </p>

                    <p className="mt-3 text-xs text-zinc-500">
                      Release Version: {comment.release.version}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Neue Benutzer</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Kürzlich registrierte Accounts im System.
            </p>
          </div>

          <Link
            href="/dashboard/users"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            Benutzerverwaltung
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {typedRecentUsers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
            Noch keine Benutzer vorhanden.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {typedRecentUsers.map((user) => {
              const displayName = getUserDisplayName(user);

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {displayName}
                      </p>

                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {user.email || "—"}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        {formatDateTime(user.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        user.role === "ADMIN"
                          ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                          : "border border-zinc-700 bg-zinc-800/70 text-zinc-300"
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}