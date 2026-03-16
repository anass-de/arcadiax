import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImageIcon,
  Shield,
  Upload,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import SubmitButton from "@/components/SubmitButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

type SessionUser = {
  id?: string | null;
  role?: "USER" | "ADMIN" | null;
  email?: string | null;
  name?: string | null;
};

function getSessionUser(
  session: Awaited<ReturnType<typeof getServerSession>>
): SessionUser | null {
  if (!session) {
    return null;
  }

  const maybeSession = session as { user?: unknown };

  if (!maybeSession.user || typeof maybeSession.user !== "object") {
    return null;
  }

  return maybeSession.user as SessionUser;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function normalizeOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeMessage(value?: string | null) {
  const text = value?.trim();
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

function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "arcadiax";
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured correctly. NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function extractStoragePathFromPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) {
    return null;
  }

  const bucket = getStorageBucket();

  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.pathname.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function removeFileFromStorage(publicUrl: string | null | undefined) {
  const filePath = extractStoragePathFromPublicUrl(publicUrl);

  if (!filePath) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    console.error("Could not delete old file:", error.message);
  }
}

async function uploadFileToStorage(args: {
  file: File;
  folder: string;
  fileNamePrefix: string;
}) {
  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  const buffer = Buffer.from(await args.file.arrayBuffer());
  const safeOriginalName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = `${args.folder}/${Date.now()}-${args.fileNamePrefix}-${safeOriginalName}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: args.file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return publicUrl;
}

function validateImageFile(file: File) {
  const maxSize = 10 * 1024 * 1024;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid image format. Allowed: JPG, PNG, WEBP, and GIF.");
  }

  if (file.size > maxSize) {
    throw new Error("The image is too large. Maximum allowed size is 10 MB.");
  }
}

function validateReleaseFile(file: File) {
  const maxSize = 500 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error("The release file is too large. Maximum allowed size is 500 MB.");
  }
}

async function createUniqueSlug(baseSlug: string, releaseId: string) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.release.findFirst({
      where: {
        slug,
        NOT: {
          id: releaseId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

function buildEditUrl(
  releaseId: string,
  params: Record<string, string | null | undefined>
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();

  return queryString
    ? `/dashboard/releases/${releaseId}/edit?${queryString}`
    : `/dashboard/releases/${releaseId}/edit`;
}

function getStatusLabel(status: "DRAFT" | "PUBLISHED") {
  return status === "PUBLISHED" ? "Published" : "Draft";
}

function getStatusClasses(status: "DRAFT" | "PUBLISHED") {
  if (status === "PUBLISHED") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border border-white/10 bg-white/[0.03] text-white/70";
}

export default async function EditReleasePage({
  params,
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);
  const sessionUser = getSessionUser(session);

  if (!sessionUser) {
    redirect("/login?callbackUrl=/dashboard/releases");
  }

  if (sessionUser.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const successMessage = normalizeMessage(resolvedSearchParams.success);

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
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: true,
          downloads: true,
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
    const sessionUser = getSessionUser(session);

    if (!sessionUser || sessionUser.role !== "ADMIN") {
      redirect("/");
    }

    const releaseId = String(formData.get("releaseId") || "").trim();

    if (!releaseId) {
      redirect(buildEditUrl(id, { error: "Invalid release ID." }));
    }

    try {
      const title = String(formData.get("title") || "").trim();
      const version = String(formData.get("version") || "").trim();
      const status = String(formData.get("status") || "")
        .trim()
        .toUpperCase();

      const slugInput = normalizeOptional(formData.get("slug"));
      const description = normalizeOptional(formData.get("description"));

      const imageFile = formData.get("imageFile");
      const releaseFile = formData.get("releaseFile");

      if (!title) {
        throw new Error("Title cannot be empty.");
      }

      if (!version) {
        throw new Error("Version cannot be empty.");
      }

      if (status !== "DRAFT" && status !== "PUBLISHED") {
        throw new Error("Invalid status.");
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
        throw new Error("Release not found.");
      }

      let nextImageUrl = existing.imageUrl;
      let nextFileUrl = existing.fileUrl;
      let nextSlug = existing.slug;

      if (slugInput !== null) {
        const normalizedSlug = slugify(slugInput);

        if (!normalizedSlug) {
          throw new Error("The slug is invalid.");
        }

        nextSlug = await createUniqueSlug(normalizedSlug, releaseId);
      }

      const releaseSlugOrId = nextSlug || existing.slug || releaseId;
      const baseFolder = `releases/${releaseSlugOrId}`;

      if (imageFile instanceof File && imageFile.size > 0) {
        validateImageFile(imageFile);

        const uploadedImageUrl = await uploadFileToStorage({
          file: imageFile,
          folder: `${baseFolder}/images`,
          fileNamePrefix: "image",
        });

        await removeFileFromStorage(existing.imageUrl);
        nextImageUrl = uploadedImageUrl;
      }

      if (releaseFile instanceof File && releaseFile.size > 0) {
        validateReleaseFile(releaseFile);

        const uploadedFileUrl = await uploadFileToStorage({
          file: releaseFile,
          folder: `${baseFolder}/files`,
          fileNamePrefix: "release",
        });

        await removeFileFromStorage(existing.fileUrl);
        nextFileUrl = uploadedFileUrl;
      }

      if (!nextFileUrl) {
        throw new Error(
          "At least one release file is required. Please choose a file from your computer."
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
          slug: nextSlug,
          description,
          imageUrl: nextImageUrl,
          fileUrl: nextFileUrl,
        },
      });

      revalidatePath("/");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/releases");
      revalidatePath(`/dashboard/releases/${releaseId}/edit`);
      revalidatePath("/releases");
      revalidatePath(
        existing.slug ? `/releases/${existing.slug}` : `/releases/${releaseId}`
      );
      revalidatePath(
        nextSlug ? `/releases/${nextSlug}` : `/releases/${releaseId}`
      );
    } catch (error) {
      console.error("Error updating release:", error);

      const message =
        error instanceof Error
          ? error.message
          : "An unknown error occurred while saving.";

      redirect(
        buildEditUrl(releaseId, {
          error: message,
        })
      );
    }

    redirect(
      buildEditUrl(releaseId, {
        success: "Your changes have been saved successfully.",
      })
    );
  }

  const publicHref = release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(108,92,231,0.05),transparent)]" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6c5ce7]/30 bg-[#6c5ce7]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#9d8dff]">
              <Shield className="h-4 w-4" />
              Edit Release
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {release.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                Update the title, version, slug, status, and description. You can
                also replace the current image and release file directly from your
                computer.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#6c5ce7]/40 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Releases</span>
            </Link>

            <Link
              href={publicHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" />
              <span>View Public Page</span>
            </Link>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-[28px] border border-red-500/20 bg-red-500/10 p-4 text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <div className="font-semibold">Save failed</div>
            <p className="mt-1 text-sm text-red-100/90">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-3 rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <div className="font-semibold">Saved successfully</div>
            <p className="mt-1 text-sm text-emerald-100/90">
              {successMessage}
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Status
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${getStatusClasses(
                release.status
              )}`}
            >
              {getStatusLabel(release.status)}
            </span>
          </div>
          <div className="mt-3 text-sm text-white/60">
            Current publication status
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Downloads
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release._count.downloads}
          </div>
          <div className="mt-2 text-sm text-white/60">
            Total number of downloads
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Comments
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release._count.comments}
          </div>
          <div className="mt-2 text-sm text-white/60">
            Community activity for this release
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Updated
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {formatDateTime(release.updatedAt)}
          </div>
          <div className="mt-2 text-sm text-white/60">Latest update</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          action={updateReleaseAction}
          className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8"
        >
          <input type="hidden" name="releaseId" value={release.id} />

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <FileText className="h-5 w-5 text-[#9d8dff]" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/45">Form</div>
              <h2 className="text-2xl font-semibold text-white">
                Edit Release Details
              </h2>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={release.title}
                  required
                  placeholder="e.g. ArcadiaX"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
                />
              </div>

              <div>
                <label
                  htmlFor="version"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Version
                </label>
                <input
                  id="version"
                  name="version"
                  defaultValue={release.version}
                  required
                  placeholder="e.g. 1.0.0"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Slug
                </label>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={release.slug ?? ""}
                  placeholder="e.g. arcadiax"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
                />
                <p className="mt-2 text-xs text-white/45">
                  Optional. Used for the public URL.
                </p>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={release.status}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-white/75"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={release.description ?? ""}
                rows={7}
                placeholder="Describe the release, features, changes, or important notes..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05]"
              />
            </div>

            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="imageFile"
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75"
                >
                  <ImageIcon className="h-4 w-4 text-[#9d8dff]" />
                  Upload New Image
                </label>
                <input
                  id="imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 file:mr-4 file:rounded-xl file:border-0 file:bg-[#6c5ce7]/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                <p className="mt-2 text-xs text-white/45">
                  Optional. If you do not select a file, the current image will be kept.
                </p>
              </div>

              <div>
                <label
                  htmlFor="releaseFile"
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75"
                >
                  <Upload className="h-4 w-4 text-[#9d8dff]" />
                  Upload New Release File
                </label>
                <input
                  id="releaseFile"
                  name="releaseFile"
                  type="file"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 file:mr-4 file:rounded-xl file:border-0 file:bg-[#6c5ce7]/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                <p className="mt-2 text-xs text-white/45">
                  Optional. If you do not select a file, the current release file will be kept.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <SubmitButton />

              <Link
                href="/dashboard/releases"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#6c5ce7]/40 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Cancel</span>
              </Link>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <ImageIcon className="h-5 w-5 text-[#9d8dff]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/45">Preview</div>
                <h2 className="text-2xl font-semibold text-white">
                  Current Image & File
                </h2>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
              <div className="flex h-[260px] w-full items-center justify-center border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
                {release.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.imageUrl}
                    alt={release.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/45">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <ImageIcon className="h-8 w-8 text-[#9d8dff]/80" />
                    </div>
                    <span className="text-sm">No preview image available</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                    Current Image
                  </div>
                  <div className="mt-2 text-sm text-white/75">
                    {release.imageUrl ? "Image available" : "No image saved"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                    Current File
                  </div>
                  <div className="mt-2 text-sm text-white/75">
                    {release.fileUrl ? "File available" : "No file saved"}
                  </div>
                </div>

                {release.fileUrl ? (
                  <Link
                    href={release.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-[#6c5ce7]/40 hover:text-white"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Open Current File</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <div className="text-sm font-medium text-white/45">Metadata</div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Created
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(release.createdAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Last Updated
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(release.updatedAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Public URL
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