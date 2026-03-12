import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "release"
  );
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

export async function GET() {
  try {
    const releases = await prisma.release.findMany({
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
      },
    });

    return Response.json(releases);
  } catch (error) {
    console.error("GET /api/releases error:", error);

    return new Response("Failed to load releases", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const title = String(body?.title ?? "").trim();
    const version = String(body?.version ?? "").trim();
    const fileUrl = String(body?.fileUrl ?? "").trim();
    const description = normalizeOptionalText(body?.description);
    const changelog = normalizeOptionalText(body?.changelog);
    const imageUrl = normalizeOptionalText(body?.imageUrl);
    const slugInput = String(body?.slug ?? "").trim();
    const statusRaw = String(body?.status ?? "DRAFT")
      .trim()
      .toUpperCase();

    if (!title || !version || !fileUrl) {
      return new Response("Missing fields: title, version, fileUrl", {
        status: 400,
      });
    }

    if (statusRaw !== "DRAFT" && statusRaw !== "PUBLISHED") {
      return new Response("Invalid status", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const baseSlug = slugify(slugInput || title);
    const uniqueSlug = await createUniqueSlug(baseSlug);

    const created = await prisma.release.create({
      data: {
        title,
        version,
        slug: uniqueSlug,
        fileUrl,
        description,
        changelog,
        imageUrl,
        status: statusRaw as "DRAFT" | "PUBLISHED",
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

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/releases error:", error);

    return new Response("Failed to create release", { status: 500 });
  }
}