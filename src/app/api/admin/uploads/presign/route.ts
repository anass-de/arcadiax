import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildR2Key, createPresignedUploadUrl } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const ALLOWED_FILE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "application/pdf",
] as const;

const MAX_SINGLE_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

function isValidFolder(folder: string): folder is "releases" | "media" | "avatars" {
  return ["releases", "media", "avatars"].includes(folder);
}

function sanitizeSlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "general"
  );
}

function inferUploadKind(params: {
  folder: "releases" | "media" | "avatars";
  fileType: string;
}): "image" | "release" {
  if (params.folder === "avatars") return "image";
  if (params.folder === "media") return "image";
  if (params.fileType.startsWith("image/")) return "image";
  return "release";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!user?.id) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur Admins dürfen Dateien hochladen." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const fileName = String(body.fileName ?? "").trim();
    const fileType = String(body.fileType ?? "").trim();
    const folderRaw = String(body.folder ?? "").trim();
    const slug = sanitizeSlug(String(body.slug ?? "general"));

    const rawFileSize = body.fileSize;
    const fileSize =
      typeof rawFileSize === "number"
        ? rawFileSize
        : Number.parseInt(String(rawFileSize ?? ""), 10);

    console.log("UPLOAD PRESIGN DEBUG", {
      fileName,
      fileType,
      folder: folderRaw,
      slug,
      rawFileSize,
      parsedFileSize: fileSize,
      maxSize: MAX_SINGLE_UPLOAD_SIZE,
      userId: user.id,
    });

    if (!fileName) {
      return NextResponse.json(
        { error: "Dateiname fehlt." },
        { status: 400 }
      );
    }

    if (!fileType) {
      return NextResponse.json(
        { error: "Dateityp fehlt." },
        { status: 400 }
      );
    }

    if (!isValidFolder(folderRaw)) {
      return NextResponse.json(
        { error: "Ungültiger Upload-Ordner." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Ungültige Dateigröße." },
        { status: 400 }
      );
    }

    if (fileSize > MAX_SINGLE_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          error:
            "Die Datei ist zu groß für den aktuellen Direkt-Upload. Bitte vorerst maximal 500 MB hochladen.",
        },
        { status: 400 }
      );
    }

    const allowedTypes: readonly string[] =
      folderRaw === "media" || folderRaw === "avatars"
        ? ALLOWED_IMAGE_TYPES
        : ALLOWED_FILE_TYPES;

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: `Dateityp nicht erlaubt: ${fileType}` },
        { status: 400 }
      );
    }

    const kind = inferUploadKind({
      folder: folderRaw,
      fileType,
    });

    const key = buildR2Key({
      folder: folderRaw,
      slug,
      fileName,
      kind,
      userId: user.id,
    });

    const result = await createPresignedUploadUrl({
      key,
      contentType: fileType,
    });

    console.log("UPLOAD PRESIGN SUCCESS", {
      key,
      kind,
      fileType,
      folder: folderRaw,
      slug,
      hasUploadUrl: Boolean(result?.uploadUrl),
      hasPublicUrl: Boolean(result?.publicUrl),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Presign upload error:", error);

    return NextResponse.json(
      { error: "Presigned URL konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}