// src/app/api/admin/releases/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReleaseStatus = "DRAFT" | "PUBLISHED";

type CreateReleaseBody = {
  title?: string;
  slug?: string;
  version?: string;
  shortDescription?: string;
  description?: string;
  changelog?: string;
  status?: ReleaseStatus;
  fileUrl?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  imageUrl?: string | null;
  imagePath?: string | null;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isValidReleaseStatus(value: unknown): value is ReleaseStatus {
  return value === "DRAFT" || value === "PUBLISHED";
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isSafeReleaseStoragePath(path: string) {
  return (
    path.startsWith("releases/") &&
    (path.includes("/files/") || path.includes("/images/"))
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = searchParams.get("includeDrafts") === "true";

    const session = await getServerSession(authOptions);
    const isAdmin =
      (session?.user as { role?: string } | undefined)?.role === "ADMIN";

    const releases = await prisma.release.findMany({
      where:
        includeDrafts && isAdmin
          ? undefined
          : {
              status: "PUBLISHED",
            },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            downloads: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      releases,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Serverfehler.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    const user = session.user as { id?: string; role?: string };

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 }
      );
    }

    if (!user.id) {
      return NextResponse.json(
        { error: "Session enthält keine Benutzer-ID." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateReleaseBody;

    const title = normalizeRequiredString(body.title);
    const version = normalizeRequiredString(body.version);
    const slugInput = normalizeRequiredString(body.slug);
    const slug = slugify(slugInput || title);

    const description = normalizeOptionalString(body.description);
    const changelog = normalizeOptionalString(body.changelog);
    const shortDescription = normalizeOptionalString(body.shortDescription);

    const fileUrl = normalizeRequiredString(body.fileUrl);
    const filePath = normalizeRequiredString(body.filePath);
    const fileName = normalizeRequiredString(body.fileName);
    const fileType = normalizeOptionalString(body.fileType);
    const fileSize =
      typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
        ? Math.max(0, Math.floor(body.fileSize))
        : 0;

    const imageUrl = normalizeOptionalString(body.imageUrl);
    const imagePath = normalizeOptionalString(body.imagePath);

    const status: ReleaseStatus = isValidReleaseStatus(body.status)
      ? body.status
      : "DRAFT";

    if (!title) {
      return NextResponse.json({ error: "title fehlt." }, { status: 400 });
    }

    if (!version) {
      return NextResponse.json({ error: "version fehlt." }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json(
        { error: "slug konnte nicht erzeugt werden." },
        { status: 400 }
      );
    }

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl fehlt." }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: "filePath fehlt." }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ error: "fileName fehlt." }, { status: 400 });
    }

    if (!isSafeReleaseStoragePath(filePath)) {
      return NextResponse.json(
        { error: "Ungültiger filePath." },
        { status: 400 }
      );
    }

    if (imagePath && !isSafeReleaseStoragePath(imagePath)) {
      return NextResponse.json(
        { error: "Ungültiger imagePath." },
        { status: 400 }
      );
    }

    const existing = await prisma.release.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ein Release mit diesem Slug existiert bereits." },
        { status: 409 }
      );
    }

    const finalDescription = description ?? shortDescription ?? `${title} ${version}`;

    const release = await prisma.release.create({
      data: {
        title,
        version,
        slug,
        description: finalDescription,
        changelog,
        fileUrl,
        imageUrl,
        status,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      release,
      meta: {
        filePath,
        fileName,
        fileSize,
        fileType,
        imagePath,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Serverfehler.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}