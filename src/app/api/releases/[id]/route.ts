import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

function getSessionUserId(session: Awaited<ReturnType<typeof getServerSession>>) {
  return (session?.user as SessionUser | undefined)?.id ?? null;
}

function getSessionUserRole(session: Awaited<ReturnType<typeof getServerSession>>) {
  return (session?.user as SessionUser | undefined)?.role ?? null;
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
    const userId = getSessionUserId(session);
    const role = getSessionUserRole(session);
    const isAdmin = role === "ADMIN";

    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!release) {
      return NextResponse.json({ error: "Release nicht gefunden." }, { status: 404 });
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
    const userId = getSessionUserId(session);
    const role = getSessionUserRole(session);
    const isAdmin = role === "ADMIN";

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
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = existing.authorId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const title =
      body.title !== undefined ? String(body.title).trim() : undefined;

    const version =
      body.version !== undefined ? String(body.version).trim() : undefined;

    const fileUrl =
      body.fileUrl !== undefined ? String(body.fileUrl).trim() : undefined;

    const description =
      body.description !== undefined ? String(body.description).trim() : undefined;

    const imageUrl =
      body.imageUrl !== undefined ? String(body.imageUrl).trim() : undefined;

    const slug =
      body.slug !== undefined ? String(body.slug).trim() : undefined;

    const status =
      body.status !== undefined ? String(body.status).trim().toUpperCase() : undefined;

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

    if (status !== undefined && status !== "DRAFT" && status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Ungültiger Status." },
        { status: 400 }
      );
    }

    const data: {
      title?: string;
      version?: string;
      fileUrl?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      slug?: string | null;
      status?: "DRAFT" | "PUBLISHED";
    } = {};

    if (title !== undefined) data.title = title;
    if (version !== undefined) data.version = version;
    if (fileUrl !== undefined) data.fileUrl = fileUrl || null;
    if (description !== undefined) data.description = description || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (slug !== undefined) data.slug = slug || null;
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
    const userId = getSessionUserId(session);
    const role = getSessionUserRole(session);
    const isAdmin = role === "ADMIN";

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