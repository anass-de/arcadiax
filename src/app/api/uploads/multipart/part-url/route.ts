import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createMultipartPartUploadUrl } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type PartBody = {
  key?: string;
  uploadId?: string;
  partNumber?: number | string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur Admins dürfen Upload-Parts signieren." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as PartBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const key = String(body.key ?? "").trim();
    const uploadId = String(body.uploadId ?? "").trim();
    const partNumberRaw = body.partNumber;
    const partNumber =
      typeof partNumberRaw === "number"
        ? partNumberRaw
        : Number.parseInt(String(partNumberRaw ?? ""), 10);

    if (!key) {
      return NextResponse.json({ error: "Key fehlt." }, { status: 400 });
    }

    if (!uploadId) {
      return NextResponse.json({ error: "UploadId fehlt." }, { status: 400 });
    }

    if (!Number.isInteger(partNumber) || partNumber < 1) {
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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("multipart part presign error:", error);

    return NextResponse.json(
      { error: "Part-Upload-URL konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}