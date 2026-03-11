import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SessionUser = {
  id?: string | null;
};

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

function getSessionUserId(
  session: Awaited<ReturnType<typeof getServerSession>>
) {
  return (session?.user as SessionUser | undefined)?.id ?? null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const release = await prisma.release.findFirst({
      where: {
        id,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        fileUrl: true,
      },
    });

    if (!release) {
      return NextResponse.json(
        { error: "Release nicht gefunden oder nicht veröffentlicht." },
        { status: 404 }
      );
    }

    if (!release.fileUrl?.trim()) {
      return NextResponse.json(
        { error: "Für dieses Release ist keine Datei hinterlegt." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = getSessionUserId(session);
    const ip = getClientIp(request);

    await prisma.$transaction([
      prisma.release.update({
        where: {
          id: release.id,
        },
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      }),
      prisma.download.create({
        data: {
          releaseId: release.id,
          userId,
          ip,
        },
      }),
    ]);

    return NextResponse.redirect(release.fileUrl, {
      status: 307,
    });
  } catch (error) {
    console.error("Download-API Fehler:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler beim Starten des Downloads." },
      { status: 500 }
    );
  }
}