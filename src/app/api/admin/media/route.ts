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

export async function GET() {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const media = await prisma.homeMedia.findMany({
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
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

    return NextResponse.json({ media });
  } catch (error) {
    console.error("GET /api/admin/media error:", error);

    return NextResponse.json(
      { error: "Fehler beim Laden der Medien." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let savedAbsolutePath: string | null = null;

  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.user.id;
    const formData = await request.formData();

    const typeRaw = String(formData.get("type") ?? "")
      .trim()
      .toUpperCase();

    if (!validateType(typeRaw)) {
      return NextResponse.json(
        { error: "Ungültiger Medientyp." },
        { status: 400 }
      );
    }

    const type: MediaType = typeRaw;
    const title = normalizeOptionalText(formData.get("title"));
    const description = normalizeOptionalText(formData.get("description"));
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const active = parseBoolean(formData.get("active"));

    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
      return NextResponse.json(
        { error: "Datei ist erforderlich." },
        { status: 400 }
      );
    }

    const mimeType = fileEntry.type?.trim();

    if (!mimeType) {
      return NextResponse.json(
        { error: "Ungültiger MIME-Typ." },
        { status: 400 }
      );
    }

    if (!ensureMimeMatchesType(type, mimeType)) {
      return NextResponse.json(
        { error: "Dateityp passt nicht zum ausgewählten Medientyp." },
        { status: 400 }
      );
    }

    const maxSize = getMaxSizeForType(type);

    if (fileEntry.size > maxSize) {
      return NextResponse.json(
        { error: "Datei ist zu groß." },
        { status: 400 }
      );
    }

    const saved = await saveUploadedFile(fileEntry, type);
    savedAbsolutePath = saved.absolutePath;

    const media = await prisma.homeMedia.create({
      data: {
        type,
        title,
        description,
        url: saved.publicUrl,
        sortOrder,
        active,
        authorId: userId,
      },
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

    return NextResponse.json(
      {
        ok: true,
        media,
      },
      { status: 201 }
    );
  } catch (error) {
    await deleteFileIfExists(savedAbsolutePath);
    console.error("POST /api/admin/media error:", error);

    return NextResponse.json(
      { error: "Fehler beim Erstellen des Mediums." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { error: "Media-ID fehlt." },
        { status: 400 }
      );
    }

    const existing = await prisma.homeMedia.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Medium nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.homeMedia.delete({
      where: { id },
    });

    await deleteFileByPublicUrlIfLocal(existing.url);

    return NextResponse.json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/admin/media error:", error);

    return NextResponse.json(
      { error: "Fehler beim Löschen des Mediums." },
      { status: 500 }
    );
  }
}