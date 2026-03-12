import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import {
  Film,
  ImageIcon,
  Layers3,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 5;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

type SearchParams = Promise<{
  page?: string;
  status?: string;
  error?: string;
}>;

type MediaType = "IMAGE" | "VIDEO";

function getAuthorName(item: {
  author?: {
    username?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
}) {
  return (
    item.author?.username ||
    item.author?.name ||
    item.author?.email ||
    "Unbekannt"
  );
}

function parsePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function getStatusMessage(status?: string) {
  switch (status) {
    case "created":
      return "Medium erfolgreich erstellt.";
    case "updated":
      return "Medium erfolgreich bearbeitet.";
    case "deleted":
      return "Medium erfolgreich gelöscht.";
    default:
      return null;
  }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "upload_failed":
      return "Upload fehlgeschlagen.";
    case "update_failed":
      return "Bearbeitung fehlgeschlagen.";
    case "delete_failed":
      return "Löschen fehlgeschlagen.";
    case "invalid_type":
      return "Ungültiger Medientyp.";
    case "missing_file":
      return "Bitte eine Datei auswählen.";
    case "empty_file":
      return "Die hochgeladene Datei ist leer.";
    case "invalid_mime":
      return "Dateityp konnte nicht erkannt werden.";
    case "mime_mismatch":
      return "Datei passt nicht zum ausgewählten Typ.";
    case "file_too_large":
      return "Datei ist zu groß.";
    case "not_found":
      return "Medium wurde nicht gefunden.";
    default:
      return null;
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidMediaType(value: string): value is MediaType {
  return value === "IMAGE" || value === "VIDEO";
}

function isAllowedMime(type: MediaType, mime: string) {
  if (!mime) return false;
  if (type === "IMAGE") return mime.startsWith("image/");
  if (type === "VIDEO") return mime.startsWith("video/");
  return false;
}

function getUploadDir(type: MediaType) {
  return type === "IMAGE"
    ? path.join(process.cwd(), "public", "uploads", "images")
    : path.join(process.cwd(), "public", "uploads", "videos");
}

function getPublicUrl(type: MediaType, fileName: string) {
  return type === "IMAGE"
    ? `/media/images/${fileName}`
    : `/media/videos/${fileName}`;
}

function revalidateMediaPages() {
  revalidatePath("/dashboard/media");
  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath("/photos");
}

async function saveUploadedFile(file: File, type: MediaType) {
  if (!file) throw new Error("missing_file");
  if (file.size <= 0) throw new Error("empty_file");
  if (file.size > MAX_FILE_SIZE) throw new Error("file_too_large");
  if (!file.type) throw new Error("invalid_mime");
  if (!isAllowedMime(type, file.type)) throw new Error("mime_mismatch");

  const uploadDir = getUploadDir(type);
  await fs.mkdir(uploadDir, { recursive: true });

  const safeOriginalName = sanitizeFileName(file.name || "upload.bin");
  const fileName = `${Date.now()}-${safeOriginalName}`;
  const filePath = path.join(uploadDir, fileName);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(filePath, buffer);
  await fs.access(filePath);

  return {
    fileName,
    filePath,
    url: getPublicUrl(type, fileName),
  };
}

async function deleteLocalFile(fileUrl?: string | null) {
  if (!fileUrl) return;

  let relativePath: string | null = null;

  if (fileUrl.startsWith("/media/images/")) {
    relativePath = fileUrl.replace("/media/images/", "uploads/images/");
  } else if (fileUrl.startsWith("/media/videos/")) {
    relativePath = fileUrl.replace("/media/videos/", "uploads/videos/");
  } else if (fileUrl.startsWith("/uploads/")) {
    relativePath = fileUrl.replace(/^\/+/, "");
  }

  if (!relativePath) return;

  const absolutePath = path.join(process.cwd(), "public", relativePath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    console.warn("DELETE FILE WARNING:", absolutePath, error);
  }
}

async function requireAdminUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return session.user;
}

async function resolveAuthorIdFromSession(user: {
  id?: string | null;
  email?: string | null;
}) {
  if (user.id) return user.id;

  if (!user.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  return dbUser?.id ?? null;
}

async function createMediaAction(formData: FormData) {
  "use server";

  const user = await requireAdminUser();

  try {
    const rawType = String(formData.get("type") ?? "IMAGE").toUpperCase();
    if (!isValidMediaType(rawType)) {
      return redirect("/dashboard/media?error=invalid_type");
    }

    const type = rawType;
    const title = String(formData.get("title") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim() || null;
    const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
    const active = formData.get("active") === "true";
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return redirect("/dashboard/media?error=missing_file");
    }

    const saved = await saveUploadedFile(file, type);
    const authorId = await resolveAuthorIdFromSession(user);

    await prisma.homeMedia.create({
      data: {
        type,
        title,
        description,
        sortOrder,
        active,
        url: saved.url,
        ...(authorId ? { authorId } : {}),
      },
    });

    revalidateMediaPages();
  } catch (error) {
    console.error("CREATE MEDIA ERROR:", error);

    const code = error instanceof Error ? error.message : "upload_failed";

    if (
      code === "missing_file" ||
      code === "empty_file" ||
      code === "file_too_large" ||
      code === "invalid_mime" ||
      code === "mime_mismatch"
    ) {
      return redirect(`/dashboard/media?error=${code}`);
    }

    return redirect("/dashboard/media?error=upload_failed");
  }

  return redirect("/dashboard/media?status=created");
}

async function updateMediaAction(formData: FormData) {
  "use server";

  await requireAdminUser();

  let oldUrlToDelete: string | null = null;

  try {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return redirect("/dashboard/media?error=not_found");
    }

    const existing = await prisma.homeMedia.findUnique({
      where: { id },
    });

    if (!existing) {
      return redirect("/dashboard/media?error=not_found");
    }

    const rawType = String(formData.get("type") ?? existing.type).toUpperCase();
    if (!isValidMediaType(rawType)) {
      return redirect("/dashboard/media?error=invalid_type");
    }

    const type = rawType;
    const title = String(formData.get("title") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim() || null;
    const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
    const active = formData.get("active") === "true";
    const file = formData.get("file");

    let nextUrl = existing.url;

    if (file instanceof File && file.size > 0) {
      const saved = await saveUploadedFile(file, type);
      nextUrl = saved.url;

      if (existing.url !== nextUrl) {
        oldUrlToDelete = existing.url;
      }
    }

    await prisma.homeMedia.update({
      where: { id },
      data: {
        type,
        title,
        description,
        sortOrder,
        active,
        url: nextUrl,
      },
    });

    if (oldUrlToDelete) {
      await deleteLocalFile(oldUrlToDelete);
    }

    revalidateMediaPages();
  } catch (error) {
    console.error("UPDATE MEDIA ERROR:", error);

    const code = error instanceof Error ? error.message : "update_failed";

    if (
      code === "invalid_type" ||
      code === "empty_file" ||
      code === "file_too_large" ||
      code === "invalid_mime" ||
      code === "mime_mismatch" ||
      code === "not_found"
    ) {
      return redirect(`/dashboard/media?error=${code}`);
    }

    return redirect("/dashboard/media?error=update_failed");
  }

  return redirect("/dashboard/media?status=updated");
}

async function deleteMediaAction(formData: FormData) {
  "use server";

  await requireAdminUser();

  let fileUrlToDelete: string | null = null;

  try {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return redirect("/dashboard/media?error=not_found");
    }

    const existing = await prisma.homeMedia.findUnique({
      where: { id },
    });

    if (!existing) {
      return redirect("/dashboard/media?error=not_found");
    }

    fileUrlToDelete = existing.url;

    await prisma.homeMedia.delete({
      where: { id },
    });

    if (fileUrlToDelete) {
      await deleteLocalFile(fileUrlToDelete);
    }

    revalidateMediaPages();
  } catch (error) {
    console.error("DELETE MEDIA ERROR:", error);
    return redirect("/dashboard/media?error=delete_failed");
  }

  return redirect("/dashboard/media?status=deleted");
}

function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm text-white/60">
        Seite <span className="font-semibold text-white">{currentPage}</span> von{" "}
        <span className="font-semibold text-white">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/media?page=${Math.max(1, currentPage - 1)}`}
          aria-disabled={currentPage <= 1}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage <= 1
              ? "pointer-events-none border-white/10 bg-white/[0.03] text-white/30"
              : "border-white/10 bg-[#07090f] text-white hover:border-blue-400/40 hover:bg-blue-500/10"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </Link>

        <Link
          href={`/dashboard/media?page=${Math.min(totalPages, currentPage + 1)}`}
          aria-disabled={currentPage >= totalPages}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage >= totalPages
              ? "pointer-events-none border-white/10 bg-white/[0.03] text-white/30"
              : "border-white/10 bg-[#07090f] text-white hover:border-blue-400/40 hover:bg-blue-500/10"
          }`}
        >
          Weiter
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default async function AdminMediaPage(props: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const searchParams = await props.searchParams;
  const currentPage = parsePage(searchParams.page);

  const totalCount = await prisma.homeMedia.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const mediaItems = await prisma.homeMedia.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip,
    take: PAGE_SIZE,
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

  const imageCount = await prisma.homeMedia.count({
    where: { type: "IMAGE" },
  });

  const videoCount = await prisma.homeMedia.count({
    where: { type: "VIDEO" },
  });

  const activeCount = await prisma.homeMedia.count({
    where: { active: true },
  });

  const statusMessage = getStatusMessage(searchParams.status);
  const errorMessage = getErrorMessage(searchParams.error);

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Shield className="h-4 w-4" />
              Media Verwaltung
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Media verwalten
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Neue und bearbeitete Einträge erscheinen immer oben. Pro Seite
                werden 5 Einträge angezeigt.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white/60">
            {totalCount} Medien gesamt
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Gesamt
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {totalCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Alle Media-Einträge</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Images
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {imageCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Bilder für Home</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Videos
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {videoCount}
          </div>
          <div className="mt-2 text-sm text-white/50">Videos für Home</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Aktiv
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {activeCount}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Sichtbare Startseiten-Medien
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <Plus className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/50">Upload</div>
            <h2 className="text-2xl font-semibold text-white">
              Neues Medium hochladen
            </h2>
          </div>
        </div>

        <form
          action={createMediaAction}
          encType="multipart/form-data"
          className="grid gap-5"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Typ
              </label>
              <select
                name="type"
                defaultValue="IMAGE"
                className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
              >
                <option value="IMAGE">IMAGE</option>
                <option value="VIDEO">VIDEO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Sortierung
              </label>
              <input
                type="number"
                name="sortOrder"
                defaultValue={0}
                min={0}
                className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              Titel
            </label>
            <input
              type="text"
              name="title"
              placeholder="z. B. ArcadiaX Screenshot"
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              Beschreibung
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Kurze Beschreibung"
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              Datei
            </label>
            <input
              type="file"
              name="file"
              accept="image/*,video/*"
              required
              className="block w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="active-create"
              type="checkbox"
              name="active"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-white/20 bg-[#07090f]"
            />
            <label htmlFor="active-create" className="text-sm text-white/70">
              Aktiv
            </label>
          </div>

          <div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
            >
              <Upload className="h-4 w-4 text-blue-300" />
              <span>Medium hochladen</span>
            </button>
          </div>
        </form>
      </section>

      <Pagination currentPage={safePage} totalPages={totalPages} />

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/40">
              Bibliothek
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Vorhandene Medien
            </h2>
          </div>

          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/55 md:block">
            Seite {safePage} / {totalPages}
          </div>
        </div>

        {mediaItems.length === 0 ? (
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8 text-white/55">
            Noch keine Medien vorhanden.
          </div>
        ) : (
          <div className="space-y-6">
            {mediaItems.map((item) => (
              <article
                key={item.id}
                className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/75">
                        {item.type === "IMAGE" ? (
                          <ImageIcon className="h-3.5 w-3.5 text-blue-300" />
                        ) : (
                          <Film className="h-3.5 w-3.5 text-blue-300" />
                        )}
                        {item.type}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          item.active
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/[0.03] text-white/55"
                        }`}
                      >
                        {item.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#07090f]">
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

                    <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-[#07090f] p-4 text-xs text-white/45">
                      <p>
                        <span className="text-white/65">URL:</span> {item.url}
                      </p>
                      <p>
                        <span className="text-white/65">Sortierung:</span>{" "}
                        {item.sortOrder}
                      </p>
                      <p>
                        <span className="text-white/65">Autor:</span>{" "}
                        {getAuthorName(item)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
                        <Pencil className="h-5 w-5 text-blue-300" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/50">
                          Bearbeiten
                        </div>
                        <h3 className="text-2xl font-semibold text-white">
                          Medium bearbeiten
                        </h3>
                      </div>
                    </div>

                    <form
                      action={updateMediaAction}
                      encType="multipart/form-data"
                      className="grid gap-4"
                    >
                      <input type="hidden" name="id" value={item.id} />

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/70">
                            Typ
                          </label>
                          <select
                            name="type"
                            defaultValue={item.type}
                            className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
                          >
                            <option value="IMAGE">IMAGE</option>
                            <option value="VIDEO">VIDEO</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/70">
                            Sortierung
                          </label>
                          <input
                            type="number"
                            name="sortOrder"
                            min={0}
                            defaultValue={item.sortOrder}
                            className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Titel
                        </label>
                        <input
                          type="text"
                          name="title"
                          defaultValue={item.title ?? ""}
                          className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Beschreibung
                        </label>
                        <textarea
                          name="description"
                          rows={3}
                          defaultValue={item.description ?? ""}
                          className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Neue Datei vom PC
                        </label>
                        <input
                          type="file"
                          name="file"
                          accept="image/*,video/*"
                          className="block w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                        />
                        <p className="mt-2 text-xs text-white/45">
                          Optional. Wenn du keine neue Datei auswählst, bleibt
                          die aktuelle Datei erhalten.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          id={`active-${item.id}`}
                          type="checkbox"
                          name="active"
                          value="true"
                          defaultChecked={item.active}
                          className="h-4 w-4 rounded border-white/20 bg-[#07090f]"
                        />
                        <label
                          htmlFor={`active-${item.id}`}
                          className="text-sm text-white/70"
                        >
                          Aktiv
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
                        >
                          <Layers3 className="h-4 w-4 text-blue-300" />
                          <span>Änderungen speichern</span>
                        </button>
                      </div>
                    </form>

                    <form action={deleteMediaAction} className="mt-4">
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/30 hover:bg-red-500/15"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Medium löschen</span>
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Pagination currentPage={safePage} totalPages={totalPages} />
    </div>
  );
}