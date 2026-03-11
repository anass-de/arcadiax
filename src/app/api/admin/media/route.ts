// src/app/api/admin/media/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function slugifyFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-");
}

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

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const media = await prisma.homeMedia.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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

    return NextResponse.json({ media });
  } catch (error) {
    console.error("GET /api/admin/media error:", error);

    return NextResponse.json(
      { error: "Fehler beim Laden der Medien." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const formData = await request.formData();

    const type = String(formData.get("type") ?? "").trim().toUpperCase();
    const title = String(formData.get("title") ?? "").trim() || null;
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const rawSortOrder = String(formData.get("sortOrder") ?? "0").trim();
    const activeValue = String(formData.get("active") ?? "true").trim();
    const file = formData.get("file");

    const sortOrder = Number(rawSortOrder);
    const active =
      activeValue === "true" ||
      activeValue === "on" ||
      activeValue === "1";

    if (type !== "IMAGE" && type !== "VIDEO") {
      return NextResponse.json(
        { error: "Ungültiger Medientyp." },
        { status: 400 }
      );
    }

    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      return NextResponse.json(
        { error: "Ungültige Sortierung." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Die hochgeladene Datei ist leer." },
        { status: 400 }
      );
    }

    const allowedImageTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    const allowedVideoTypes = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
    ];

    if (type === "IMAGE" && !allowedImageTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Bitte eine gültige Bilddatei hochladen (png, jpg, jpeg, webp, gif).",
        },
        { status: 400 }
      );
    }

    if (type === "VIDEO" && !allowedVideoTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Bitte eine gültige Videodatei hochladen (mp4, webm, ogg, mov).",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });

    const safeName = slugifyFileName(file.name || "upload");
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const media = await prisma.homeMedia.create({
      data: {
        type: type as "IMAGE" | "VIDEO",
        title,
        description,
        url: `/uploads/${fileName}`,
        sortOrder,
        active,
        authorId: adminCheck.session.user.id,
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

    return NextResponse.json(
      {
        message: "Medium erfolgreich erstellt.",
        media,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/media error:", error);

    return NextResponse.json(
      { error: "Fehler beim Erstellen des Mediums." },
      { status: 500 }
    );
  }
}