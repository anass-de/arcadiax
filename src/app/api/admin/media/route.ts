import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
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
  role?: "USER" | "ADMIN" | null;
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
      response: NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 }),
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

function isMediaType(value: string): value is MediaType {
  return value === "IMAGE" || value === "VIDEO";
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

async function removeFileFromStorageByPublicUrl(
  publicUrl: string | null | undefined
) {
  const filePath = extractStoragePathFromPublicUrl(publicUrl);

  if (!filePath) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    console.error(
      "Konnte Datei nicht aus Supabase Storage löschen:",
      error.message
    );
  }
}

async function removeFilesFromStorage(filePaths: string[]) {
  const uniquePaths = [...new Set(filePaths.filter(Boolean))];

  if (uniquePaths.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);

  if (error) {
    console.error(
      "Rollback in Supabase Storage fehlgeschlagen:",
      error.message
    );
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

function validateFileForType(file: File, selectedType: MediaType) {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Eine Datei ist erforderlich.");
  }

  const mimeType = file.type?.trim();

  if (!mimeType) {
    throw new Error("Ungültiger MIME-Typ.");
  }

  if (selectedType === "IMAGE" && !IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(
      "Für Bilder sind nur JPG, PNG, WEBP, GIF, AVIF und SVG erlaubt."
    );
  }

  if (selectedType === "VIDEO" && !VIDEO_MIME_TYPES.has(mimeType)) {
    throw new Error("Für Videos sind nur MP4, WEBM, OGG und MOV erlaubt.");
  }

  const maxSize = getMaxSizeForType(selectedType);

  if (file.size > maxSize) {
    throw new Error(
      selectedType === "IMAGE"
        ? "Das Bild ist zu groß. Maximal erlaubt sind 10 MB."
        : "Das Video ist zu groß. Maximal erlaubt sind 200 MB."
    );
  }
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
      { error: "Medien konnten nicht geladen werden." },
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

    const typeRaw = String(formData.get("type") ?? "")
      .trim()
      .toUpperCase();

    if (!isMediaType(typeRaw)) {
      return NextResponse.json(
        { error: "Bitte wähle einen gültigen Medientyp aus." },
        { status: 400 }
      );
    }

    const selectedType: MediaType = typeRaw;
    const title = normalizeOptionalText(formData.get("title"));
    const description = normalizeOptionalText(formData.get("description"));
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const active = parseBoolean(formData.get("active"));

    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Eine Datei ist erforderlich." },
        { status: 400 }
      );
    }

    try {
      validateFileForType(fileEntry, selectedType);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Die Datei ist ungültig.",
        },
        { status: 400 }
      );
    }

    const folder = selectedType === "IMAGE" ? "media/images" : "media/videos";

    const uploaded = await uploadFileToStorage({
      file: fileEntry,
      folder,
      fileNamePrefix: selectedType.toLowerCase(),
    });

    uploadedPaths.push(uploaded.filePath);

    const media = await prisma.homeMedia.create({
      data: {
        type: selectedType,
        title,
        description,
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

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/media");

    return NextResponse.json(
      {
        ok: true,
        media,
      },
      { status: 201 }
    );
  } catch (error) {
    await removeFilesFromStorage(uploadedPaths);

    console.error("POST /api/admin/media error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Medium konnte nicht erstellt werden.",
      },
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
        { error: "Medium wurde nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.homeMedia.delete({
      where: { id },
    });

    await removeFileFromStorageByPublicUrl(existing.url);

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/media");

    return NextResponse.json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/admin/media error:", error);

    return NextResponse.json(
      { error: "Medium konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}