import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  buildR2Key,
  createMultipartUpload,
  createSingleUploadUrl,
  getPublicUrlForKey,
  isValidFolder,
  type UploadKind,
} from "@/lib/r2";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type StartBody = {
  folder?: string;
  slug?: string;
  fileName?: string;
  fileSize?: number | string;
  contentType?: string;
  kind?: UploadKind;
};

const SINGLE_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_RELEASE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB
const MULTIPART_PART_SIZE = 10 * 1024 * 1024; // 10 MB

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

function parseFileSize(value: StartBody["fileSize"]) {
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

    const body = (await request.json()) as StartBody;

    const folder = body.folder?.trim();
    const slug = body.slug?.trim();
    const fileName = body.fileName?.trim();
    const contentType = (body.contentType?.trim() || "application/octet-stream") as string;
    const fileSize = parseFileSize(body.fileSize);
    const kind = body.kind;

    if (!folder || !isValidFolder(folder)) {
      return NextResponse.json({ error: "Ungültiger folder." }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ error: "fileName fehlt." }, { status: 400 });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "Ungültige fileSize." }, { status: 400 });
    }

    if (kind !== "image" && kind !== "release") {
      return NextResponse.json({ error: "Ungültiger kind." }, { status: 400 });
    }

    if (kind === "image") {
      if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        return NextResponse.json(
          { error: "Ungültiger Bildtyp. Erlaubt: JPG, PNG, WEBP, GIF." },
          { status: 400 }
        );
      }

      if (fileSize > MAX_IMAGE_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: "Bild ist zu groß. Maximal 20 MB." },
          { status: 400 }
        );
      }
    }

    if (kind === "release") {
      if (
        !ALLOWED_RELEASE_TYPES.includes(
          contentType as (typeof ALLOWED_RELEASE_TYPES)[number]
        )
      ) {
        return NextResponse.json(
          { error: "Ungültiger Dateityp. Erlaubt: ZIP, PDF, 7Z, RAR." },
          { status: 400 }
        );
      }

      if (fileSize > MAX_RELEASE_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: "Datei ist zu groß. Maximal 30 GB." },
          { status: 400 }
        );
      }
    }

    const key = buildR2Key({
      folder,
      slug,
      fileName,
      kind,
      userId: user.id,
    });

    const publicUrl = getPublicUrlForKey(key);

    if (kind === "image" || fileSize <= SINGLE_UPLOAD_THRESHOLD) {
      const uploadUrl = await createSingleUploadUrl({
        key,
        contentType,
      });

      return NextResponse.json({
        ok: true,
        mode: "single",
        uploadUrl,
        publicUrl,
        key,
      });
    }

    const uploadId = await createMultipartUpload({
      key,
      contentType,
    });

    const totalParts = Math.ceil(fileSize / MULTIPART_PART_SIZE);

    return NextResponse.json({
      ok: true,
      mode: "multipart",
      uploadId,
      key,
      publicUrl,
      partSize: MULTIPART_PART_SIZE,
      totalParts,
    });
  } catch (error) {
    console.error("Upload start error:", error);

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