import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const communityUserSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
  role: true,
} as const;

export async function GET() {
  try {
    const posts = await prisma.communityPost.findMany({
      where: {
        parentId: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: communityUserSelect,
        },
        replies: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            user: {
              select: communityUserSelect,
            },
          },
        },
      },
    });

    return NextResponse.json({ posts }, { status: 200 });
  } catch (error) {
    console.error("GET /api/community error:", error);

    return NextResponse.json(
      {
        error: "Community-Beiträge konnten nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    const sessionUser = session?.user as
      | {
          id?: string | null;
        }
      | undefined;

    if (!sessionUser?.id) {
      return NextResponse.json(
        {
          error: "Du musst eingeloggt sein, um einen Beitrag oder eine Antwort zu schreiben.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          content?: unknown;
          parentId?: unknown;
        }
      | null;

    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    const parentId =
      typeof body?.parentId === "string" && body.parentId.trim()
        ? body.parentId.trim()
        : null;

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

    if (parentId) {
      const parentPost = await prisma.communityPost.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          parentId: true,
        },
      });

      if (!parentPost) {
        return NextResponse.json(
          {
            error: "Der Beitrag, auf den du antworten willst, wurde nicht gefunden.",
          },
          { status: 404 }
        );
      }

      if (parentPost.parentId !== null) {
        return NextResponse.json(
          {
            error: "Es sind nur Antworten auf Hauptbeiträge erlaubt.",
          },
          { status: 400 }
        );
      }
    }

    const post = await prisma.communityPost.create({
      data: {
        content,
        userId: sessionUser.id,
        parentId,
      },
      include: {
        user: {
          select: communityUserSelect,
        },
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("POST /api/community error:", error);

    return NextResponse.json(
      {
        error: "Nachricht konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }
}