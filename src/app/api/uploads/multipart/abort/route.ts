import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { abortMultipartUpload } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
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
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const body = (await request.json()) as AbortBody;
    const key = body.key?.trim();
    const uploadId = body.uploadId?.trim();

    if (!key || !uploadId) {
      return NextResponse.json({ error: "key oder uploadId fehlt." }, { status: 400 });
    }

    await abortMultipartUpload({ key, uploadId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Upload abort error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Multipart-Upload konnte nicht abgebrochen werden.",
      },
      { status: 500 }
    );
  }
}