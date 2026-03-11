// src/app/api/admin/users/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/*
  Hilfsfunktion:
  Prüft Admin-Session.
*/
async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      ),
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Kein Zugriff. Nur Admins erlaubt." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

/*
  PATCH /api/admin/users/[id]
  JSON-Variante zum Rollenwechsel
*/
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    const body = await request.json();
    const role = String(body?.role ?? "").trim();

    if (role !== "ADMIN" && role !== "USER") {
      return NextResponse.json(
        { error: "Ungültige Rolle." },
        { status: 400 }
      );
    }

    // Optionaler Schutz: Admin darf sich nicht selbst herabstufen
    if (id === adminCheck.session.user.id && role === "USER") {
      return NextResponse.json(
        { error: "Du kannst deine eigene Admin-Rolle nicht entfernen." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Nutzer nicht gefunden." },
        { status: 404 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as "ADMIN" | "USER" },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: "Rolle erfolgreich aktualisiert.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Rolle:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

/*
  DELETE /api/admin/users/[id]
  JSON-Variante zum Löschen
*/
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;

    // Admin darf sich nicht selbst löschen
    if (id === adminCheck.session.user.id) {
      return NextResponse.json(
        { error: "Du kannst dein eigenes Konto nicht löschen." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Nutzer nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Nutzer erfolgreich gelöscht.",
    });
  } catch (error) {
    console.error("Fehler beim Löschen des Nutzers:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

/*
  POST /api/admin/users/[id]
  HTML-Form-Variante für Dashboard-Formulare

  Warum POST?
  Weil normale HTML-Forms kein PATCH oder DELETE direkt senden.
  Deshalb emulieren wir das über hidden field "_method".
*/
export async function POST(request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    const formData = await request.formData();

    const method = String(formData.get("_method") ?? "").toUpperCase();
    const role = String(formData.get("role") ?? "").trim();
    const referer = request.headers.get("referer") || "/dashboard/users";

    if (method === "PATCH") {
      if (role !== "ADMIN" && role !== "USER") {
        return NextResponse.redirect(new URL("/dashboard/users", request.url), {
          status: 303,
        });
      }

      if (id === adminCheck.session.user.id && role === "USER") {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingUser) {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      await prisma.user.update({
        where: { id },
        data: { role: role as "ADMIN" | "USER" },
      });

      return NextResponse.redirect(new URL(referer, request.url), {
        status: 303,
      });
    }

    if (method === "DELETE") {
      if (id === adminCheck.session.user.id) {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingUser) {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      await prisma.user.delete({
        where: { id },
      });

      return NextResponse.redirect(new URL(referer, request.url), {
        status: 303,
      });
    }

    return NextResponse.redirect(new URL(referer, request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("Fehler bei Admin-User-Aktion:", error);

    return NextResponse.redirect(new URL("/dashboard/users", request.url), {
      status: 303,
    });
  }
}