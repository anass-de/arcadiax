import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

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
  if (!session) {
    return null;
  }

  const maybeSession = session as { user?: unknown };

  if (!maybeSession.user || typeof maybeSession.user !== "object") {
    return null;
  }

  return maybeSession.user as SessionUser;
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  return text ? text : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);
    const userId = user?.id ?? null;
    const isAdmin = user?.role === "ADMIN";

    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                image: true,
              },
            },
            replies: {
              orderBy: {
                createdAt: "asc",
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!release) {
      return NextResponse.json(
        { error: "Release nicht gefunden." },
        { status: 404 }
      );
    }

    const isOwner = release.authorId === userId;
    const isPublished = release.status === "PUBLISHED";

    if (!isPublished && !isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({ release });
  } catch (error) {
    console.error("GET /api/releases/[id] error:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);
    const userId = user?.id ?? null;
    const isAdmin = user?.role === "ADMIN";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const existing = await prisma.release.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = existing.authorId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);

    const title =
      body?.title !== undefined ? String(body.title).trim() : undefined;
    const version =
      body?.version !== undefined ? String(body.version).trim() : undefined;
    const fileUrl =
      body?.fileUrl !== undefined ? String(body.fileUrl).trim() : undefined;
    const slug =
      body?.slug !== undefined ? String(body.slug).trim() : undefined;
    const description = normalizeOptionalString(body?.description);
    const changelog = normalizeOptionalString(body?.changelog);
    const imageUrl = normalizeOptionalString(body?.imageUrl);
    const status =
      body?.status !== undefined
        ? String(body.status).trim().toUpperCase()
        : undefined;

    if (title !== undefined && !title) {
      return NextResponse.json(
        { error: "Titel darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (version !== undefined && !version) {
      return NextResponse.json(
        { error: "Version darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (fileUrl !== undefined && !fileUrl) {
      return NextResponse.json(
        { error: "Datei-URL darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (slug !== undefined && !slug) {
      return NextResponse.json(
        { error: "Slug darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (status !== undefined && status !== "DRAFT" && status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Ungültiger Status." },
        { status: 400 }
      );
    }

    const data: {
      title?: string;
      version?: string;
      fileUrl?: string;
      description?: string | null;
      changelog?: string | null;
      imageUrl?: string | null;
      slug?: string;
      status?: "DRAFT" | "PUBLISHED";
    } = {};

    if (title !== undefined) data.title = title;
    if (version !== undefined) data.version = version;
    if (fileUrl !== undefined) data.fileUrl = fileUrl;
    if (description !== undefined) data.description = description;
    if (changelog !== undefined) data.changelog = changelog;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (slug !== undefined) data.slug = slug;
    if (status !== undefined) data.status = status as "DRAFT" | "PUBLISHED";

    const release = await prisma.release.update({
      where: { id },
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ release });
  } catch (error: unknown) {
    console.error("PUT /api/releases/[id] error:", error);

    const message =
      error instanceof Error ? error.message : "Interner Serverfehler.";

    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json(
        { error: "Slug oder anderer eindeutiger Wert ist bereits vergeben." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);
    const userId = user?.id ?? null;
    const isAdmin = user?.role === "ADMIN";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Release-ID." },
        { status: 400 }
      );
    }

    const existing = await prisma.release.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = existing.authorId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.release.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/releases/[id] error:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}