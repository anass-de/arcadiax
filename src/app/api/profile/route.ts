import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type UpdateBody = {
  username?: string;
  email?: string;
  password?: string;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      username: user.username ?? "",
      email: user.email ?? "",
    });
  } catch (error) {
    console.error("GET /api/profile error:", error);

    return NextResponse.json(
      { error: "Serverfehler beim Laden des Profils." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as UpdateBody;

    const username = body.username?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";

    if (!username) {
      return NextResponse.json(
        { error: "Username ist erforderlich." },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username muss mindestens 3 Zeichen lang sein." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail ist erforderlich." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Ungültige E-Mail-Adresse." },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 6 Zeichen lang sein." },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    const usernameTaken = await prisma.user.findFirst({
      where: {
        username,
        NOT: {
          id: currentUser.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (usernameTaken) {
      return NextResponse.json(
        { error: "Dieser Username ist bereits vergeben." },
        { status: 409 }
      );
    }

    const emailTaken = await prisma.user.findFirst({
      where: {
        email,
        NOT: {
          id: currentUser.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (emailTaken) {
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits vergeben." },
        { status: 409 }
      );
    }

    const data: {
      username: string;
      email: string;
      passwordHash?: string;
    } = {
      username,
      email,
    };

    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: {
        id: currentUser.id,
      },
      data,
    });

    return NextResponse.json({
      ok: true,
      message: "Profil erfolgreich aktualisiert.",
    });
  } catch (error) {
    console.error("PATCH /api/profile error:", error);

    return NextResponse.json(
      { error: "Serverfehler beim Speichern des Profils." },
      { status: 500 }
    );
  }
}