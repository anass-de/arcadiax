import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function normalizeOptional(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const formData = await req.formData();

    const name = normalizeOptional(formData.get("name"));
    const username = normalizeOptional(formData.get("username"));
    const bio = normalizeOptional(formData.get("bio"));
    const image = normalizeOptional(formData.get("image"));

    if (username && !/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username muss 3-30 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ oder - enthalten.",
        },
        { status: 400 }
      );
    }

    const existingUsername = username
      ? await prisma.user.findFirst({
          where: {
            username,
            NOT: {
              id: session.user.id,
            },
          },
          select: { id: true },
        })
      : null;

    if (existingUsername) {
      return NextResponse.json(
        { error: "Dieser Username ist bereits vergeben." },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        username,
        bio,
        image,
      },
    });

    return NextResponse.redirect(new URL("/profile", req.url));
  } catch (error) {
    console.error("POST /api/profile error:", error);

    return NextResponse.json(
      { error: "Profil konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}