import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SessionUser = {
  id?: string | null;
  role?: "USER" | "ADMIN" | null;
  email?: string | null;
  name?: string | null;
};

type AdminSessionUser = {
  id: string;
  role: "ADMIN";
  email?: string | null;
  name?: string | null;
};

type CreateReleasePayload = {
  title?: string;
  version?: string;
  slug?: string;
  description?: string | null;
  changelog?: string | null;
  status?: "DRAFT" | "PUBLISHED" | string;
  fileUrl?: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  imageUrl?: string | null;
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

async function requireAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = getSessionUser(session);

  if (!user?.id || user.role !== "ADMIN") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", "/dashboard/releases/new");

    return {
      ok: false as const,
      response: NextResponse.redirect(loginUrl, 303),
    };
  }

  return {
    ok: true as const,
    user: user as AdminSessionUser,
  };
}

function normalizeOptionalText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function slugify(value: string) {
  const slug =
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "release";

  return slug.slice(0, 120);
}

async function createUniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.release.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

function redirectToNewWithError(request: NextRequest, message: string) {
  const url = new URL("/dashboard/releases/new", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

function redirectToEditWithSuccess(
  request: NextRequest,
  releaseId: string,
  message: string
) {
  const url = new URL(`/dashboard/releases/${releaseId}/edit`, request.url);
  url.searchParams.set("success", message);
  return NextResponse.redirect(url, 303);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.user.id;

    let payload: CreateReleasePayload;

    try {
      payload = (await request.json()) as CreateReleasePayload;
    } catch {
      return redirectToNewWithError(
        request,
        "Ungültige Anfrage. Es wurden keine gültigen JSON-Daten gesendet."
      );
    }

    const title = String(payload.title ?? "").trim();
    const version = String(payload.version ?? "").trim();
    const slugInput = String(payload.slug ?? "").trim();
    const description = normalizeOptionalText(payload.description);
    const changelog = normalizeOptionalText(payload.changelog);
    const statusRaw = String(payload.status ?? "PUBLISHED")
      .trim()
      .toUpperCase();

    const fileUrl = String(payload.fileUrl ?? "").trim();
    const fileName = normalizeOptionalText(payload.fileName);
    const fileSize =
      typeof payload.fileSize === "number" && Number.isFinite(payload.fileSize)
        ? payload.fileSize
        : null;
    const mimeType = normalizeOptionalText(payload.mimeType);
    const imageUrl = normalizeOptionalText(payload.imageUrl);

    if (!title) {
      return redirectToNewWithError(request, "Titel darf nicht leer sein.");
    }

    if (!version) {
      return redirectToNewWithError(request, "Version darf nicht leer sein.");
    }

    if (statusRaw !== "DRAFT" && statusRaw !== "PUBLISHED") {
      return redirectToNewWithError(request, "Ungültiger Status.");
    }

    if (!fileUrl) {
      return redirectToNewWithError(
        request,
        "Die Release-Datei wurde noch nicht hochgeladen."
      );
    }

    if (!isValidHttpUrl(fileUrl)) {
      return redirectToNewWithError(
        request,
        "Die Release-Datei-URL ist ungültig."
      );
    }

    if (imageUrl && !isValidHttpUrl(imageUrl)) {
      return redirectToNewWithError(
        request,
        "Die Bild-URL ist ungültig."
      );
    }

    const baseSlug = slugify(slugInput || title);
    const uniqueSlug = await createUniqueSlug(baseSlug);

    const createdRelease = await prisma.release.create({
      data: {
        title,
        version,
        slug: uniqueSlug,
        description,
        changelog,
        fileUrl,
        imageUrl,
        status: statusRaw as "DRAFT" | "PUBLISHED",
        authorId: userId,
      },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/releases");
    revalidatePath("/dashboard/releases/new");
    revalidatePath(`/dashboard/releases/${createdRelease.id}/edit`);
    revalidatePath("/releases");
    revalidatePath(`/releases/${createdRelease.slug}`);

    return redirectToEditWithSuccess(
      request,
      createdRelease.id,
      createdRelease.status === "PUBLISHED"
        ? "Release wurde erfolgreich erstellt und veröffentlicht."
        : "Release wurde erfolgreich als Entwurf gespeichert."
    );
  } catch (error) {
    console.error("POST /api/admin/releases error:", error);

    return redirectToNewWithError(
      request,
      error instanceof Error
        ? error.message
        : "Beim Erstellen des Releases ist ein Fehler aufgetreten."
    );
  }
}