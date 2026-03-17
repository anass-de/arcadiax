import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { abortMultipartUpload } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type AbortBody = {
  key?: string;
  uploadId?: string;
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
        { error: "Nur Admins dürfen Multipart-Uploads abbrechen." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as AbortBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const key = String(body.key ?? "").trim();
    const uploadId = String(body.uploadId ?? "").trim();

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

    const result = await abortMultipartUpload({
      key,
      uploadId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("multipart abort error:", error);

    return NextResponse.json(
      { error: "Multipart-Upload konnte nicht abgebrochen werden." },
      { status: 500 }
    );
  }
}