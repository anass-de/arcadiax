import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Crown,
  Search,
  Shield,
  User as UserIcon,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import UsersList from "@/components/dashboard/users/users-list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  role?: string;
  status?: string;
  error?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

type SessionUser = {
  id?: string | null;
  role?: "ADMIN" | "USER" | null;
};

type UserRole = "ADMIN" | "USER";

type UserRow = {
  id: string;
  role: UserRole;
  username: string | null;
  name: string | null;
  email: string | null;
  createdAt: Date;
  _count: {
    comments: number;
    releases: number;
    mediaItems: number;
  };
};

type PreparedUser = {
  id: string;
  role: UserRole;
  username: string | null;
  name: string | null;
  email: string | null;
  createdAtLabel: string;
  displayName: string;
  commentCount: number;
  releaseCount: number;
  mediaCount: number;
  isSelf: boolean;
};

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
  return user.username || user.name || user.email || "Unbekannt";
}

function getStatusMessage(status?: string) {
  switch (status) {
    case "role_updated":
      return "Benutzerrolle wurde erfolgreich aktualisiert.";
    case "deleted":
      return "Benutzer wurde erfolgreich gelöscht.";
    default:
      return null;
  }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_method":
      return "Ungültige Aktion.";
    case "invalid_user":
      return "Ungültiger Benutzer.";
    case "invalid_role":
      return "Ungültige Rolle.";
    case "not_found":
      return "Benutzer wurde nicht gefunden.";
    case "delete_failed":
      return "Benutzer konnte nicht gelöscht werden.";
    case "role_update_failed":
      return "Rolle konnte nicht aktualisiert werden.";
    case "cannot_delete_self":
      return "Du kannst deinen eigenen Account nicht löschen.";
    case "cannot_change_own_role":
      return "Du kannst deine eigene Rolle hier nicht ändern.";
    default:
      return null;
  }
}

export default async function DashboardUsersPage({
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/users");
  }

  if (sessionUser?.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const roleFilter = params.role?.trim() || "all";

  const where: {
    OR?: Array<{
      username?: { contains: string; mode: "insensitive" };
      name?: { contains: string; mode: "insensitive" };
      email?: { contains: string; mode: "insensitive" };
    }>;
    role?: UserRole;
  } = {};

  if (q) {
    where.OR = [
      { username: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (roleFilter === "ADMIN" || roleFilter === "USER") {
    where.role = roleFilter;
  }

  const [users, totalUsers, totalAdmins, totalNormalUsers] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: {
          select: {
            comments: true,
            releases: true,
            mediaItems: true,
          },
        },
      },
    }),
    prisma.user.count(),
    prisma.user.count({
      where: { role: "ADMIN" },
    }),
    prisma.user.count({
      where: { role: "USER" },
    }),
  ]);

  const typedUsers: UserRow[] = users;

  const statusMessage = getStatusMessage(params.status);
  const errorMessage = getErrorMessage(params.error);

  const preparedUsers: PreparedUser[] = typedUsers.map((user: UserRow) => ({
    id: user.id,
    role: user.role,
    username: user.username,
    name: user.name,
    email: user.email,
    createdAtLabel: formatDate(user.createdAt),
    displayName: getDisplayName(user),
    commentCount: user._count.comments,
    releaseCount: user._count.releases,
    mediaCount: user._count.mediaItems,
    isSelf: sessionUser?.id === user.id,
  }));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Benutzerverwaltung
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Benutzer verwalten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Benutzerrollen anpassen, Aktivität einsehen und problematische
                Accounts direkt im ArcadiaX Admin-Bereich verwalten.
              </p>
            </div>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <Users className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Gesamt
            </div>
          </div>

          <div className="mt-4 text-3xl font-semibold text-white">
            {totalUsers}
          </div>
          <div className="mt-2 text-sm text-zinc-400">Alle Benutzerkonten</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <Crown className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Admins
            </div>
          </div>

          <div className="mt-4 text-3xl font-semibold text-white">
            {totalAdmins}
          </div>
          <div className="mt-2 text-sm text-zinc-400">Administratoren</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <UserIcon className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              User
            </div>
          </div>

          <div className="mt-4 text-3xl font-semibold text-white">
            {totalNormalUsers}
          </div>
          <div className="mt-2 text-sm text-zinc-400">Normale Benutzer</div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <Search className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-500">Filter</div>
            <h2 className="text-2xl font-semibold text-white">
              Suche und Auswahl
            </h2>
          </div>
        </div>

        <form className="grid gap-4 lg:grid-cols-[1.2fr_0.6fr_auto] lg:items-end">
          <div>
            <label
              htmlFor="q"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Suche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Nach Username, Name oder E-Mail suchen..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/40 focus:bg-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Rolle
            </label>
            <select
              id="role"
              name="role"
              defaultValue={roleFilter}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:bg-zinc-900"
            >
              <option value="all">Alle</option>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Anwenden
            </button>

            <Link
              href="/dashboard/users"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
              Accounts
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Benutzerliste
            </h2>
          </div>

          <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 md:block">
            {preparedUsers.length} Treffer
          </div>
        </div>

        {preparedUsers.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8 text-zinc-400">
            Keine Benutzer gefunden.
          </div>
        ) : (
          <UsersList users={preparedUsers} />
        )}
      </section>
    </div>
  );
}