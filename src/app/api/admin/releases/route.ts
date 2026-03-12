import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

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
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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

function redirectWithStatus(request: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/releases?status=${status}`, request.url),
    303
  );
}

function redirectWithError(request: NextRequest, error: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/releases/new?error=${error}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  let savedImagePath: string | null = null;
  let savedFilePath: string | null = null;

  try {
    const auth = await requireAdmin();

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
    const statusRaw = String(formData.get("status") ?? "DRAFT")
      .trim()
      .toUpperCase();

    if (!title) {
      return redirectWithError(request, "missing_title");
    }

    if (!version) {
      return redirectWithError(request, "missing_version");
    }

    if (statusRaw !== "DRAFT" && statusRaw !== "PUBLISHED") {
      return redirectWithError(request, "invalid_status");
    }

    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
      return redirectWithError(request, "missing_file");
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return redirectWithError(request, "file_too_large");
    }

    const imageEntry = formData.get("image");
    const imageFile =
      imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;

    if (imageFile) {
      const imageMime = imageFile.type?.trim();

      if (!imageMime || !IMAGE_MIME_TYPES.has(imageMime)) {
        return redirectWithError(request, "invalid_image_type");
      }

      if (imageFile.size > MAX_IMAGE_SIZE) {
        return redirectWithError(request, "image_too_large");
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

    await prisma.release.create({
      data: {
        title,
        version,
        slug: uniqueSlug,
        description,
        changelog,
        fileUrl: savedReleaseFile.publicUrl,
        imageUrl,
        status: statusRaw,
        authorId: userId,
      },
    });

    return redirectWithStatus(request, "created");
  } catch (error) {
    await deleteFileIfExists(savedImagePath);
    await deleteFileIfExists(savedFilePath);

    console.error("POST /api/admin/releases error:", error);

    return redirectWithError(request, "create_failed");
  }
}