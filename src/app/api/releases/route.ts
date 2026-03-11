// src/app/api/releases/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const releases = await prisma.release.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, username: true, image: true } } },
  });

  return Response.json(releases);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const version = String(body?.version ?? "").trim();
  const fileUrl = String(body?.fileUrl ?? "").trim();
  const description = body?.description != null ? String(body.description).trim() : null;

  if (!title || !version || !fileUrl) {
    return new Response("Missing fields: title, version, fileUrl", { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return new Response("Unauthorized", { status: 401 });

  const created = await prisma.release.create({
    data: {
      title,
      version,
      fileUrl,
      description,
      authorId: user.id,
    },
  });

  return Response.json(created, { status: 201 });
}