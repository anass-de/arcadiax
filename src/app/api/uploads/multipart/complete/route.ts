import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { completeMultipartUpload, getPublicUrlForKey } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
};

type CompleteBody = {
  key?: string;
  uploadId?: string;
  parts?: Array<{
    ETag?: string;
    PartNumber?: number | string;
  }>;
};

function normalizeParts(parts: CompleteBody["parts"]) {
  if (!Array.isArray(parts)) return [];

  return parts
    .map((part) => {
      const etag = typeof part?.ETag === "string" ? part.ETag.trim() : "";
      const partNumber =
        typeof part?.PartNumber === "number"
          ? part.PartNumber
          : Number(part?.PartNumber);

      return {
        ETag: etag,
        PartNumber: partNumber,
      };
    })
    .filter(
      (part) => part.ETag && Number.isInteger(part.PartNumber) && part.PartNumber > 0
    ) as Array<{ ETag: string; PartNumber: number }>;
}

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
    const parts = normalizeParts(body.parts);

    if (!key) {
      return NextResponse.json({ error: "key fehlt." }, { status: 400 });
    }

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId fehlt." }, { status: 400 });
    }

    if (!parts.length) {
      return NextResponse.json(
        { error: "Es wurden keine gültigen Parts übergeben." },
        { status: 400 }
      );
    }

    await completeMultipartUpload({
      key,
      uploadId,
      parts,
    });

    return NextResponse.json({
      ok: true,
      key,
      publicUrl: getPublicUrlForKey(key),
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