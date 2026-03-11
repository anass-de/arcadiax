import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET;

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

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { session: null, response: jsonError("Nicht eingeloggt.", 401) };
  }

  if (session.user.role !== "ADMIN") {
    return { session: null, response: jsonError("Kein Zugriff.", 403) };
  }

  return { session, response: null };
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function getStoragePathFromPublicUrl(fileUrl: string): string | null {
  if (!SUPABASE_STORAGE_BUCKET || !fileUrl) return null;

  try {
    const url = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
    const index = url.pathname.indexOf(marker);

    if (index === -1) return null;

    const rawPath = url.pathname.slice(index + marker.length);
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
}

async function removeSupabaseObjects(urls: Array<string | null | undefined>) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !SUPABASE_STORAGE_BUCKET) return;

  const paths = urls
    .map((url) => (url ? getStoragePathFromPublicUrl(url) : null))
    .filter((value): value is string => Boolean(value));

  if (paths.length === 0) return;

  const uniquePaths = Array.from(new Set(paths));

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove(uniquePaths);

  if (error) {
    console.error("Supabase remove warning:", error);
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await context.params;

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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await context.params;
    const body = await req.json().catch(() => null);

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
      body?.title !== undefined ? String(body.title).trim() : current.title;

    const nextVersion =
      body?.version !== undefined ? String(body.version).trim() : current.version;

    let nextSlug =
      body?.slug !== undefined ? String(body.slug).trim() : current.slug;

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
      return jsonError("Ein anderes Release mit diesem Slug existiert bereits.", 409);
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

    if (body?.description !== undefined) {
      const value = String(body.description ?? "").trim();
      data.description = value || null;
    }

    if (body?.changelog !== undefined) {
      const value = String(body.changelog ?? "").trim();
      data.changelog = value || null;
    }

    if (body?.fileUrl !== undefined) {
      const value = String(body.fileUrl ?? "").trim();
      if (!value) {
        return jsonError("fileUrl ist ungültig.");
      }
      data.fileUrl = value;
    }

    if (body?.imageUrl !== undefined) {
      const value = String(body.imageUrl ?? "").trim();
      data.imageUrl = value || null;
    }

    if (body?.status !== undefined) {
      const value = String(body.status ?? "").trim().toUpperCase();
      if (value !== "DRAFT" && value !== "PUBLISHED") {
        return jsonError("Ungültiger Status.");
      }
      data.status = value;
    }

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

    if (body?.fileUrl !== undefined && current.fileUrl && current.fileUrl !== updated.fileUrl) {
      await removeSupabaseObjects([current.fileUrl]);
    }

    if (body?.imageUrl !== undefined && current.imageUrl && current.imageUrl !== updated.imageUrl) {
      await removeSupabaseObjects([current.imageUrl]);
    }

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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await context.params;

    const release = await prisma.release.findUnique({
      where: { id },
      select: {
        id: true,
        fileUrl: true,
        imageUrl: true,
      },
    });

    if (!release) {
      return jsonError("Release nicht gefunden.", 404);
    }

    await prisma.release.delete({
      where: { id },
    });

    await removeSupabaseObjects([release.fileUrl, release.imageUrl]);

    return NextResponse.json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/admin/releases/[id] error:", error);
    return jsonError("Interner Serverfehler.", 500);
  }
}