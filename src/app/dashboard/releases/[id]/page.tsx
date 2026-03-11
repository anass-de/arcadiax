import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ReleaseStatus = "DRAFT" | "PUBLISHED";

async function updateReleaseAction(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const changelog = String(formData.get("changelog") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT").trim().toUpperCase();

  if (!id) {
    throw new Error("Release-ID fehlt.");
  }

  if (!title) {
    throw new Error("Titel fehlt.");
  }

  if (!version) {
    throw new Error("Version fehlt.");
  }

  if (!slug) {
    throw new Error("Slug fehlt.");
  }

  if (!fileUrl) {
    throw new Error("fileUrl fehlt.");
  }

  if (status !== "DRAFT" && status !== "PUBLISHED") {
    throw new Error("Ungültiger Status.");
  }

  const existing = await prisma.release.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Release nicht gefunden.");
  }

  await prisma.release.update({
    where: { id },
    data: {
      title,
      version,
      slug,
      description: description || null,
      changelog: changelog || null,
      fileUrl,
      imageUrl: imageUrl || null,
      status: status as ReleaseStatus,
    },
  });

  redirect(`/dashboard/releases/${id}?saved=1`);
}

async function deleteReleaseAction(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Release-ID fehlt.");
  }

  const existing = await prisma.release.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Release nicht gefunden.");
  }

  await prisma.release.delete({
    where: { id },
  });

  redirect("/dashboard/releases?deleted=1");
}

function badgeClass(status: ReleaseStatus) {
  return status === "PUBLISHED"
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : "border border-amber-500/20 bg-amber-500/10 text-amber-300";
}

export default async function AdminReleaseEditPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;

  const release = await prisma.release.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          image: true,
          role: true,
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
          downloads: true,
        },
      },
    },
  });

  if (!release) {
    notFound();
  }

  const authorLabel =
    release.author?.username ||
    release.author?.name ||
    release.author?.email ||
    "Unbekannt";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-blue-400">Admin / Releases / Bearbeiten</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Release bearbeiten
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Bearbeite Metadaten, Status und Links deines ArcadiaX-Releases.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/releases"
            className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Zurück zur Liste
          </Link>

          <Link
            href={`/releases/${release.slug}`}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Öffentliche Seite
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <form
          action={updateReleaseAction}
          className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-2xl backdrop-blur"
        >
          <input type="hidden" name="id" value={release.id} />

          <div className="grid gap-5">
            <section className="grid gap-4">
              <h2 className="text-lg font-semibold text-white">Basisdaten</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-zinc-200">Titel</span>
                  <input
                    name="title"
                    defaultValue={release.title}
                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-zinc-200">Version</span>
                  <input
                    name="version"
                    defaultValue={release.version}
                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">Slug</span>
                <input
                  name="slug"
                  defaultValue={release.slug}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 font-mono text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">Beschreibung</span>
                <textarea
                  name="description"
                  defaultValue={release.description ?? ""}
                  rows={5}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">Changelog</span>
                <textarea
                  name="changelog"
                  defaultValue={release.changelog ?? ""}
                  rows={10}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 font-mono text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="grid gap-2 md:max-w-xs">
                <span className="text-sm font-medium text-zinc-200">Status</span>
                <select
                  name="status"
                  defaultValue={release.status}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </label>
            </section>

            <section className="grid gap-4">
              <h2 className="text-lg font-semibold text-white">Datei-Links</h2>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">fileUrl</span>
                <input
                  name="fileUrl"
                  defaultValue={release.fileUrl}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  imageUrl <span className="text-zinc-500">(optional)</span>
                </span>
                <input
                  name="imageUrl"
                  defaultValue={release.imageUrl ?? ""}
                  className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>
            </section>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Änderungen speichern
              </button>

              <Link
                href="/dashboard/releases"
                className="rounded-xl border border-white/10 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Abbrechen
              </Link>
            </div>
          </div>
        </form>

        <aside className="grid gap-6">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-2xl backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-white">Vorschau</h2>

            <div className="grid gap-4">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                {release.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.imageUrl}
                    alt={release.title}
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center text-sm text-zinc-500">
                    Kein Cover-Bild
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(release.status)}`}>
                    {release.status}
                  </span>
                  <span className="rounded-full border border-white/10 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                    v{release.version}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-white">{release.title}</h3>

                <p className="break-all text-xs text-zinc-500">{release.slug}</p>

                <p className="whitespace-pre-wrap text-sm text-zinc-300">
                  {release.description || "Keine Beschreibung vorhanden."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-2xl backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-white">Metadaten</h2>

            <div className="grid gap-3 text-sm text-zinc-400">
              <p>
                Autor: <span className="text-zinc-200">{authorLabel}</span>
              </p>
              <p>
                Erstellt:{" "}
                <span className="text-zinc-200">
                  {new Date(release.createdAt).toLocaleString("de-DE")}
                </span>
              </p>
              <p>
                Aktualisiert:{" "}
                <span className="text-zinc-200">
                  {new Date(release.updatedAt).toLocaleString("de-DE")}
                </span>
              </p>
              <p>
                Kommentare: <span className="text-zinc-200">{release._count.comments}</span>
              </p>
              <p>
                Likes: <span className="text-zinc-200">{release._count.likes}</span>
              </p>
              <p>
                Download-Logs: <span className="text-zinc-200">{release._count.downloads}</span>
              </p>
              <p>
                DownloadCount: <span className="text-zinc-200">{release.downloadCount}</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 shadow-2xl backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold text-white">Gefahrenzone</h2>
            <p className="mb-4 text-sm text-red-200/90">
              Das Löschen entfernt den Release-Datensatz dauerhaft. Kommentare,
              Likes und Download-Logs werden durch Cascade ebenfalls entfernt.
            </p>

            <form action={deleteReleaseAction}>
              <input type="hidden" name="id" value={release.id} />
              <button
                type="submit"
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Release löschen
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}