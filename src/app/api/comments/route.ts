// src/app/api/comments/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function normTarget(v: string | null) {
  const t = (v ?? "home").toLowerCase();
  return t === "release" ? "RELEASE" : "HOME";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = normTarget(searchParams.get("target"));
  const releaseId = searchParams.get("releaseId");

  const where =
    target === "HOME"
      ? { target: "HOME" as const }
      : { target: "RELEASE" as const, releaseId: releaseId ?? undefined };

  if (target === "RELEASE" && !releaseId) {
    return new Response("Missing releaseId for target=release", { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return Response.json(comments);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);

  const text = String(body?.body ?? "").trim();
  const target = normTarget(body?.target ?? "home");
  const parentId = body?.parentId ? String(body.parentId) : null;

  const releaseId = body?.releaseId ? String(body.releaseId) : null;

  if (!text) return new Response("Body is required", { status: 400 });
  if (target === "RELEASE" && !releaseId) {
    return new Response("releaseId is required when target=release", { status: 400 });
  }

  const created = await prisma.comment.create({
    data: {
      body: text,
      target: target as any,
      parentId,
      releaseId: target === "RELEASE" ? releaseId : null,
      authorId: user.id,
    },
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return Response.json(created, { status: 201 });
}