import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  buildR2Key,
  createMultipartUpload,
  isValidFolder,
  DEFAULT_PART_SIZE,
} from "@/lib/r2";
import { validateUploadInput, type UploadKind } from "@/lib/upload-rules";

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type StartBody = {
  folder: string;
  slug?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  kind: UploadKind;
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

    const body = (await request.json()) as StartBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    if (!isValidFolder(body.folder)) {
      return NextResponse.json(
        { error: "Ungültiger Upload-Ordner." },
        { status: 400 }
      );
    }

    const validationError = validateUploadInput({
      kind: body.kind,
      fileName: body.fileName,
      fileSize: body.fileSize,
      contentType: body.contentType,
    });

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const key = buildR2Key({
      folder: body.folder,
      slug: body.slug,
      fileName: body.fileName,
    });

    const result = await createMultipartUpload({
      key,
      contentType: body.contentType,
      metadata: {
        userId: user.id,
        originalName: body.fileName,
        kind: body.kind,
      },
    });

    return NextResponse.json(
      {
        uploadId: result.uploadId,
        key: result.key,
        publicUrl: result.publicUrl,
        partSize: DEFAULT_PART_SIZE,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("multipart start error:", error);

    return NextResponse.json(
      { error: "Multipart-Upload konnte nicht gestartet werden." },
      { status: 500 }
    );
  }
}