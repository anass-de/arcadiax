import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { abortMultipartUpload } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
};

type AbortBody = {
  key: string;
  uploadId: string;
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

    const body = (await request.json()) as AbortBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const { key, uploadId } = body;

    if (!key?.trim() || !uploadId?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Abort-Anfrage." },
        { status: 400 }
      );
    }

    await abortMultipartUpload({
      key,
      uploadId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("multipart abort error:", error);

    return NextResponse.json(
      { error: "Multipart-Upload konnte nicht abgebrochen werden." },
      { status: 500 }
    );
  }
}