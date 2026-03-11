import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  role?: "USER" | "ADMIN" | null;
};

function getReleaseHref(release: { id: string; slug: string }) {
  return release.slug?.trim() ? `/releases/${release.slug}` : `/releases/${release.id}`;
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
      take: 5,
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

  const totalDownloadCount = totalDownloads._sum.downloadCount ?? 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Releases</p>
          <p className="mt-3 text-3xl font-bold text-white">{releaseCount}</p>
          <p className="mt-2 text-xs text-zinc-500">Alle Versionen im System</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Medien</p>
          <p className="mt-3 text-3xl font-bold text-white">{mediaCount}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Bilder und Videos für Home
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Kommentare</p>
          <p className="mt-3 text-3xl font-bold text-white">{commentCount}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Community Aktivität gesamt
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Benutzer</p>
          <p className="mt-3 text-3xl font-bold text-white">{userCount}</p>
          <p className="mt-2 text-xs text-zinc-500">Registrierte Accounts</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Downloads</p>
          <p className="mt-3 text-3xl font-bold text-white">
            {totalDownloadCount}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Gesamte Release Downloads
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
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
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Neues Release
            </Link>

            <Link
              href="/dashboard/media"
              className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
            >
              Media verwalten
            </Link>

            <Link
              href="/dashboard/comments"
              className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
            >
              Kommentare prüfen
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">
              Letzte Releases
            </h2>

            <Link
              href="/dashboard/releases"
              className="text-sm text-zinc-400 hover:text-white"
            >
              Alle ansehen
            </Link>
          </div>

          {latestReleases.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
              Noch keine Releases vorhanden.
            </div>
          ) : (
            <div className="space-y-4">
              {latestReleases.map((release) => (
                <div
                  key={release.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={getReleaseHref(release)}
                        className="text-base font-semibold text-white hover:text-blue-400"
                      >
                        {release.title}
                      </Link>

                      <p className="mt-1 text-sm text-zinc-400">
                        Version {release.version}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        {new Date(release.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          release.status === "PUBLISHED"
                            ? "bg-green-500/15 text-green-300"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {release.status}
                      </span>

                      <p className="mt-3 text-sm text-zinc-400">
                        {release.downloadCount} Downloads
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">
              Letzte Kommentare
            </h2>

            <Link
              href="/dashboard/comments"
              className="text-sm text-zinc-400 hover:text-white"
            >
              Zur Moderation
            </Link>
          </div>

          {latestComments.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
              Noch keine Kommentare vorhanden.
            </div>
          ) : (
            <div className="space-y-4">
              {latestComments.map((comment) => {
                const author =
                  comment.user.username ||
                  comment.user.name ||
                  comment.user.email ||
                  "Unbekannt";

                return (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-zinc-300">
                        <span className="font-medium text-white">{author}</span>{" "}
                        bei{" "}
                        <Link
                          href={getReleaseHref(comment.release)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {comment.release.title}
                        </Link>
                      </p>

                      <p className="text-xs text-zinc-500">
                        {new Date(comment.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm text-zinc-400">
                      {comment.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Neue Benutzer</h2>

          <Link
            href="/dashboard/users"
            className="text-sm text-zinc-400 hover:text-white"
          >
            Benutzerverwaltung
          </Link>
        </div>

        {recentUsers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
            Noch keine Benutzer vorhanden.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {recentUsers.map((user) => {
              const displayName =
                user.username || user.name || user.email || "Unbekannt";

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{displayName}</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {user.email || "—"}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        {new Date(user.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        user.role === "ADMIN"
                          ? "bg-blue-500/15 text-blue-300"
                          : "bg-zinc-800 text-zinc-300"
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