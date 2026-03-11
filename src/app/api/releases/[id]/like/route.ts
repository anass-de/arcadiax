import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await context.params;

    const release = await prisma.release.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!release || release.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    const likesCount = await prisma.releaseLike.count({
      where: { releaseId: id },
    });

    let likedByMe = false;

    if (session?.user?.id) {
      const existingLike = await prisma.releaseLike.findUnique({
        where: {
          userId_releaseId: {
            userId: session.user.id,
            releaseId: id,
          },
        },
        select: { id: true },
      });

      likedByMe = !!existingLike;
    }

    return NextResponse.json({
      likesCount,
      likedByMe,
    });
  } catch (error) {
    console.error("GET /api/releases/[id]/like error:", error);

    return NextResponse.json(
      { error: "Failed to load like status" },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const release = await prisma.release.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!release || release.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    const existingLike = await prisma.releaseLike.findUnique({
      where: {
        userId_releaseId: {
          userId: session.user.id,
          releaseId: id,
        },
      },
      select: { id: true },
    });

    if (existingLike) {
      return NextResponse.json(
        { error: "Release already liked" },
        { status: 409 }
      );
    }

    await prisma.releaseLike.create({
      data: {
        userId: session.user.id,
        releaseId: id,
      },
    });

    const likesCount = await prisma.releaseLike.count({
      where: { releaseId: id },
    });

    return NextResponse.json({
      likedByMe: true,
      likesCount,
    });
  } catch (error) {
    console.error("POST /api/releases/[id]/like error:", error);

    return NextResponse.json(
      { error: "Failed to like release" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existingLike = await prisma.releaseLike.findUnique({
      where: {
        userId_releaseId: {
          userId: session.user.id,
          releaseId: id,
        },
      },
      select: { id: true },
    });

    if (!existingLike) {
      return NextResponse.json(
        { error: "Like not found" },
        { status: 404 }
      );
    }

    await prisma.releaseLike.delete({
      where: {
        userId_releaseId: {
          userId: session.user.id,
          releaseId: id,
        },
      },
    });

    const likesCount = await prisma.releaseLike.count({
      where: { releaseId: id },
    });

    return NextResponse.json({
      likedByMe: false,
      likesCount,
    });
  } catch (error) {
    console.error("DELETE /api/releases/[id]/like error:", error);

    return NextResponse.json(
      { error: "Failed to unlike release" },
      { status: 500 }
    );
  }
}