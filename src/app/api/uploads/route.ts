import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  buildR2Key,
  createPresignedUploadUrl,
  isValidFolder,
} from "@/lib/r2";

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
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
] as const;

const MAX_SINGLE_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

type UploadBody = {
  fileName?: string;
  fileType?: string;
  fileSize?: number | string;
  folder?: string;
  slug?: string;
};

function sanitizeSlug(value?: string) {
  return (
    (value ?? "general")
      .trim()
      .toLowerCase()
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "general"
  );
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur Admins dürfen Dateien hochladen." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as UploadBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      );
    }

    const fileName = String(body.fileName ?? "").trim();
    const fileType = String(body.fileType ?? "").trim();
    const folder = String(body.folder ?? "").trim();
    const slug = sanitizeSlug(body.slug);

    const rawFileSize = body.fileSize;
    const fileSize =
      typeof rawFileSize === "number"
        ? rawFileSize
        : Number.parseInt(String(rawFileSize ?? ""), 10);

    if (!fileName) {
      return NextResponse.json({ error: "Dateiname fehlt." }, { status: 400 });
    }

    if (!fileType) {
      return NextResponse.json({ error: "Dateityp fehlt." }, { status: 400 });
    }

    if (!isValidFolder(folder)) {
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
            "Die Datei ist zu groß für den direkten Upload. Bitte hierfür kleinere Dateien verwenden.",
        },
        { status: 400 }
      );
    }

    const allowedTypes: readonly string[] =
      folder === "media" ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES;

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: `Dateityp nicht erlaubt: ${fileType}` },
        { status: 400 }
      );
    }

    const key = buildR2Key({
      folder,
      slug,
      fileName,
    });

    const result = await createPresignedUploadUrl({
      key,
      contentType: fileType,
      expiresIn: 60 * 60,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("uploads route presign error:", error);

    return NextResponse.json(
      { error: "Presigned URL konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}