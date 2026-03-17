import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createMultipartPartUploadUrl } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
};

type PartUrlBody = {
  key: string;
  uploadId: string;
  partNumber: number;
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

    const body = (await request.json()) as PartUrlBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const { key, uploadId, partNumber } = body;

    if (!key?.trim() || !uploadId?.trim()) {
      return NextResponse.json(
        { error: "Key oder Upload-ID fehlt." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json(
        { error: "Ungültige Part-Nummer." },
        { status: 400 }
      );
    }

    const result = await createMultipartPartUploadUrl({
      key,
      uploadId,
      partNumber,
      expiresIn: 60 * 20,
    });

    return NextResponse.json(
      {
        uploadUrl: result.uploadUrl,
        partNumber: result.partNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("multipart part-url error:", error);

    return NextResponse.json(
      { error: "Part-URL konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}