import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildR2Key, createMultipartUpload, isValidFolder } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type UploadKind = "image" | "release";

type StartBody = {
  folder?: string;
  slug?: string;
  fileName?: string;
  fileSize?: number | string;
  contentType?: string;
  kind?: UploadKind;
};

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_RELEASE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB

const ALLOWED_RELEASE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "application/pdf",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
] as const;

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
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur Admins dürfen Multipart-Uploads starten." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as StartBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const folder = String(body.folder ?? "").trim();
    const slug = sanitizeSlug(body.slug);
    const fileName = String(body.fileName ?? "").trim();
    const contentType = String(body.contentType ?? "").trim();
    const kind = String(body.kind ?? "").trim() as UploadKind;

    const rawFileSize = body.fileSize;
    const fileSize =
      typeof rawFileSize === "number"
        ? rawFileSize
        : Number.parseInt(String(rawFileSize ?? ""), 10);

    if (!isValidFolder(folder)) {
      return NextResponse.json(
        { error: "Ungültiger Upload-Ordner." },
        { status: 400 }
      );
    }

    if (folder !== "releases") {
      return NextResponse.json(
        { error: "Multipart ist nur für Release-Dateien erlaubt." },
        { status: 400 }
      );
    }

    if (kind !== "release") {
      return NextResponse.json(
        { error: "Ungültiger Upload-Typ für Multipart." },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        { error: "Dateiname fehlt." },
        { status: 400 }
      );
    }

    if (!contentType) {
      return NextResponse.json(
        { error: "Dateityp fehlt." },
        { status: 400 }
      );
    }

    if (!(ALLOWED_RELEASE_TYPES as readonly string[]).includes(contentType)) {
      return NextResponse.json(
        { error: `Dateityp nicht erlaubt: ${contentType}` },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Ungültige Dateigröße." },
        { status: 400 }
      );
    }

    if (fileSize > MAX_RELEASE_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "Release-Datei ist zu groß. Maximal 30 GB erlaubt." },
        { status: 400 }
      );
    }

    const key = buildR2Key({
      folder,
      slug,
      fileName,
    });

    const result = await createMultipartUpload({
      key,
      contentType,
      metadata: {
        userId: user.id,
        kind,
        originalName: fileName,
      },
    });

    return NextResponse.json(
      {
        uploadId: result.uploadId,
        key: result.key,
        publicUrl: result.publicUrl,
        partSize: DEFAULT_PART_SIZE,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("multipart start error:", error);

    return NextResponse.json(
      { error: "Multipart-Upload konnte nicht gestartet werden." },
      { status: 500 }
    );
  }
}