// src/app/dashboard/media/page.tsx

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminMediaPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const mediaItems = await prisma.homeMedia.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">Media verwalten</h1>
        <p className="mt-2 text-zinc-400">
          Bilder und Videos für die Startseite hochladen, bearbeiten und löschen.
        </p>
      </div>

      {/* Upload */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold text-white">Neues Medium hochladen</h2>

        <form
          action="/api/admin/media"
          method="POST"
          encType="multipart/form-data"
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Typ
            </label>
            <select
              name="type"
              defaultValue="IMAGE"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            >
              <option value="IMAGE">IMAGE</option>
              <option value="VIDEO">VIDEO</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Sortierung
            </label>
            <input
              type="number"
              name="sortOrder"
              defaultValue={0}
              min={0}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Titel
            </label>
            <input
              type="text"
              name="title"
              placeholder="z. B. ArcadiaX Screenshot"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Beschreibung
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Kurze Beschreibung"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Datei
            </label>
            <input
              type="file"
              name="file"
              required
              className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <input
              id="active-create"
              type="checkbox"
              name="active"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
            />
            <label htmlFor="active-create" className="text-sm text-zinc-300">
              Aktiv
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 font-medium text-black transition hover:opacity-90"
            >
              Medium hochladen
            </button>
          </div>
        </form>
      </section>

      {/* Liste */}
      <section className="mt-10">
        <h2 className="mb-6 text-xl font-semibold text-white">Vorhandene Medien</h2>

        {mediaItems.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            Noch keine Medien vorhanden.
          </div>
        ) : (
          <div className="space-y-6">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  {/* Vorschau */}
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                        {item.type}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.active
                            ? "bg-green-500/15 text-green-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                      {item.type === "IMAGE" ? (
                        <img
                          src={item.url}
                          alt={item.title || "Media"}
                          className="h-auto w-full object-cover"
                        />
                      ) : (
                        <video
                          src={item.url}
                          controls
                          className="h-auto w-full"
                        />
                      )}
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-zinc-500">
                      <p>
                        <span className="text-zinc-400">Datei:</span> {item.url}
                      </p>
                      <p>
                        <span className="text-zinc-400">Sortierung:</span>{" "}
                        {item.sortOrder}
                      </p>
                      <p>
                        <span className="text-zinc-400">Autor:</span>{" "}
                        {item.author?.username ||
                          item.author?.name ||
                          item.author?.email ||
                          "Unbekannt"}
                      </p>
                    </div>
                  </div>

                  {/* Bearbeiten */}
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Medium bearbeiten
                    </h3>

                    <form
                      action={`/api/admin/media/${item.id}`}
                      method="POST"
                      className="mt-4 grid gap-4"
                    >
                      <input type="hidden" name="_method" value="PATCH" />

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-zinc-300">
                            Typ
                          </label>
                          <select
                            name="type"
                            defaultValue={item.type}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                          >
                            <option value="IMAGE">IMAGE</option>
                            <option value="VIDEO">VIDEO</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-zinc-300">
                            Sortierung
                          </label>
                          <input
                            type="number"
                            name="sortOrder"
                            min={0}
                            defaultValue={item.sortOrder}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300">
                          Titel
                        </label>
                        <input
                          type="text"
                          name="title"
                          defaultValue={item.title ?? ""}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300">
                          Beschreibung
                        </label>
                        <textarea
                          name="description"
                          rows={3}
                          defaultValue={item.description ?? ""}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300">
                          URL
                        </label>
                        <input
                          type="text"
                          name="url"
                          defaultValue={item.url}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          id={`active-${item.id}`}
                          type="checkbox"
                          name="active"
                          defaultChecked={item.active}
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
                        />
                        <label
                          htmlFor={`active-${item.id}`}
                          className="text-sm text-zinc-300"
                        >
                          Aktiv
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500"
                        >
                          Änderungen speichern
                        </button>
                      </div>
                    </form>

                    {/* Löschen */}
                    <form
                      action={`/api/admin/media/${item.id}`}
                      method="POST"
                      className="mt-4"
                    >
                      <input type="hidden" name="_method" value="DELETE" />
                      <button
                        type="submit"
                        className="rounded-xl bg-red-600 px-5 py-3 font-medium text-white transition hover:bg-red-500"
                      >
                        Medium löschen
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}