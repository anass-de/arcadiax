import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);

    if (!user?.id || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];

    if (!ids.length) {
      return NextResponse.json(
        { error: "Keine Kommentar-IDs angegeben." },
        { status: 400 }
      );
    }

    const result = await prisma.comment.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      message: "Kommentare gelöscht.",
      count: result.count,
    });
  } catch (error) {
    console.error("POST /api/comments/bulk-delete error:", error);

    return NextResponse.json(
      { error: "Kommentare konnten nicht gelöscht werden." },
      { status: 500 }
    );
  }
}