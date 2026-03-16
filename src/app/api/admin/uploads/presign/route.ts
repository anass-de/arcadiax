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
];

const ALLOWED_FILE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/pdf",
];

const MAX_SINGLE_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

function isValidFolder(folder: string) {
  return ["releases", "media", "avatars"].includes(folder);
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

    const body = await request.json();

    const fileName = String(body?.fileName ?? "").trim();
    const fileType = String(body?.fileType ?? "").trim();
    const folder = String(body?.folder ?? "uploads").trim();
    const slug = String(body?.slug ?? "general").trim();
    const fileSize = Number(body?.fileSize ?? 0);

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "Dateiname oder Dateityp fehlt." },
        { status: 400 }
      );
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
            "Die Datei ist zu groß für den aktuellen Direkt-Upload. Bitte vorerst maximal 500 MB hochladen.",
        },
        { status: 400 }
      );
    }

    const allowedTypes =
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
      expiresIn: 3600,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Presign upload error:", error);

    return NextResponse.json(
      { error: "Presigned URL konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}