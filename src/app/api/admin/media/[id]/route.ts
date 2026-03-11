// src/app/api/admin/media/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs";
import path from "path";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
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

function deleteUploadedFileIfLocal(url: string | null | undefined) {
  if (!url) return;

  if (!url.startsWith("/uploads/")) return;

  const relativePath = url.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", relativePath);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;

    const media = await prisma.homeMedia.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!media) {
      return NextResponse.json(
        { error: "Medium nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({ media });
  } catch (error) {
    console.error("GET /api/admin/media/[id] error:", error);

    return NextResponse.json(
      { error: "Fehler beim Laden des Mediums." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    const body = await request.json();

    const type = String(body?.type ?? "").trim().toUpperCase();
    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const url = String(body?.url ?? "").trim();
    const sortOrder = Number(body?.sortOrder ?? 0);
    const active = Boolean(body?.active);

    if (type !== "IMAGE" && type !== "VIDEO") {
      return NextResponse.json(
        { error: "Ungültiger Medientyp." },
        { status: 400 }
      );
    }

    if (!url) {
      return NextResponse.json(
        { error: "Die URL ist erforderlich." },
        { status: 400 }
      );
    }

    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      return NextResponse.json(
        { error: "Ungültige Sortierung." },
        { status: 400 }
      );
    }

    const existingItem = await prisma.homeMedia.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Medium nicht gefunden." },
        { status: 404 }
      );
    }

    const updated = await prisma.homeMedia.update({
      where: { id },
      data: {
        type: type as "IMAGE" | "VIDEO",
        title: title || null,
        description: description || null,
        url,
        sortOrder,
        active,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Medium aktualisiert.",
      media: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/media/[id] error:", error);

    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Mediums." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;

    const existingItem = await prisma.homeMedia.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Medium nicht gefunden." },
        { status: 404 }
      );
    }

    deleteUploadedFileIfLocal(existingItem.url);

    await prisma.homeMedia.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Medium gelöscht.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/media/[id] error:", error);

    return NextResponse.json(
      { error: "Fehler beim Löschen des Mediums." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    const formData = await request.formData();

    const method = String(formData.get("_method") ?? "").toUpperCase();
    const referer = request.headers.get("referer") || "/dashboard/media";

    if (method === "PATCH") {
      const type = String(formData.get("type") ?? "").trim().toUpperCase();
      const title = String(formData.get("title") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const url = String(formData.get("url") ?? "").trim();
      const rawSortOrder = String(formData.get("sortOrder") ?? "0").trim();
      const active = formData.get("active") === "on";

      if (type !== "IMAGE" && type !== "VIDEO") {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      const sortOrder = Number(rawSortOrder);

      if (!url || Number.isNaN(sortOrder) || sortOrder < 0) {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      const existingItem = await prisma.homeMedia.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingItem) {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      await prisma.homeMedia.update({
        where: { id },
        data: {
          type: type as "IMAGE" | "VIDEO",
          title: title || null,
          description: description || null,
          url,
          sortOrder,
          active,
        },
      });

      return NextResponse.redirect(new URL(referer, request.url), {
        status: 303,
      });
    }

    if (method === "DELETE") {
      const existingItem = await prisma.homeMedia.findUnique({
        where: { id },
      });

      if (!existingItem) {
        return NextResponse.redirect(new URL(referer, request.url), {
          status: 303,
        });
      }

      deleteUploadedFileIfLocal(existingItem.url);

      await prisma.homeMedia.delete({
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
    console.error("POST /api/admin/media/[id] error:", error);

    return NextResponse.redirect(new URL("/dashboard/media", request.url), {
      status: 303,
    });
  }
}