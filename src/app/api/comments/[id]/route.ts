import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

function canManageComment(
  currentUser: SessionUser | null,
  commentUserId: string | null
) {
  if (!currentUser?.id) {
    return false;
  }

  if (currentUser.role === "ADMIN") {
    return true;
  }

  return commentUserId === currentUser.id;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Nicht autorisiert." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const commentId = id?.trim();

    if (!commentId) {
      return NextResponse.json(
        { error: "Ungültige Kommentar-ID." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const content = String(body?.content ?? "").trim();

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

    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Kommentar wurde nicht gefunden." },
        { status: 404 }
      );
    }

    if (!canManageComment(user, existingComment.userId)) {
      return NextResponse.json(
        { error: "Kein Zugriff auf diesen Kommentar." },
        { status: 403 }
      );
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
      },
      select: {
        id: true,
        content: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Kommentar wurde aktualisiert.",
      comment: updated,
    });
  } catch (error) {
    console.error("PATCH /api/comments/[id] error:", error);

    return NextResponse.json(
      { error: "Kommentar konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Nicht autorisiert." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const commentId = id?.trim();

    if (!commentId) {
      return NextResponse.json(
        { error: "Ungültige Kommentar-ID." },
        { status: 400 }
      );
    }

    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        parentId: true,
      },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Kommentar wurde nicht gefunden." },
        { status: 404 }
      );
    }

    if (!canManageComment(user, existingComment.userId)) {
      return NextResponse.json(
        { error: "Kein Zugriff auf diesen Kommentar." },
        { status: 403 }
      );
    }

    if (existingComment.parentId === null) {
      await prisma.$transaction([
        prisma.comment.deleteMany({
          where: {
            parentId: commentId,
          },
        }),
        prisma.comment.delete({
          where: {
            id: commentId,
          },
        }),
      ]);
    } else {
      await prisma.comment.delete({
        where: {
          id: commentId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Kommentar wurde gelöscht.",
      deletedId: commentId,
    });
  } catch (error) {
    console.error("DELETE /api/comments/[id] error:", error);

    return NextResponse.json(
      { error: "Kommentar konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}