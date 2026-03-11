// src/app/dashboard/users/page.tsx

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return session;
}

export default async function DashboardUsersPage() {
  const session = await requireAdmin();
  const currentUserId = session.user.id;

  async function updateUserRoleAction(formData: FormData) {
    "use server";

    const session = await requireAdmin();
    const currentUserId = session.user.id;

    const id = String(formData.get("id") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim().toUpperCase();

    if (!id) return;
    if (role !== "USER" && role !== "ADMIN") return;

    if (id === currentUserId) {
      revalidatePath("/dashboard/users");
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      revalidatePath("/dashboard/users");
      return;
    }

    await prisma.user.update({
      where: { id },
      data: {
        role: role as "USER" | "ADMIN",
      },
    });

    revalidatePath("/dashboard/users");
  }

  async function deleteUserAction(formData: FormData) {
    "use server";

    const session = await requireAdmin();
    const currentUserId = session.user.id;

    const id = String(formData.get("id") ?? "").trim();

    if (!id) return;

    if (id === currentUserId) {
      revalidatePath("/dashboard/users");
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      revalidatePath("/dashboard/users");
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/comments");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      _count: {
        select: {
          comments: true,
          releases: true,
          mediaItems: true,
        },
      },
    },
  });

  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const userCount = users.filter((u) => u.role === "USER").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">Benutzer verwalten</h1>
        <p className="mt-2 text-zinc-400">
          Benutzerrollen anpassen, Aktivität ansehen und problematische Accounts
          entfernen.
        </p>
      </div>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Gesamt</p>
          <p className="mt-2 text-3xl font-bold text-white">{users.length}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Admins</p>
          <p className="mt-2 text-3xl font-bold text-white">{adminCount}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">User</p>
          <p className="mt-2 text-3xl font-bold text-white">{userCount}</p>
        </div>
      </section>

      <section>
        {users.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            Keine Benutzer gefunden.
          </div>
        ) : (
          <div className="space-y-5">
            {users.map((user) => {
              const displayName =
                user.username || user.name || user.email || "Unbekannt";
              const isCurrentUser = user.id === currentUserId;

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            user.role === "ADMIN"
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {user.role}
                        </span>

                        {isCurrentUser && (
                          <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-300">
                            Du
                          </span>
                        )}

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                          {new Date(user.createdAt).toLocaleDateString("de-DE")}
                        </span>
                      </div>

                      <h2 className="text-xl font-semibold text-white">
                        {displayName}
                      </h2>

                      <div className="mt-2 space-y-1 text-sm text-zinc-400">
                        <p>
                          <span className="text-zinc-500">E-Mail:</span>{" "}
                          {user.email || "—"}
                        </p>
                        <p>
                          <span className="text-zinc-500">Username:</span>{" "}
                          {user.username || "—"}
                        </p>
                        <p>
                          <span className="text-zinc-500">Kommentare:</span>{" "}
                          {user._count.comments}
                        </p>
                        <p>
                          <span className="text-zinc-500">Releases:</span>{" "}
                          {user._count.releases}
                        </p>
                        <p>
                          <span className="text-zinc-500">Medien:</span>{" "}
                          {user._count.mediaItems}
                        </p>
                      </div>
                    </div>

                    <div className="w-full max-w-sm space-y-4">
                      <form action={updateUserRoleAction} className="space-y-3">
                        <input type="hidden" name="id" value={user.id} />

                        <label className="block text-sm font-medium text-zinc-300">
                          Rolle ändern
                        </label>

                        <div className="flex gap-3">
                          <select
                            name="role"
                            defaultValue={user.role}
                            disabled={isCurrentUser}
                            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>

                          <button
                            type="submit"
                            disabled={isCurrentUser}
                            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Speichern
                          </button>
                        </div>
                      </form>

                      <div className="flex flex-wrap gap-3">
                        <Link
                          href="/dashboard/comments"
                          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
                        >
                          Kommentare
                        </Link>

                        <form action={deleteUserAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <button
                            type="submit"
                            disabled={isCurrentUser}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Löschen
                          </button>
                        </form>
                      </div>

                      {isCurrentUser && (
                        <p className="text-xs text-zinc-500">
                          Der aktuell eingeloggte Admin kann hier nicht gelöscht
                          oder herabgestuft werden.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}