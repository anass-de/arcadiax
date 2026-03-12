import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    type: string;
    fileName: string;
  }>;
};

function getContentType(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";

  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";

  return "application/octet-stream";
}

export async function GET(_: Request, context: RouteContext) {
  const { type, fileName } = await context.params;

  if (type !== "images" && type !== "videos") {
    return NextResponse.json({ error: "Invalid media type." }, { status: 400 });
  }

  const safeFileName = path.basename(fileName);
  const absolutePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    type,
    safeFileName,
  );

  try {
    const fileBuffer = await fs.readFile(absolutePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": getContentType(safeFileName),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}