import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

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
  "image/svg+xml",
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

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
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
      .slice(0, 80) || "file";

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

function detectMediaTypeFromMime(mimeType: string): MediaType | null {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return "IMAGE";
  }

  if (VIDEO_MIME_TYPES.has(mimeType)) {
    return "VIDEO";
  }

  return null;
}

function getMaxSizeForType(type: MediaType) {
  return type === "IMAGE" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
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

async function removeFileFromStorageByPublicUrl(publicUrl: string | null | undefined) {
  const filePath = extractStoragePathFromPublicUrl(publicUrl);

  if (!filePath) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    console.error("Konnte Datei aus Supabase Storage nicht löschen:", error.message);
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

export async function GET() {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const media = await prisma.homeMedia.findMany({
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
  const uploadedPaths: string[] = [];

  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.user.id!;
    const formData = await request.formData();

    const title = normalizeOptionalText(formData.get("title"));
    const description = normalizeOptionalText(formData.get("description"));
    const altText = normalizeOptionalText(formData.get("altText"));
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

    const detectedType = detectMediaTypeFromMime(mimeType);

    if (!detectedType) {
      return NextResponse.json(
        { error: "Ungültiger Medientyp." },
        { status: 400 }
      );
    }

    const maxSize = getMaxSizeForType(detectedType);

    if (fileEntry.size > maxSize) {
      return NextResponse.json(
        {
          error:
            detectedType === "IMAGE"
              ? "Bild ist zu groß. Maximal erlaubt sind 10 MB."
              : "Video ist zu groß. Maximal erlaubt sind 200 MB.",
        },
        { status: 400 }
      );
    }

    const folder =
      detectedType === "IMAGE" ? "media/images" : "media/videos";

    const uploaded = await uploadFileToStorage({
      file: fileEntry,
      folder,
      fileNamePrefix: detectedType.toLowerCase(),
    });

    uploadedPaths.push(uploaded.filePath);

    const media = await prisma.homeMedia.create({
      data: {
        type: detectedType,
        title,
        description,
        altText,
        url: uploaded.publicUrl,
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
    if (uploadedPaths.length > 0) {
      const supabase = getSupabaseAdmin();
      const bucket = getStorageBucket();

      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(uploadedPaths);

      if (removeError) {
        console.error(
          "Rollback in Supabase Storage fehlgeschlagen:",
          removeError.message
        );
      }
    }

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

    await removeFileFromStorageByPublicUrl(existing.url);

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