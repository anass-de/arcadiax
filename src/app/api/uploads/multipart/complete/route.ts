import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { completeMultipartUpload } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
};

type CompleteBody = {
  key?: string;
  uploadId?: string;
  parts?: Array<{
    ETag?: string;
    PartNumber?: number;
  }>;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const body = (await request.json()) as CompleteBody;
    const key = body.key?.trim();
    const uploadId = body.uploadId?.trim();
    const parts = Array.isArray(body.parts) ? body.parts : [];

    if (!key || !uploadId) {
      return NextResponse.json({ error: "key oder uploadId fehlt." }, { status: 400 });
    }

    if (!parts.length) {
      return NextResponse.json({ error: "Multipart-Teile fehlen." }, { status: 400 });
    }

    const normalizedParts = parts
      .filter(
        (part): part is { ETag: string; PartNumber: number } =>
          typeof part?.ETag === "string" &&
          !!part.ETag.trim() &&
          typeof part?.PartNumber === "number" &&
          Number.isInteger(part.PartNumber) &&
          part.PartNumber > 0
      )
      .map((part) => ({
        ETag: part.ETag.replaceAll('"', ""),
        PartNumber: part.PartNumber,
      }));

    if (!normalizedParts.length) {
      return NextResponse.json({ error: "Ungültige Multipart-Teile." }, { status: 400 });
    }

    const result = await completeMultipartUpload({
      key,
      uploadId,
      parts: normalizedParts,
    });

    return NextResponse.json({
      ok: true,
      key: result.key,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error("Upload complete error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Multipart-Upload konnte nicht abgeschlossen werden.",
      },
      { status: 500 }
    );
  }
}