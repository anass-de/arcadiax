import { NextRequest, NextResponse } from "next/server";
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
  role?: string | null;
};

function getSessionUser(session: Awaited<ReturnType<typeof getServerSession>>) {
  return (session?.user as SessionUser | undefined) ?? {};
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id: releaseId } = await context.params;

    if (!releaseId?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Release-ID" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const { id: userId, role } = getSessionUser(session);
    const isAdmin = role === "ADMIN";

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        status: true,
        authorId: true,
      },
    });

    if (!release) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    const isOwner = !!userId && release.authorId === userId;
    const isPublished = release.status === "PUBLISHED";

    if (!isPublished && !isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: {
        releaseId,
        parentId: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET comments error:", error);

    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = getSessionUser(session);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: releaseId } = await context.params;

    if (!releaseId?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Release-ID" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);

    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    const parentId =
      typeof body?.parentId === "string" && body.parentId.trim().length > 0
        ? body.parentId.trim()
        : null;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Comment is too long" },
        { status: 400 }
      );
    }

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
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
        { error: "Comments are only allowed on published releases" },
        { status: 403 }
      );
    }

    if (parentId) {
      const parentComment = await prisma.comment.findFirst({
        where: {
          id: parentId,
          releaseId,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }

      // Optional: Nur 2 Ebenen erlauben (Kommentar -> Reply)
      if (parentComment.parentId) {
        return NextResponse.json(
          { error: "Nested replies deeper than one level are not allowed" },
          { status: 400 }
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        releaseId,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST comment error:", error);

    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}