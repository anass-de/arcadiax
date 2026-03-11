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

function getSessionUser(
  session: Awaited<ReturnType<typeof getServerSession>>
): SessionUser {
  return (session?.user as SessionUser | undefined) ?? {};
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId, role } = getSessionUser(session);
    const isAdmin = role === "ADMIN";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Kommentar-ID." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json(
        { error: "Kommentar darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Kommentar ist zu lang. Maximal 2000 Zeichen." },
        { status: 400 }
      );
    }

    const existing = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        parentId: true,
        releaseId: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden." },
        { status: 404 }
      );
    }

    const isOwner = existing.userId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
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
                email: true,
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

    return NextResponse.json({ comment: updatedComment });
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
    const { id: userId, role } = getSessionUser(session);
    const isAdmin = role === "ADMIN";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Kommentar-ID." },
        { status: 400 }
      );
    }

    const existing = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        parentId: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden." },
        { status: 404 }
      );
    }

    const isOwner = existing.userId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({
        where: {
          parentId: id,
        },
      });

      await tx.comment.delete({
        where: {
          id,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/comments/[id] error:", error);

    return NextResponse.json(
      { error: "Kommentar konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}