// src/app/api/admin/comments/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/*
  GET /api/admin/comments

  Optionale API für spätere AJAX-Nutzung.
*/
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Kein Zugriff. Nur Admins erlaubt." },
        { status: 403 }
      );
    }

    const comments = await prisma.comment.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        parentId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        release: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Fehler beim Laden der Kommentare:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}