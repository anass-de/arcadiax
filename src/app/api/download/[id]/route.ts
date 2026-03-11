import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function buildRedirectUrl(fileUrl: string, req: NextRequest) {
  const trimmed = fileUrl.trim();

  if (!trimmed) {
    throw new Error("fileUrl is empty");
  }

  // Absolute URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return new URL(trimmed);
  }

  // Relative URL -> gegen aktuelle Origin auflösen
  return new URL(trimmed, req.url);
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const release = await prisma.release.findUnique({
      where: { id },
      select: {
        id: true,
        fileUrl: true,
        status: true,
      },
    });

    if (!release) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    if (release.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Release is not published" },
        { status: 403 }
      );
    }

    if (!release.fileUrl || !release.fileUrl.trim()) {
      return NextResponse.json(
        { error: "Release file URL is missing" },
        { status: 400 }
      );
    }

    await prisma.release.update({
      where: { id: release.id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    const redirectUrl = buildRedirectUrl(release.fileUrl, req);

    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error("GET /api/download/[id] error:", error);

    return NextResponse.json(
      {
        error: "Failed to process download",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}