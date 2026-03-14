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
  role?: "ADMIN" | "USER" | null;
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

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).toString();
    }

    if (trimmed.startsWith("/")) {
      return new URL(trimmed, request.url).toString();
    }

    return new URL(`/${trimmed}`, request.url).toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    const { id } = await context.params;
    const releaseId = id?.trim();

    if (!user?.id) {
      const loginUrl = new URL("/login", request.url);
      const callbackPath = releaseId
        ? `/api/releases/${releaseId}/download`
        : request.nextUrl.pathname;

      loginUrl.searchParams.set("callbackUrl", callbackPath);

      return NextResponse.redirect(loginUrl, { status: 307 });
    }

    if (!releaseId) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const release = await prisma.release.findFirst({
      where: {
        id: releaseId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        fileUrl: true,
      },
    });

    if (!release) {
      return NextResponse.json(
        { error: "Release wurde nicht gefunden oder ist nicht veröffentlicht." },
        { status: 404 }
      );
    }

    if (!release.fileUrl?.trim()) {
      return NextResponse.json(
        { error: "Diesem Release ist keine Datei zugeordnet." },
        { status: 400 }
      );
    }

    const redirectUrl = buildRedirectUrl(release.fileUrl, request);

    if (!redirectUrl) {
      return NextResponse.json(
        { error: "Ungültige Download-URL." },
        { status: 500 }
      );
    }

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
          userId: user.id,
          ip,
        },
      }),
    ]);

    return NextResponse.redirect(redirectUrl, {
      status: 307,
    });
  } catch (error) {
    console.error("GET /api/releases/[id]/download error:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler beim Starten des Downloads." },
      { status: 500 }
    );
  }
}