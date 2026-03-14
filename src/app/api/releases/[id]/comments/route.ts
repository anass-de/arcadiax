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

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Invalid release ID." },
        { status: 400 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: {
        releaseId: id,
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
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return NextResponse.json({
      comments,
    });
  } catch (error) {
    console.error("GET comments error:", error);

    return NextResponse.json(
      { error: "Failed to load comments." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Invalid release ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to comment." },
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
        { error: "Comment cannot be empty." },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Comment is too long." },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: {
          id: parentId,
          releaseId: id,
        },
        select: {
          id: true,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Reply target was not found." },
          { status: 404 }
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        releaseId: id,
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

    return NextResponse.json({
      comment,
    });
  } catch (error) {
    console.error("POST comment error:", error);

    return NextResponse.json(
      { error: "Failed to create comment." },
      { status: 500 }
    );
  }
}