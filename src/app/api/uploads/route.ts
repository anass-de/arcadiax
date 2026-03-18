import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  buildR2Key,
  createMultipartUpload,
  createPresignedUploadUrl,
  isValidFolder,
} from "@/lib/r2";

type SessionUser = {
  id?: string | null;
};

type UploadKind = "image" | "release";

type UploadBody = {
  folder?: string;
  slug?: string;
  fileName?: string;
  fileSize?: number | string;
  contentType?: string;
  kind?: UploadKind;
};

const DEFAULT_PART_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_RELEASE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const ALLOWED_RELEASE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "application/pdf",
  "application/x-7z-compressed",
  "application/vnd.rar",
] as const;

function parseFileSize(value: UploadBody["fileSize"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const body = (await request.json()) as UploadBody;

    const folder = body.folder?.trim();
    const slug = body.slug?.trim() || undefined;
    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();
    const kind: UploadKind = body.kind === "image" ? "image" : "release";
    const fileSize = parseFileSize(body.fileSize);

    if (!folder || !isValidFolder(folder)) {
      return NextResponse.json({ error: "Ungültiger Upload-Ordner." }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ error: "Dateiname fehlt." }, { status: 400 });
    }

    if (!contentType) {
      return NextResponse.json({ error: "Content-Type fehlt." }, { status: 400 });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "Ungültige Dateigröße." }, { status: 400 });
    }

    if (kind === "image") {
      if (
        !ALLOWED_IMAGE_TYPES.includes(
          contentType as (typeof ALLOWED_IMAGE_TYPES)[number]
        )
      ) {
        return NextResponse.json({ error: "Bildtyp nicht erlaubt." }, { status: 400 });
      }

      if (fileSize > MAX_IMAGE_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: "Bilder dürfen maximal 20 MB groß sein." },
          { status: 400 }
        );
      }
    } else {
      if (
        !ALLOWED_RELEASE_TYPES.includes(
          contentType as (typeof ALLOWED_RELEASE_TYPES)[number]
        )
      ) {
        return NextResponse.json({ error: "Dateityp nicht erlaubt." }, { status: 400 });
      }

      if (fileSize > MAX_RELEASE_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: "Release-Dateien dürfen maximal 30 GB groß sein." },
          { status: 400 }
        );
      }
    }

    const key = buildR2Key({
      folder,
      slug,
      fileName,
    });

    if (fileSize <= DEFAULT_PART_SIZE) {
      const single = await createPresignedUploadUrl({
        key,
        contentType,
      });

      return NextResponse.json({
        ok: true,
        mode: "single",
        key: single.key,
        uploadUrl: single.uploadUrl,
        publicUrl: single.publicUrl,
      });
    }

    const multipart = await createMultipartUpload({
      key,
      contentType,
    });

    return NextResponse.json({
      ok: true,
      mode: "multipart",
      key: multipart.key,
      uploadId: multipart.uploadId,
      publicUrl: multipart.publicUrl,
      partSize: DEFAULT_PART_SIZE,
      totalParts: Math.ceil(fileSize / DEFAULT_PART_SIZE),
    });
  } catch (error) {
    console.error("Uploads route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload konnte nicht vorbereitet werden.",
      },
      { status: 500 }
    );
  }
}