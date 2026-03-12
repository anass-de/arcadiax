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
  role?: string | null;
  email?: string | null;
  name?: string | null;
};

function getSessionUser(
  session: Awaited<ReturnType<typeof getServerSession>>
): SessionUser | null {
  if (!session) return null;

  const maybeSession = session as { user?: unknown };

  if (!maybeSession.user || typeof maybeSession.user !== "object") {
    return null;
  }

  return maybeSession.user as SessionUser;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    const content = String(body?.content ?? "").trim();

    if (!content) {
      return NextResponse.json(
        { error: "Kommentarinhalt fehlt." },
        { status: 400 }
      );
    }

    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden." },
        { status: 404 }
      );
    }

    if (existingComment.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.comment.update({
      where: { id },
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
      message: "Kommentar aktualisiert.",
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden." },
        { status: 404 }
      );
    }

    if (existingComment.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.comment.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Kommentar gelöscht.",
    });
  } catch (error) {
    console.error("DELETE /api/comments/[id] error:", error);

    return NextResponse.json(
      { error: "Kommentar konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}