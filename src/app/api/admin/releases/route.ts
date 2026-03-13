import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

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
  role?: string | null;
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

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = getSessionUser(session);

  if (!user?.id || user.role !== "ADMIN") {
    return {
      ok: false as const,
      response: NextResponse.redirect(new URL("/login", "http://localhost")),
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

function sanitizeFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);

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

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "release"
  );
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function saveUploadedFile(
  file: File,
  targetDir: string,
  publicBasePath: string
) {
  await ensureDir(targetDir);

  const safeName = sanitizeFileName(file.name);
  const finalName = `${Date.now()}-${safeName}`;
  const finalPath = path.join(targetDir, finalName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(finalPath, bytes);

  return {
    absolutePath: finalPath,
    publicUrl: `${publicBasePath}/${finalName}`,
  };
}

async function deleteFileIfExists(absolutePath: string | null) {
  if (!absolutePath) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch {
    // absichtlich ignorieren
  }
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

function redirectToNewWithSuccess(request: NextRequest, message: string) {
  const url = new URL("/dashboard/releases/new", request.url);
  url.searchParams.set("success", message);
  return NextResponse.redirect(url, 303);
}

function redirectToNewWithError(request: NextRequest, message: string) {
  const url = new URL("/dashboard/releases/new", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  let savedImagePath: string | null = null;
  let savedFilePath: string | null = null;

  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      const url = new URL("/login", request.url);
      return NextResponse.redirect(url, 303);
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

    if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
      return redirectToNewWithError(
        request,
        "Bitte wähle eine Release-Datei aus."
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return redirectToNewWithError(
        request,
        "Die Release-Datei ist zu groß. Maximal erlaubt sind 1 GB."
      );
    }

    const imageEntry = formData.get("image");
    const imageFile =
      imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;

    if (imageFile) {
      const imageMime = imageFile.type?.trim();

      if (!imageMime || !IMAGE_MIME_TYPES.has(imageMime)) {
        return redirectToNewWithError(
          request,
          "Ungültiges Bildformat. Erlaubt sind JPG, PNG, WEBP, GIF, AVIF und SVG."
        );
      }

      if (imageFile.size > MAX_IMAGE_SIZE) {
        return redirectToNewWithError(
          request,
          "Das Bild ist zu groß. Maximal erlaubt sind 10 MB."
        );
      }
    }

    const uploadsRoot = path.join(process.cwd(), "public", "uploads", "releases");
    const filesDir = path.join(uploadsRoot, "files");
    const imagesDir = path.join(uploadsRoot, "images");

    const savedReleaseFile = await saveUploadedFile(
      fileEntry,
      filesDir,
      "/uploads/releases/files"
    );
    savedFilePath = savedReleaseFile.absolutePath;

    let imageUrl: string | null = null;

    if (imageFile) {
      const savedImage = await saveUploadedFile(
        imageFile,
        imagesDir,
        "/uploads/releases/images"
      );
      savedImagePath = savedImage.absolutePath;
      imageUrl = savedImage.publicUrl;
    }

    const baseSlug = slugify(slugInput || title);
    const uniqueSlug = await createUniqueSlug(baseSlug);

    const createdRelease = await prisma.release.create({
      data: {
        title,
        version,
        slug: uniqueSlug,
        description,
        changelog,
        fileUrl: savedReleaseFile.publicUrl,
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
    revalidatePath("/releases");
    revalidatePath(`/releases/${createdRelease.slug}`);
    revalidatePath(`/dashboard/releases/${createdRelease.id}`);
    revalidatePath(`/dashboard/releases/${createdRelease.id}/edit`);

    return redirectToNewWithSuccess(
      request,
      createdRelease.status === "PUBLISHED"
        ? "Release wurde erfolgreich erstellt und veröffentlicht."
        : "Release wurde erfolgreich als Entwurf gespeichert."
    );
  } catch (error) {
    await deleteFileIfExists(savedImagePath);
    await deleteFileIfExists(savedFilePath);

    console.error("POST /api/admin/releases error:", error);

    return redirectToNewWithError(
      request,
      "Beim Erstellen des Releases ist ein Fehler aufgetreten."
    );
  }
}