// src/app/api/admin/releases/upload/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    if ((session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const uploadToken = request.headers.get("x-upload-token")?.trim() ?? "";
    const uploadPath = request.headers.get("x-upload-path")?.trim() ?? "";
    const uploadBucket = request.headers.get("x-upload-bucket")?.trim() ?? "";
    const uploadContentType =
      request.headers.get("x-upload-content-type")?.trim() ||
      "application/octet-stream";

    if (!uploadToken) {
      return NextResponse.json({ error: "x-upload-token fehlt." }, { status: 400 });
    }

    if (!uploadPath) {
      return NextResponse.json({ error: "x-upload-path fehlt." }, { status: 400 });
    }

    if (!uploadBucket) {
      return NextResponse.json({ error: "x-upload-bucket fehlt." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file fehlt." }, { status: 400 });
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

    const arrayBuffer = await file.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from(uploadBucket)
      .uploadToSignedUrl(uploadPath, uploadToken, body, {
        contentType: uploadContentType,
        upsert: true,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Upload fehlgeschlagen." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Serverfehler.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}