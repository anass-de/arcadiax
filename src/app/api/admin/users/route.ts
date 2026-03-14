import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

/*
  GET /api/admin/users

  Optional für spätere AJAX-Tabellen oder Client-Fetching.
  Aktuell wird die Dashboard-Seite serverseitig mit Prisma gerendert,
  aber diese Route ist vollständig vorbereitet.
*/
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Kein Zugriff. Nur Admins erlaubt." },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            comments: true,
            releases: true,
            mediaItems: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);

    return NextResponse.json(
      { error: "Benutzer konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}