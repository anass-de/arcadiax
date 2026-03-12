import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SessionUser = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
  name?: string | null;
};

function getSessionUser(
  session: Awaited<ReturnType<typeof getServerSession>>
): SessionUser | null {
  if (!session) {
    return null;
  }

  const maybeSession = session as { user?: unknown };

  if (!maybeSession.user || typeof maybeSession.user !== "object") {
    return null;
  }

  return maybeSession.user as SessionUser;
}

function getClientIp(request: NextRequest) {
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

function buildRedirectUrl(fileUrl: string, request: NextRequest) {
  const trimmed = fileUrl.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return new URL(trimmed, request.url).toString();
  }

  return new URL(`/${trimmed}`, request.url).toString();
}

export async function GET(request: NextRequest, context: RouteContext) {
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
    const user = getSessionUser(session);
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
          userId: user?.id ?? null,
          ip,
        },
      }),
    ]);

    const redirectUrl = buildRedirectUrl(release.fileUrl, request);

    if (!redirectUrl) {
      return NextResponse.json(
        { error: "Ungültige Download-URL." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(redirectUrl, {
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