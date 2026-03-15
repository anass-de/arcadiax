import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as SessionUser | undefined;

    if (!sessionUser?.id) {
      return NextResponse.json(
        {
          error: "Du musst eingeloggt sein, um eine Nachricht zu bearbeiten.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existingPost = await prisma.communityPost.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingPost) {
      return NextResponse.json(
        {
          error: "Nachricht nicht gefunden.",
        },
        { status: 404 }
      );
    }

    if (existingPost.userId !== sessionUser.id) {
      return NextResponse.json(
        {
          error: "Du darfst nur deine eigenen Nachrichten bearbeiten.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          content?: unknown;
        }
      | null;

    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json(
        {
          error: "Die Nachricht darf nicht leer sein.",
        },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        {
          error: "Die Nachricht darf maximal 1000 Zeichen lang sein.",
        },
        { status: 400 }
      );
    }

    const post = await prisma.communityPost.update({
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
            image: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ post }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/community/[id] error:", error);

    return NextResponse.json(
      {
        error: "Nachricht konnte nicht bearbeitet werden.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as SessionUser | undefined;

    if (!sessionUser?.id) {
      return NextResponse.json(
        {
          error: "Du musst eingeloggt sein, um eine Nachricht zu löschen.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existingPost = await prisma.communityPost.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingPost) {
      return NextResponse.json(
        {
          error: "Nachricht nicht gefunden.",
        },
        { status: 404 }
      );
    }

    const isOwner = existingPost.userId === sessionUser.id;
    const isAdmin = sessionUser.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        {
          error: "Du darfst diese Nachricht nicht löschen.",
        },
        { status: 403 }
      );
    }

    await prisma.communityPost.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/community/[id] error:", error);

    return NextResponse.json(
      {
        error: "Nachricht konnte nicht gelöscht werden.",
      },
      { status: 500 }
    );
  }
}