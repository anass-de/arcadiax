import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
  name?: string | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type MediaType = "IMAGE" | "VIDEO";

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

function sanitizeFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "file";

  const safeExt = ext.replace(/[^\w.]+/g, "");

  return `${safeBase}${safeExt}`;
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function validateType(type: string): type is MediaType {
  return type === "IMAGE" || type === "VIDEO";
}

function ensureMimeMatchesType(type: MediaType, mimeType: string) {
  if (type === "IMAGE") {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  return VIDEO_MIME_TYPES.has(mimeType);
}

function getMaxSizeForType(type: MediaType) {
  return type === "IMAGE" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
}

function getUploadSubfolder(type: MediaType) {
  return type === "IMAGE" ? "images" : "videos";
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function saveUploadedFile(file: File, type: MediaType) {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const subfolder = getUploadSubfolder(type);
  const targetDir = path.join(uploadsRoot, subfolder);

  await ensureDir(targetDir);

  const safeName = sanitizeFileName(file.name);
  const finalName = `${Date.now()}-${safeName}`;
  const finalPath = path.join(targetDir, finalName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(finalPath, bytes);

  return {
    absolutePath: finalPath,
    publicUrl: `/uploads/${subfolder}/${finalName}`,
  };
}

function isLocalUploadUrl(url: string | null | undefined) {
  return Boolean(url && url.startsWith("/uploads/"));
}

function getAbsolutePathFromPublicUrl(url: string | null | undefined) {
  if (!url || !isLocalUploadUrl(url)) {
    return null;
  }

  const relativePath = url.replace(/^\/+/, "");
  const normalized = path.normalize(relativePath);

  if (!normalized || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }

  return path.join(process.cwd(), "public", normalized);
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

async function deleteFileByPublicUrlIfLocal(url: string | null | undefined) {
  const absolutePath = getAbsolutePathFromPublicUrl(url);
  await deleteFileIfExists(absolutePath);
}

function redirectToFirstPage(
  request: NextRequest,
  status: "updated" | "deleted" | "error",
  errorCode?: string
) {
  const url =
    status === "error"
      ? `/dashboard/media?page=1&error=${errorCode || "update_failed"}`
      : `/dashboard/media?page=1&status=${status}`;

  return NextResponse.redirect(new URL(url, request.url), 303);
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
    user,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;

    const media = await prisma.homeMedia.findUnique({
      where: { id },
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

    if (!media) {
      return NextResponse.json(
        { error: "Medium nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({ media });
  } catch (error) {
    console.error("GET /api/admin/media/[id] error:", error);

    return NextResponse.json(
      { error: "Fehler beim Laden des Mediums." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  let savedAbsolutePath: string | null = null;

  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const formData = await request.formData();
    const method = String(formData.get("_method") ?? "")
      .trim()
      .toUpperCase();

    if (method === "DELETE") {
      const existing = await prisma.homeMedia.findUnique({
        where: { id },
      });

      if (!existing) {
        return redirectToFirstPage(request, "error", "not_found");
      }

      await prisma.homeMedia.delete({
        where: { id },
      });

      await deleteFileByPublicUrlIfLocal(existing.url);

      return redirectToFirstPage(request, "deleted");
    }

    if (method !== "PATCH") {
      return redirectToFirstPage(request, "error", "invalid_method");
    }

    const existing = await prisma.homeMedia.findUnique({
      where: { id },
    });

    if (!existing) {
      return redirectToFirstPage(request, "error", "not_found");
    }

    const typeRaw = String(formData.get("type") ?? existing.type)
      .trim()
      .toUpperCase();

    if (!validateType(typeRaw)) {
      return redirectToFirstPage(request, "error", "invalid_type");
    }

    const type: MediaType = typeRaw;
    const title = normalizeOptionalText(formData.get("title"));
    const description = normalizeOptionalText(formData.get("description"));
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const active = parseBoolean(formData.get("active"));

    let url = existing.url;

    const fileEntry = formData.get("file");

    if (fileEntry instanceof File && fileEntry.size > 0) {
      const mimeType = fileEntry.type?.trim();

      if (!mimeType) {
        return redirectToFirstPage(request, "error", "invalid_mime");
      }

      if (!ensureMimeMatchesType(type, mimeType)) {
        return redirectToFirstPage(request, "error", "mime_mismatch");
      }

      const maxSize = getMaxSizeForType(type);

      if (fileEntry.size > maxSize) {
        return redirectToFirstPage(request, "error", "file_too_large");
      }

      const saved = await saveUploadedFile(fileEntry, type);
      savedAbsolutePath = saved.absolutePath;
      url = saved.publicUrl;
    }

    const oldUrl = existing.url;

    await prisma.homeMedia.update({
      where: { id },
      data: {
        type,
        title,
        description,
        url,
        sortOrder,
        active,
      },
    });

    const oldAbsolutePath = getAbsolutePathFromPublicUrl(oldUrl);
    const newAbsolutePath = getAbsolutePathFromPublicUrl(url);

    if (oldAbsolutePath && oldAbsolutePath !== newAbsolutePath) {
      await deleteFileIfExists(oldAbsolutePath);
    }

    return redirectToFirstPage(request, "updated");
  } catch (error) {
    await deleteFileIfExists(savedAbsolutePath);
    console.error("POST /api/admin/media/[id] error:", error);

    return redirectToFirstPage(request, "error", "update_failed");
  }
}