import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import ProfileCommentsManager from "@/components/profile/ProfileCommentsManager";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: {
        select: {
          comments: true,
          releases: true,
        },
      },
      releases: {
        where: {
          status: "PUBLISHED",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          title: true,
          slug: true,
          version: true,
          downloadCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const displayName = user.name || user.username || user.email || "User";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>

            {user.username ? (
              <p className="mt-2 text-sm text-zinc-400">
                <Link
                  href={`/u/${user.username}`}
                  className="hover:text-white hover:underline"
                >
                  @{user.username}
                </Link>
              </p>
            ) : null}

            {user.email ? (
              <p className="mt-2 text-sm text-zinc-500">{user.email}</p>
            ) : null}

            {user.bio ? (
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm text-zinc-300">
                {user.bio}
              </p>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                Noch keine Bio hinterlegt.
              </p>
            )}

            <p className="mt-4 text-xs text-zinc-600">
              Mitglied seit{" "}
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
              }).format(user.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile/edit"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Profil bearbeiten
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="text-sm text-zinc-400">Kommentare</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {user._count.comments}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="text-sm text-zinc-400">Releases</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {user._count.releases}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="text-sm text-zinc-400">Rolle</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {user.role}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Meine Releases</h2>
        </div>

        {user.releases.length === 0 ? (
          <p className="text-sm text-zinc-400">Keine veröffentlichten Releases.</p>
        ) : (
          <div className="space-y-4">
            {user.releases.map((release) => (
              <div
                key={release.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {release.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      Version {release.version}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {release.downloadCount} Downloads
                    </p>
                  </div>

                  <Link
                    href={`/releases/${release.slug}`}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800"
                  >
                    Öffnen
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
        <h2 className="mb-6 text-2xl font-semibold">Meine Kommentare</h2>
        <ProfileCommentsManager />
      </section>
    </main>
  );
}