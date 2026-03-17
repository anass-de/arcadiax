import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2ObjectsFromUrls } from "@/lib/r2";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { session: null, response: jsonError("Nicht eingeloggt.", 401) };
  }

  if ((session.user as { role?: string | null }).role !== "ADMIN") {
    return { session: null, response: jsonError("Kein Zugriff.", 403) };
  }

  return { session, response: null };
}

function revalidateReleasePaths(params: {
  id: string;
  oldSlug?: string | null;
  newSlug?: string | null;
}) {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/releases");
  revalidatePath(`/dashboard/releases/${params.id}/edit`);
  revalidatePath("/releases");

  if (params.oldSlug?.trim()) {
    revalidatePath(`/releases/${params.oldSlug}`);
  } else {
    revalidatePath(`/releases/${params.id}`);
  }

  if (params.newSlug?.trim() && params.newSlug !== params.oldSlug) {
    revalidatePath(`/releases/${params.newSlug}`);
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = context.params;

    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            image: true,
            role: true,
          },
        },
        comments: {
          orderBy: { createdAt: "desc" },
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
        _count: {
          select: {
            comments: true,
            likes: true,
            downloads: true,
          },
        },
      },
    });

    if (!release) {
      return jsonError("Release nicht gefunden.", 404);
    }

    return NextResponse.json({
      ok: true,
      release,
    });
  } catch (error) {
    console.error("GET /api/admin/releases/[id] error:", error);
    return jsonError("Interner Serverfehler.", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = context.params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonError("Ungültige JSON-Anfrage.");
    }

    const current = await prisma.release.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        version: true,
        slug: true,
        description: true,
        changelog: true,
        fileUrl: true,
        imageUrl: true,
        status: true,
      },
    });

    if (!current) {
      return jsonError("Release nicht gefunden.", 404);
    }

    const nextTitle =
      body.title !== undefined ? String(body.title).trim() : current.title;

    const nextVersion =
      body.version !== undefined ? String(body.version).trim() : current.version;

    let nextSlug =
      body.slug !== undefined ? String(body.slug).trim() : current.slug;

    if (!nextTitle) {
      return jsonError("Titel fehlt.");
    }

    if (!nextVersion) {
      return jsonError("Version fehlt.");
    }

    if (!nextSlug) {
      nextSlug = slugify(`${nextTitle}-${nextVersion}`);
    } else {
      nextSlug = slugify(nextSlug);
    }

    if (!nextSlug) {
      return jsonError("Slug ist ungültig.");
    }

    const duplicate = await prisma.release.findFirst({
      where: {
        slug: nextSlug,
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return jsonError(
        "Ein anderes Release mit diesem Slug existiert bereits.",
        409
      );
    }

    const data: {
      title: string;
      version: string;
      slug: string;
      description?: string | null;
      changelog?: string | null;
      fileUrl?: string;
      imageUrl?: string | null;
      status?: "DRAFT" | "PUBLISHED";
    } = {
      title: nextTitle,
      version: nextVersion,
      slug: nextSlug,
    };

    if (body.description !== undefined) {
      data.description = normalizeOptionalText(body.description);
    }

    if (body.changelog !== undefined) {
      data.changelog = normalizeOptionalText(body.changelog);
    }

    if (body.fileUrl !== undefined) {
      const value = String(body.fileUrl ?? "").trim();

      if (!value || !isValidHttpUrl(value)) {
        return jsonError("fileUrl ist ungültig.");
      }

      data.fileUrl = value;
    }

    if (body.imageUrl !== undefined) {
      const value = String(body.imageUrl ?? "").trim();

      if (value && !isValidHttpUrl(value)) {
        return jsonError("imageUrl ist ungültig.");
      }

      data.imageUrl = value || null;
    }

    if (body.status !== undefined) {
      const value = String(body.status ?? "").trim().toUpperCase();

      if (value !== "DRAFT" && value !== "PUBLISHED") {
        return jsonError("Ungültiger Status.");
      }

      data.status = value as "DRAFT" | "PUBLISHED";
    }

    const oldFileUrl = current.fileUrl;
    const oldImageUrl = current.imageUrl;

    const updated = await prisma.release.update({
      where: { id },
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            image: true,
            role: true,
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

    if (body.fileUrl !== undefined && oldFileUrl && oldFileUrl !== updated.fileUrl) {
      try {
        await deleteR2ObjectsFromUrls([oldFileUrl]);
      } catch (error) {
        console.error("R2 cleanup failed for old fileUrl:", error);
      }
    }

    if (
      body.imageUrl !== undefined &&
      oldImageUrl &&
      oldImageUrl !== updated.imageUrl
    ) {
      try {
        await deleteR2ObjectsFromUrls([oldImageUrl]);
      } catch (error) {
        console.error("R2 cleanup failed for old imageUrl:", error);
      }
    }

    revalidateReleasePaths({
      id,
      oldSlug: current.slug,
      newSlug: updated.slug,
    });

    return NextResponse.json({
      ok: true,
      release: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/releases/[id] error:", error);
    return jsonError("Interner Serverfehler.", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = context.params;

    const release = await prisma.release.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        fileUrl: true,
        imageUrl: true,
      },
    });

    if (!release) {
      return jsonError("Release nicht gefunden.", 404);
    }

    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: { releaseId: id },
      }),
      prisma.releaseLike.deleteMany({
        where: { releaseId: id },
      }),
      prisma.download.deleteMany({
        where: { releaseId: id },
      }),
      prisma.release.delete({
        where: { id },
      }),
    ]);

    try {
      await deleteR2ObjectsFromUrls([release.fileUrl, release.imageUrl]);
    } catch (error) {
      console.error("R2 cleanup failed after release delete:", error);
    }

    revalidateReleasePaths({
      id,
      oldSlug: release.slug,
      newSlug: null,
    });

    return NextResponse.json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/admin/releases/[id] error:", error);
    return jsonError("Interner Serverfehler.", 500);
  }
}