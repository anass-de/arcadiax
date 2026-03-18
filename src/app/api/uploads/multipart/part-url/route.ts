import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getMultipartPartUploadUrl } from "@/lib/r2";

type SessionUser = {
  id?: string | null;
};

type PartUrlBody = {
  key?: string;
  uploadId?: string;
  partNumber?: number | string;
};

function parsePartNumber(value: PartUrlBody["partNumber"]) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return NaN;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const body = (await request.json()) as PartUrlBody;

    const key = body.key?.trim();
    const uploadId = body.uploadId?.trim();
    const partNumber = parsePartNumber(body.partNumber);

    if (!key) {
      return NextResponse.json({ error: "key fehlt." }, { status: 400 });
    }

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId fehlt." }, { status: 400 });
    }

    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      return NextResponse.json({ error: "Ungültige partNumber." }, { status: 400 });
    }

    const uploadUrl = await getMultipartPartUploadUrl({
      key,
      uploadId,
      partNumber,
    });

    return NextResponse.json({
      ok: true,
      key,
      uploadId,
      partNumber,
      uploadUrl,
    });
  } catch (error) {
    console.error("Upload part-url error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Part-URL konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }
}