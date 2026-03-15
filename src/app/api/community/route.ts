import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const posts = await prisma.communityPost.findMany({
      orderBy: {
        createdAt: "desc",
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

    return NextResponse.json({ posts }, { status: 200 });
  } catch (error) {
    console.error("GET /api/community error:", error);

    return NextResponse.json(
      {
        error: "Community-Nachrichten konnten nicht geladen werden.",
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
          error: "Du musst eingeloggt sein, um eine Nachricht zu schreiben.",
        },
        { status: 401 }
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

    const post = await prisma.communityPost.create({
      data: {
        content,
        userId: sessionUser.id,
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