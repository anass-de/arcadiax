// src/app/api/admin/comments/[id]/route.ts

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
  Hilfsfunktion für Admin-Schutz
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
  DELETE /api/admin/comments/[id]
  JSON-Variante
*/
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;

    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.comment.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Kommentar erfolgreich gelöscht.",
    });
  } catch (error) {
    console.error("Fehler beim Löschen des Kommentars:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

/*
  POST /api/admin/comments/[id]
  HTML-Form-Variante mit _method=DELETE
*/
export async function POST(request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    const formData = await request.formData();
    const method = String(formData.get("_method") ?? "").toUpperCase();
    const referer = request.headers.get("referer") || "/dashboard/comments";

    if (method === "DELETE") {
      const existingComment = await prisma.comment.findUnique({
        where: { id },
        select: { id: true },
      });

      if (existingComment) {
        await prisma.comment.delete({
          where: { id },
        });
      }

      return NextResponse.redirect(new URL(referer, request.url), {
        status: 303,
      });
    }

    return NextResponse.redirect(new URL(referer, request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("Fehler bei Admin-Kommentaraktion:", error);

    return NextResponse.redirect(new URL("/dashboard/comments", request.url), {
      status: 303,
    });
  }
}