import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const comments = await prisma.comment.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        release: {
          select: {
            id: true,
            title: true,
            slug: true,
            version: true,
          },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET /api/profile/comments error:", error);

    return NextResponse.json(
      { error: "Kommentare konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}