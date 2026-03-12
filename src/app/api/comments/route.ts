import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeId(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const releaseId = normalizeId(searchParams.get("releaseId"));

    if (!releaseId) {
      return new Response("releaseId is required", { status: 400 });
    }

    const comments = await prisma.comment.findMany({
      where: {
        releaseId,
        parentId: null,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
                username: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return Response.json(comments);
  } catch (error) {
    console.error("GET /api/comments error:", error);

    return new Response("Failed to load comments", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const content = String(body?.content ?? "").trim();
    const releaseId = normalizeId(body?.releaseId);
    const parentId = normalizeId(body?.parentId);

    if (!content) {
      return new Response("content is required", { status: 400 });
    }

    if (!releaseId) {
      return new Response("releaseId is required", { status: 400 });
    }

    const releaseExists = await prisma.release.findUnique({
      where: {
        id: releaseId,
      },
      select: {
        id: true,
      },
    });

    if (!releaseExists) {
      return new Response("Release not found", { status: 404 });
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: {
          id: parentId,
        },
        select: {
          id: true,
          releaseId: true,
        },
      });

      if (!parentComment) {
        return new Response("Parent comment not found", { status: 404 });
      }

      if (parentComment.releaseId !== releaseId) {
        return new Response("Parent comment does not belong to this release", {
          status: 400,
        });
      }
    }

    const created = await prisma.comment.create({
      data: {
        content,
        releaseId,
        parentId,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
                username: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/comments error:", error);

    return new Response("Failed to create comment", { status: 500 });
  }
}