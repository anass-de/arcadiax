import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

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
  role?: string | null;
  email?: string | null;
  name?: string | null;
};

type AdminSessionUser = {
  id: string;
  role: "ADMIN";
  email?: string | null;
  name?: string | null;
};

type AppRole = "ADMIN" | "USER";

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
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true as const,
    user: user as AdminSessionUser,
  };
}

function isValidRole(role: string): role is AppRole {
  return role === "ADMIN" || role === "USER";
}

function redirectToUsers(
  request: NextRequest,
  status?: "role_updated",
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const currentUserId = auth.user.id;
    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Ungültige Benutzer-ID." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const role = String(body?.role ?? "")
      .trim()
      .toUpperCase();

    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: "Ungültige Rolle." },
        { status: 400 }
      );
    }

    if (currentUserId === id) {
      return NextResponse.json(
        { error: "Du kannst deine eigene Rolle hier nicht ändern." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role,
      },
      select: {
        id: true,
        role: true,
        username: true,
        name: true,
        email: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Rolle erfolgreich aktualisiert.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]/role error:", error);

    return NextResponse.json(
      { error: "Rolle konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const currentUserId = auth.user.id;
    const { id } = await context.params;

    if (!id?.trim()) {
      return redirectToUsers(request, undefined, "invalid_user");
    }

    const formData = await request.formData();
    const role = String(formData.get("role") ?? "")
      .trim()
      .toUpperCase();

    if (!isValidRole(role)) {
      return redirectToUsers(request, undefined, "invalid_role");
    }

    if (currentUserId === id) {
      return redirectToUsers(request, undefined, "cannot_change_own_role");
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      return redirectToUsers(request, undefined, "not_found");
    }

    await prisma.user.update({
      where: { id },
      data: {
        role,
      },
    });

    return redirectToUsers(request, "role_updated");
  } catch (error) {
    console.error("POST /api/admin/users/[id]/role error:", error);

    return redirectToUsers(request, undefined, "role_update_failed");
  }
}