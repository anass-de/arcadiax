import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SessionUser = {
  id?: string | null;
  role?: "ADMIN" | "USER" | null;
  email?: string | null;
  name?: string | null;
};

type AdminSessionUser = {
  id: string;
  role: "ADMIN";
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

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = getSessionUser(session);

  if (!user?.id || user.role !== "ADMIN") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Nicht autorisiert." },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true as const,
    user: user as AdminSessionUser,
  };
}

function redirectToUsers(
  request: NextRequest,
  status?: "deleted",
  error?: string
) {
  const url = new URL("/dashboard/users", request.url);

  if (status) {
    url.searchParams.set("status", status);
  }

  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url, 303);
}

async function revalidateUserAdminViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/users");
  revalidatePath("/api/admin/users");
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const targetUserId = id?.trim();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Ungültige Benutzer-ID." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        _count: {
          select: {
            comments: true,
            releases: true,
            mediaItems: true,
            sessions: true,
            accounts: true,
            downloads: true,
            releaseLikes: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer wurde nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    console.error("GET /api/admin/users/[id] error:", error);

    return NextResponse.json(
      { error: "Benutzer konnte nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const currentUserId = auth.user.id;
    const { id } = await context.params;
    const targetUserId = id?.trim();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Ungültige Benutzer-ID." },
        { status: 400 }
      );
    }

    if (currentUserId === targetUserId) {
      return NextResponse.json(
        { error: "Du kannst deinen eigenen Account nicht löschen." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Benutzer wurde nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.releaseLike.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.download.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.session.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.account.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.homeMedia.deleteMany({
        where: { authorId: targetUserId },
      }),
      prisma.release.deleteMany({
        where: { authorId: targetUserId },
      }),
      prisma.user.delete({
        where: { id: targetUserId },
      }),
    ]);

    await revalidateUserAdminViews();

    return NextResponse.json({
      ok: true,
      message: "Benutzer wurde erfolgreich gelöscht.",
      deletedId: targetUserId,
    });
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error);

    return NextResponse.json(
      { error: "Benutzer konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", "/dashboard/users");
      return NextResponse.redirect(loginUrl, 303);
    }

    const currentUserId = auth.user.id;
    const { id } = await context.params;
    const targetUserId = id?.trim();

    const formData = await request.formData();
    const method = String(formData.get("_method") ?? "")
      .trim()
      .toUpperCase();

    if (method !== "DELETE") {
      return redirectToUsers(request, undefined, "invalid_method");
    }

    if (!targetUserId) {
      return redirectToUsers(request, undefined, "invalid_user");
    }

    if (currentUserId === targetUserId) {
      return redirectToUsers(request, undefined, "cannot_delete_self");
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      return redirectToUsers(request, undefined, "not_found");
    }

    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.releaseLike.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.download.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.session.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.account.deleteMany({
        where: { userId: targetUserId },
      }),
      prisma.homeMedia.deleteMany({
        where: { authorId: targetUserId },
      }),
      prisma.release.deleteMany({
        where: { authorId: targetUserId },
      }),
      prisma.user.delete({
        where: { id: targetUserId },
      }),
    ]);

    await revalidateUserAdminViews();

    return redirectToUsers(request, "deleted");
  } catch (error) {
    console.error("POST /api/admin/users/[id] error:", error);

    return redirectToUsers(request, undefined, "delete_failed");
  }
}