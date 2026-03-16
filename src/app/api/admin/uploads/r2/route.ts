import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildR2ObjectKey, createPresignedUploadUrl } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

type UploadKind = "image" | "release";

type UploadRequestBody = {
  fileName?: string;
  contentType?: string;
  size?: number;
  slug?: string;
  title?: string;
  kind?: UploadKind;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function slugify(value: string) {
  const slug =
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "release";

  return slug.slice(0, 120);
}

function sanitizeContentType(value?: string) {
  const text = String(value ?? "").trim().toLowerCase();
  return text || "application/octet-stream";
}

function validateImageUpload(contentType: string, size: number) {
  if (!IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error(
      "Ungültiges Bildformat. Erlaubt sind JPG, PNG, WEBP, GIF, AVIF und SVG."
    );
  }

  if (size <= 0) {
    throw new Error("Die Bilddatei ist leer.");
  }

  if (size > MAX_IMAGE_SIZE) {
    throw new Error("Das Bild ist zu groß. Maximal erlaubt sind 10 MB.");
  }
}

function validateReleaseUpload(size: number) {
  if (size <= 0) {
    throw new Error("Bitte wähle eine Release-Datei aus.");
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error("Die Release-Datei ist zu groß. Maximal erlaubt sind 30 GB.");
  }
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false as const, response: jsonError("Nicht eingeloggt.", 401) };
  }

  if (session.user.role !== "ADMIN") {
    return { ok: false as const, response: jsonError("Kein Zugriff.", 403) };
  }

  return { ok: true as const, session };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json().catch(() => null)) as UploadRequestBody | null;

    if (!body || typeof body !== "object") {
      return jsonError("Ungültige Anfrage. Es wurden keine gültigen JSON-Daten gesendet.");
    }

    const fileName = String(body.fileName ?? "").trim();
    const size =
      typeof body.size === "number" && Number.isFinite(body.size) ? body.size : 0;
    const kind: UploadKind = body.kind === "image" ? "image" : "release";
    const contentType = sanitizeContentType(body.contentType);
    const slugSource = String(body.slug ?? body.title ?? "release").trim();
    const releaseSlug = slugify(slugSource || "release");

    if (!fileName) {
      return jsonError("Dateiname fehlt.");
    }

    if (!releaseSlug) {
      return jsonError("Slug oder Titel fehlt.");
    }

    if (kind === "image") {
      try {
        validateImageUpload(contentType, size);
      } catch (error) {
        return jsonError(
          error instanceof Error ? error.message : "Ungültige Bilddatei."
        );
      }
    } else {
      try {
        validateReleaseUpload(size);
      } catch (error) {
        return jsonError(
          error instanceof Error
            ? error.message
            : "Ungültige Release-Datei."
        );
      }
    }

    const folder =
      kind === "image"
        ? `releases/${releaseSlug}/images`
        : `releases/${releaseSlug}/files`;

    const key = buildR2ObjectKey({
      folder,
      fileName,
      prefix: kind,
    });

    const signed = await createPresignedUploadUrl({
      key,
      contentType,
      expiresIn: 60 * 10,
    });

    return NextResponse.json({
      ok: true,
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
      key: signed.key,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      maxSize:
        kind === "image"
          ? MAX_IMAGE_SIZE
          : MAX_FILE_SIZE,
    });
  } catch (error) {
    console.error("POST /api/admin/uploads/r2 error:", error);
    return jsonError("Interner Serverfehler.", 500);
  }
}