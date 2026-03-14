import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SessionUser = {
  id?: string | null;
  email?: string | null;
  role?: "ADMIN" | "USER" | null;
  name?: string | null;
};

type UpdateBody = {
  username?: string;
  email?: string;
  password?: string;
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

function normalizeUsername(value?: string) {
  return (value ?? "").trim();
}

function normalizeEmail(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePassword(value?: string) {
  return (value ?? "").trim();
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = getSessionUser(session);

    if (!sessionUser?.email) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: sessionUser.email,
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer wurde nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
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
    const sessionUser = getSessionUser(session);

    if (!sessionUser?.email) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as UpdateBody | null;

    if (!body) {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);

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

    if (username.length > 30) {
      return NextResponse.json(
        { error: "Username darf maximal 30 Zeichen lang sein." },
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
        { error: "Das Passwort muss mindestens 6 Zeichen lang sein." },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: {
        email: sessionUser.email,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "Benutzer wurde nicht gefunden." },
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
        { error: "Diese E-Mail-Adresse ist bereits vergeben." },
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
      message: "Profil wurde erfolgreich aktualisiert.",
    });
  } catch (error) {
    console.error("PATCH /api/profile error:", error);

    return NextResponse.json(
      { error: "Serverfehler beim Speichern des Profils." },
      { status: 500 }
    );
  }
}