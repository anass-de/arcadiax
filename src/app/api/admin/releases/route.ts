import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

type SessionUser = {
  id?: string | null;
  role?: "USER" | "ADMIN" | null;
  email?: string | null;
  name?: string | null;
};

type AdminSessionUser = {
  id: string;
  role: "ADMIN";
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

async function requireAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = getSessionUser(session);

  if (!user?.id || user.role !== "ADMIN") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", "/dashboard/releases/new");

    return {
      ok: false as const,
      response: NextResponse.redirect(loginUrl, 303),
    };
  }

  return {
    ok: true as const,
    user: user as AdminSessionUser,
  };
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function slugify(value: string) {
  const slug =
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "release";

  return slug.slice(0, 120);
}

function sanitizeFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const base = lastDot >= 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "file";

  const safeExt = ext.replace(/[^\w.]+/g, "");

  return `${safeBase}${safeExt}`;
}

function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "arcadiax";
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

async function createUniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.release.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
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
  const safeOriginalName = sanitizeFileName(args.file.name);
  const filePath = `${args.folder}/${Date.now()}-${args.fileNamePrefix}-${safeOriginalName}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: args.file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    filePath,
    publicUrl,
  };
}

async function removeFilesFromStorage(filePaths: string[]) {
  if (filePaths.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  const uniquePaths = [...new Set(filePaths.filter(Boolean))];

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);

  if (error) {
    console.error(
      "Konnte Dateien aus Supabase Storage nicht löschen:",
      error.message
    );
  }
}

function redirectToNewWithError(request: NextRequest, message: string) {
  const url = new URL("/dashboard/releases/new", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

function redirectToEditWithSuccess(
  request: NextRequest,
  releaseId: string,
  message: string
) {
  const url = new URL(`/dashboard/releases/${releaseId}/edit`, request.url);
  url.searchParams.set("success", message);
  return NextResponse.redirect(url, 303);
}

function validateImageFile(file: File) {
  const imageMime = file.type?.trim();

  if (!imageMime || !IMAGE_MIME_TYPES.has(imageMime)) {
    throw new Error(
      "Ungültiges Bildformat. Erlaubt sind JPG, PNG, WEBP, GIF, AVIF und SVG."
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Das Bild ist zu groß. Maximal erlaubt sind 10 MB.");
  }
}

function validateReleaseFile(file: File) {
  if (file.size <= 0) {
    throw new Error("Bitte wähle eine Release-Datei aus.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Die Release-Datei ist zu groß. Maximal erlaubt sind 1 GB."
    );
  }
}

export async function POST(request: NextRequest) {
  const uploadedPaths: string[] = [];

  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.user.id;
    const formData = await request.formData();

    const title = String(formData.get("title") ?? "").trim();
    const version = String(formData.get("version") ?? "").trim();
    const slugInput = String(formData.get("slug") ?? "").trim();
    const description = normalizeOptionalText(formData.get("description"));
    const changelog = normalizeOptionalText(formData.get("changelog"));
    const statusRaw = String(formData.get("status") ?? "PUBLISHED")
      .trim()
      .toUpperCase();

    if (!title) {
      return redirectToNewWithError(request, "Titel darf nicht leer sein.");
    }

    if (!version) {
      return redirectToNewWithError(request, "Version darf nicht leer sein.");
    }

    if (statusRaw !== "DRAFT" && statusRaw !== "PUBLISHED") {
      return redirectToNewWithError(request, "Ungültiger Status.");
    }

    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return redirectToNewWithError(
        request,
        "Bitte wähle eine Release-Datei aus."
      );
    }

    try {
      validateReleaseFile(fileEntry);
    } catch (error) {
      return redirectToNewWithError(
        request,
        error instanceof Error
          ? error.message
          : "Die Release-Datei ist ungültig."
      );
    }

    const imageEntry = formData.get("image");
    const imageFile =
      imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;

    if (imageFile) {
      try {
        validateImageFile(imageFile);
      } catch (error) {
        return redirectToNewWithError(
          request,
          error instanceof Error ? error.message : "Das Bild ist ungültig."
        );
      }
    }

    const baseSlug = slugify(slugInput || title);
    const uniqueSlug = await createUniqueSlug(baseSlug);
    const baseFolder = `releases/${uniqueSlug}`;

    const uploadedReleaseFile = await uploadFileToStorage({
      file: fileEntry,
      folder: `${baseFolder}/files`,
      fileNamePrefix: "release",
    });
    uploadedPaths.push(uploadedReleaseFile.filePath);

    let imageUrl: string | null = null;

    if (imageFile) {
      const uploadedImage = await uploadFileToStorage({
        file: imageFile,
        folder: `${baseFolder}/images`,
        fileNamePrefix: "image",
      });

      uploadedPaths.push(uploadedImage.filePath);
      imageUrl = uploadedImage.publicUrl;
    }

    const createdRelease = await prisma.release.create({
      data: {
        title,
        version,
        slug: uniqueSlug,
        description,
        changelog,
        fileUrl: uploadedReleaseFile.publicUrl,
        imageUrl,
        status: statusRaw as "DRAFT" | "PUBLISHED",
        authorId: userId,
      },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/releases");
    revalidatePath("/dashboard/releases/new");
    revalidatePath(`/dashboard/releases/${createdRelease.id}/edit`);
    revalidatePath("/releases");
    revalidatePath(`/releases/${createdRelease.slug}`);

    return redirectToEditWithSuccess(
      request,
      createdRelease.id,
      createdRelease.status === "PUBLISHED"
        ? "Release wurde erfolgreich erstellt und veröffentlicht."
        : "Release wurde erfolgreich als Entwurf gespeichert."
    );
  } catch (error) {
    await removeFilesFromStorage(uploadedPaths);

    console.error("POST /api/admin/releases error:", error);

    return redirectToNewWithError(
      request,
      error instanceof Error
        ? error.message
        : "Beim Erstellen des Releases ist ein Fehler aufgetreten."
    );
  }
}