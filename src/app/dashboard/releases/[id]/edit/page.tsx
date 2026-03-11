import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ImageIcon,
  Save,
  Shield,
  Upload,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase ist nicht korrekt konfiguriert. NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function uploadFileToStorage(args: {
  file: File;
  folder: string;
  fileNamePrefix: string;
}) {
  const supabase = getSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "arcadiax";

  const buffer = Buffer.from(await args.file.arrayBuffer());
  const safeOriginalName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = `${args.folder}/${Date.now()}-${args.fileNamePrefix}-${safeOriginalName}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: args.file.type || "application/octet-stream",
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return publicUrl;
}

export default async function EditReleasePage({ params }: PageProps) {
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
    select: {
      id: true,
      title: true,
      slug: true,
      version: true,
      description: true,
      fileUrl: true,
      imageUrl: true,
      downloads: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  if (!release) {
    notFound();
  }

  async function updateReleaseAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      redirect("/");
    }

    const releaseId = String(formData.get("releaseId") || "").trim();

    if (!releaseId) {
      throw new Error("Ungültige Release-ID.");
    }

    const title = String(formData.get("title") || "").trim();
    const version = String(formData.get("version") || "").trim();
    const status = String(formData.get("status") || "").trim().toUpperCase();

    const slugInput = normalizeOptional(formData.get("slug"));
    const description = normalizeOptional(formData.get("description"));

    const imageFile = formData.get("imageFile");
    const releaseFile = formData.get("releaseFile");

    if (!title) {
      throw new Error("Titel darf nicht leer sein.");
    }

    if (!version) {
      throw new Error("Version darf nicht leer sein.");
    }

    if (status !== "DRAFT" && status !== "PUBLISHED") {
      throw new Error("Ungültiger Status.");
    }

    const existing = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        slug: true,
        imageUrl: true,
        fileUrl: true,
      },
    });

    if (!existing) {
      throw new Error("Release nicht gefunden.");
    }

    let nextImageUrl = existing.imageUrl;
    let nextFileUrl = existing.fileUrl;

    const safeSlug = slugInput ? slugify(slugInput) : null;
    const releaseSlugOrId = safeSlug || existing.slug || releaseId;
    const baseFolder = `releases/${releaseSlugOrId}`;

    if (imageFile instanceof File && imageFile.size > 0) {
      nextImageUrl = await uploadFileToStorage({
        file: imageFile,
        folder: `${baseFolder}/images`,
        fileNamePrefix: "image",
      });
    }

    if (releaseFile instanceof File && releaseFile.size > 0) {
      nextFileUrl = await uploadFileToStorage({
        file: releaseFile,
        folder: `${baseFolder}/files`,
        fileNamePrefix: "release",
      });
    }

    if (!nextFileUrl) {
      throw new Error(
        "Es muss mindestens eine Release-Datei vorhanden sein. Bitte wähle eine Datei vom Computer aus."
      );
    }

    await prisma.release.update({
      where: {
        id: releaseId,
      },
      data: {
        title,
        version,
        status: status as "DRAFT" | "PUBLISHED",
        slug: safeSlug,
        description,
        imageUrl: nextImageUrl,
        fileUrl: nextFileUrl,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/releases");
    revalidatePath(`/dashboard/releases/${releaseId}/edit`);
    revalidatePath("/releases");
    revalidatePath(existing.slug ? `/releases/${existing.slug}` : `/releases/${releaseId}`);
    revalidatePath(safeSlug ? `/releases/${safeSlug}` : `/releases/${releaseId}`);

    redirect("/dashboard/releases");
  }

  const publicHref = release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Shield className="h-4 w-4" />
              Release Bearbeiten
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {release.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Bearbeite Titel, Version und Status. Bild und Release-Datei
                kannst du direkt vom Computer neu auswählen.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Zurück zu Releases</span>
            </Link>

            <Link
              href={publicHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
            >
              <ExternalLink className="h-4 w-4 text-blue-300" />
              <span>Öffentlich ansehen</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Status
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release.status}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Aktueller Veröffentlichungsstatus
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Downloads
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release.downloads}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Gesamtzahl der Downloads
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Kommentare
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release._count.comments}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Community-Aktivität zum Release
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Aktualisiert
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {formatDateTime(release.updatedAt)}
          </div>
          <div className="mt-2 text-sm text-white/50">
            Letzte Änderung
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          action={updateReleaseAction}
          className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8"
        >
          <input type="hidden" name="releaseId" value={release.id} />

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
              <FileText className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/50">Formular</div>
              <h2 className="text-2xl font-semibold text-white">
                Release-Daten bearbeiten
              </h2>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Titel
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={release.title}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="z. B. ArcadiaX"
                />
              </div>

              <div>
                <label
                  htmlFor="version"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Version
                </label>
                <input
                  id="version"
                  name="version"
                  defaultValue={release.version}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="z. B. 1.0.0"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Slug
                </label>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={release.slug ?? ""}
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="z. B. arcadiax"
                />
                <p className="mt-2 text-xs text-white/40">
                  Optional. Wird für die öffentliche URL verwendet.
                </p>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={release.status}
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/30"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Beschreibung
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={release.description ?? ""}
                rows={7}
                className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                placeholder="Beschreibe das Release, Funktionen, Änderungen oder Hinweise..."
              />
            </div>

            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="imageFile"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Neues Bild vom Computer
                </label>
                <input
                  id="imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/*"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                <p className="mt-2 text-xs text-white/40">
                  Optional. Wenn du nichts auswählst, bleibt das aktuelle Bild erhalten.
                </p>
              </div>

              <div>
                <label
                  htmlFor="releaseFile"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Neue Release-Datei vom Computer
                </label>
                <input
                  id="releaseFile"
                  name="releaseFile"
                  type="file"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                <p className="mt-2 text-xs text-white/40">
                  Optional. Wenn du nichts auswählst, bleibt die aktuelle Release-Datei erhalten.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <Save className="h-4 w-4 text-blue-300" />
                <span>Änderungen speichern</span>
              </button>

              <Link
                href="/dashboard/releases"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Abbrechen</span>
              </Link>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
                <ImageIcon className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/50">Vorschau</div>
                <h2 className="text-2xl font-semibold text-white">
                  Aktuelles Bild & Datei
                </h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#07090f]">
                <div className="flex h-[260px] w-full items-center justify-center border-b border-white/10 bg-gradient-to-br from-[#0a0d14] via-[#090b11] to-[#06080d]">
                  {release.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={release.imageUrl}
                      alt={release.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-white/35">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <ImageIcon className="h-8 w-8 text-blue-300/80" />
                      </div>
                      <span className="text-sm">Kein Vorschaubild vorhanden</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                      Aktuelles Bild
                    </div>
                    <div className="mt-2 text-sm text-white/70">
                      {release.imageUrl ? "Bild vorhanden" : "Kein Bild gespeichert"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                      Aktuelle Datei
                    </div>
                    <div className="mt-2 text-sm text-white/70">
                      {release.fileUrl ? "Datei vorhanden" : "Keine Datei gespeichert"}
                    </div>
                  </div>

                  {release.fileUrl ? (
                    <Link
                      href={release.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Aktuelle Datei öffnen</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6 sm:p-8">
            <div className="text-sm font-medium text-white/50">Metadaten</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Erstellt
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(release.createdAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Letzte Aktualisierung
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(release.updatedAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Öffentliche URL
                </div>
                <div className="mt-2 break-all text-sm font-semibold text-white">
                  {publicHref}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}