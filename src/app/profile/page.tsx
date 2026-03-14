import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Mail,
  MessageSquare,
  Pencil,
  Shield,
  User as UserIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ProfileComment = {
  id: string;
  content: string;
  createdAt: Date;
  release: {
    id: string;
    title: string;
    slug: string | null;
  };
};

type ProfileUser = {
  username: string | null;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "USER";
  createdAt: Date;
  comments: ProfileComment[];
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getDisplayName(user: {
  username?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  return user.username || user.name || user.email || "Benutzer";
}

function getInitials(user: {
  username?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  const source = getDisplayName(user);
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getReleaseHref(release: { id: string; slug: string | null }) {
  return release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/profile");
  }

  const user: ProfileUser | null = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      username: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
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
    redirect("/login?callbackUrl=/profile");
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-6 py-8 shadow-xl shadow-black/15 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-lg font-semibold text-white">
              {initials}
            </div>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                <Shield className="h-4 w-4" />
                Mein Bereich
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {displayName}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Übersicht deiner Kontodaten, Rolle und bisherigen Kommentare auf
                ArcadiaX.
              </p>
            </div>
          </div>

          <Link
            href="/profile/edit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Pencil className="h-4 w-4" />
            Profil bearbeiten
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <UserIcon className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Username
          </div>
          <div className="mt-3 text-xl font-semibold text-white">
            {user.username || "—"}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <Mail className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            E-Mail
          </div>
          <div className="mt-3 break-all text-xl font-semibold text-white">
            {user.email || "—"}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <Shield className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Rolle
          </div>
          <div className="mt-3 text-xl font-semibold text-white">
            {user.role}
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            Mitglied seit {formatDate(user.createdAt)}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <MessageSquare className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-500">Aktivität</div>
            <h2 className="text-2xl font-semibold text-white">
              Meine Kommentare
            </h2>
          </div>
        </div>

        {user.comments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
            Du hast noch keine Kommentare geschrieben.
          </div>
        ) : (
          <div className="space-y-4">
            {user.comments.map((comment: ProfileComment) => (
              <article
                key={comment.id}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                  {comment.content}
                </p>

                <div className="mt-4 flex flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>{formatDateTime(comment.createdAt)}</span>

                  <Link
                    href={getReleaseHref(comment.release)}
                    className="text-zinc-300 transition hover:text-white"
                  >
                    Release: {comment.release.title}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}