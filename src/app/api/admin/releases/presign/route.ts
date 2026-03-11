// src/app/api/admin/releases/presign/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/auth";

type UploadKind = "file" | "image";

type RequestBody = {
  kind?: UploadKind;
  fileName?: string;
  contentType?: string;
  size?: number;
  slug?: string;
  title?: string;
  version?: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "file.bin";
}

function buildObjectPath(kind: UploadKind, slug: string, fileName: string) {
  const safeSlug = slugify(slug) || `release-${Date.now()}`;
  const safeFileName = sanitizeFileName(fileName);
  const timestamp = Date.now();

  if (kind === "image") {
    return `releases/${safeSlug}/images/${timestamp}-${safeFileName}`;
  }

  return `releases/${safeSlug}/files/${timestamp}-${safeFileName}`;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    if ((session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;

    const kind: UploadKind = body.kind === "image" ? "image" : "file";
    const fileName = String(body.fileName || "").trim();
    const contentType = String(body.contentType || "application/octet-stream").trim();
    const size = Number(body.size || 0);
    const slug = String(body.slug || body.title || "").trim();

    if (!fileName) {
      return NextResponse.json({ error: "fileName fehlt." }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "slug oder title fehlt." }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Ungültige Dateigröße." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL fehlt." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY fehlt." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const bucket = "arcadiax";
    const path = buildObjectPath(kind, slug, fileName);

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, {
        upsert: true,
      });

    if (error || !data?.token) {
      return NextResponse.json(
        {
          error: error?.message || "Signed upload URL konnte nicht erstellt werden.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bucket,
      path,
      token: String(data.token).trim(),
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
      fileName: sanitizeFileName(fileName),
      contentType,
      size,
      kind,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Serverfehler.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}