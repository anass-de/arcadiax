import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ProfileComment = {
  id: string;
  content: string;
  createdAt: Date;
  release: {
    id: string;
    title: string;
    slug: string;
  };
};

type ProfileUser = {
  username: string | null;
  email: string | null;
  comments: ProfileComment[];
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user: ProfileUser | null = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      username: true,
      email: true,
      comments: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          release: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Mein Profil</h1>
              <p className="mt-2 text-sm text-white/60">
                Übersicht deiner Kontodaten und Kommentare
              </p>
            </div>

            <Link
              href="/profile/edit"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Profil bearbeiten
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="mb-2 text-sm text-white/50">Username</p>
              <p className="text-lg font-medium">{user.username ?? "—"}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <p className="mb-2 text-sm text-white/50">E-Mail</p>
              <p className="text-lg font-medium">{user.email ?? "—"}</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-5">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">Meine Kommentare</h2>
              <p className="mt-1 text-sm text-white/60">
                Alle Kommentare, die du veröffentlicht hast
              </p>
            </div>

            {user.comments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                Du hast noch keine Kommentare geschrieben.
              </div>
            ) : (
              <div className="space-y-4">
                {user.comments.map((comment: ProfileComment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6 text-white/90">
                      {comment.content}
                    </p>

                    <div className="mt-3 flex flex-col gap-1 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {new Date(comment.createdAt).toLocaleString("de-DE")}
                      </span>

                      <Link
                        href={`/releases/${comment.release.slug}`}
                        className="text-white/60 transition hover:text-white"
                      >
                        Release: {comment.release.title}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}