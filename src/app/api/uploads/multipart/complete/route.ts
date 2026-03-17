import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { completeMultipartUpload } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type CompletePart = {
  ETag?: string;
  PartNumber?: number;
};

type CompleteBody = {
  key?: string;
  uploadId?: string;
  parts?: CompletePart[];
};

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
        { error: "Nur Admins dürfen Multipart-Uploads abschließen." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as CompleteBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const key = String(body.key ?? "").trim();
    const uploadId = String(body.uploadId ?? "").trim();
    const rawParts = Array.isArray(body.parts) ? body.parts : [];

    if (!key) {
      return NextResponse.json(
        { error: "Key fehlt." },
        { status: 400 }
      );
    }

    if (!uploadId) {
      return NextResponse.json(
        { error: "UploadId fehlt." },
        { status: 400 }
      );
    }

    if (rawParts.length === 0) {
      return NextResponse.json(
        { error: "Keine Upload-Parts übergeben." },
        { status: 400 }
      );
    }

    const parts = rawParts
      .map((part) => {
        const etag = String(part?.ETag ?? "").trim();
        const partNumberRaw = part?.PartNumber;
        const partNumber =
          typeof partNumberRaw === "number"
            ? partNumberRaw
            : Number.parseInt(String(partNumberRaw ?? ""), 10);

        return {
          ETag: etag,
          PartNumber: partNumber,
        };
      })
      .filter(
        (part) =>
          Boolean(part.ETag) &&
          Number.isInteger(part.PartNumber) &&
          part.PartNumber > 0
      );

    if (parts.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Upload-Parts vorhanden." },
        { status: 400 }
      );
    }

    const result = await completeMultipartUpload({
      key,
      uploadId,
      parts,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("multipart complete error:", error);

    return NextResponse.json(
      { error: "Multipart-Upload konnte nicht abgeschlossen werden." },
      { status: 500 }
    );
  }
}