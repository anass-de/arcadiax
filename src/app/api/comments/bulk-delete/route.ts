import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

function getSessionUser(session: Awaited<ReturnType<typeof getServerSession>>) {
  return (session?.user as SessionUser | undefined) ?? {};
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { role } = getSessionUser(session);

    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Keine Kommentar-IDs übergeben." },
        { status: 400 }
      );
    }

    await prisma.comment.deleteMany({
      where: {
        parentId: {
          in: ids,
        },
      },
    });

    await prisma.comment.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/comments/bulk-delete error:", error);

    return NextResponse.json(
      { error: "Bulk Delete fehlgeschlagen." },
      { status: 500 }
    );
  }
}