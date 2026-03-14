"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Crown,
  ImageIcon,
  MessageSquare,
  Package,
  Save,
  Trash2,
  User as UserIcon,
} from "lucide-react";

type UserListItem = {
  id: string;
  role: "ADMIN" | "USER";
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

type UsersListProps = {
  users: UserListItem[];
};

function getRoleBadgeClass(role: "ADMIN" | "USER") {
  return role === "ADMIN"
    ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
    : "border border-zinc-700 bg-zinc-800/70 text-zinc-300";
}

export default function UsersList({ users }: UsersListProps) {
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const userToDelete = users.find((user) => user.id === deleteUserId) ?? null;

  return (
    <>
      <div className="space-y-5">
        {users.map((user) => (
          <article
            key={user.id}
            className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6"
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${getRoleBadgeClass(
                      user.role
                    )}`}
                  >
                    {user.role === "ADMIN" ? (
                      <Crown className="h-3.5 w-3.5" />
                    ) : (
                      <UserIcon className="h-3.5 w-3.5" />
                    )}
                    {user.role}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                    {user.createdAtLabel}
                  </span>

                  {user.isSelf ? (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                      Dein Account
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-3xl font-semibold tracking-tight text-white">
                    {user.displayName}
                  </h3>

                  <div className="mt-4 space-y-2 text-sm text-zinc-400">
                    <p>
                      <span className="text-zinc-200">E-Mail:</span>{" "}
                      {user.email || "—"}
                    </p>
                    <p>
                      <span className="text-zinc-200">Username:</span>{" "}
                      {user.username || "—"}
                    </p>
                    <p>
                      <span className="text-zinc-200">Name:</span>{" "}
                      {user.name || "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center gap-2 text-zinc-500">
                      <MessageSquare className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs uppercase tracking-[0.16em]">
                        Kommentare
                      </span>
                    </div>
                    <div className="text-2xl font-semibold text-white">
                      {user.commentCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center gap-2 text-zinc-500">
                      <Package className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs uppercase tracking-[0.16em]">
                        Releases
                      </span>
                    </div>
                    <div className="text-2xl font-semibold text-white">
                      {user.releaseCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center gap-2 text-zinc-500">
                      <ImageIcon className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs uppercase tracking-[0.16em]">
                        Medien
                      </span>
                    </div>
                    <div className="text-2xl font-semibold text-white">
                      {user.mediaCount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 rounded-3xl border border-white/10 bg-black/20 p-5">
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Benutzeraktionen
                  </div>
                  <h4 className="mt-1 text-2xl font-semibold text-white">
                    Rolle und Aktionen
                  </h4>
                </div>

                <form
                  action={`/api/admin/users/${user.id}/role`}
                  method="POST"
                  className="space-y-4"
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Rolle ändern
                    </label>

                    <div className="flex gap-3">
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={user.isSelf}
                        className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>

                      <button
                        type="submit"
                        disabled={user.isSelf}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Speichern
                      </button>
                    </div>

                    {user.isSelf ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Deine eigene Rolle kann hier nicht geändert werden.
                      </p>
                    ) : null}
                  </div>
                </form>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href={`/dashboard/comments?q=${encodeURIComponent(
                      user.email || user.username || user.name || ""
                    )}`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Kommentare
                  </Link>

                  <button
                    type="button"
                    disabled={user.isSelf}
                    onClick={() => setDeleteUserId(user.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {userToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">
                  Benutzer löschen?
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Möchtest du den Benutzer{" "}
                  <span className="font-semibold text-white">
                    {userToDelete.displayName}
                  </span>{" "}
                  wirklich löschen? Diese Aktion kann nicht rückgängig gemacht
                  werden.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteUserId(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                Abbrechen
              </button>

              <form action={`/api/admin/users/${userToDelete.id}`} method="POST">
                <input type="hidden" name="_method" value="DELETE" />
                <button
                  type="submit"
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                >
                  Ja, löschen
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}