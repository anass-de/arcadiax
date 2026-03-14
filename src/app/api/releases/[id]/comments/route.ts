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

async function getPublishedRelease(releaseId: string) {
  return prisma.release.findFirst({
    where: {
      id: releaseId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
    },
  });
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const releaseId = id?.trim();

    if (!releaseId) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const release = await getPublishedRelease(releaseId);

    if (!release) {
      return NextResponse.json(
        { error: "Release wurde nicht gefunden oder ist nicht veröffentlicht." },
        { status: 404 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: {
        releaseId,
        parentId: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
          },
        },
        replies: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      comments,
    });
  } catch (error) {
    console.error("GET /api/releases/[id]/comments error:", error);

    return NextResponse.json(
      { error: "Kommentare konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const releaseId = id?.trim();

    if (!releaseId) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const release = await getPublishedRelease(releaseId);

    if (!release) {
      return NextResponse.json(
        { error: "Release wurde nicht gefunden oder ist nicht veröffentlicht." },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Du musst eingeloggt sein, um zu kommentieren." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    const content = String(body?.content ?? "").trim();
    const parentId =
      typeof body?.parentId === "string" && body.parentId.trim()
        ? body.parentId.trim()
        : null;

    if (!content) {
      return NextResponse.json(
        { error: "Der Kommentar darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Der Kommentar ist zu lang. Maximal 2000 Zeichen sind erlaubt." },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: {
          id: parentId,
          releaseId,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Der Zielkommentar für die Antwort wurde nicht gefunden." },
          { status: 404 }
        );
      }

      if (parent.parentId) {
        return NextResponse.json(
          { error: "Antworten auf Antworten sind nicht erlaubt." },
          { status: 400 }
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        releaseId,
        userId: user.id,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        comment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/releases/[id]/comments error:", error);

    return NextResponse.json(
      { error: "Kommentar konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}