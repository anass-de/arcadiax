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
  return (value ?? "").trim().toLowerCase();
}

function normalizeEmail(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePassword(value?: string) {
  return (value ?? "").trim();
}

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = getSessionUser(session);

    if (!sessionUser?.email) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: sessionUser.email.toLowerCase(),
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error("GET /api/profile error:", error);

    return NextResponse.json(
      { error: "Server error while loading the profile." },
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
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as UpdateBody | null;

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);

    if (!username) {
      return NextResponse.json(
        { error: "Username is required." },
        { status: 400 }
      );
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            "Invalid username. Allowed: 3 to 20 characters using letters, numbers, _ and -.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: {
        email: sessionUser.email.toLowerCase(),
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
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
        { error: "This username is already taken." },
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
        { error: "This email address is already in use." },
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
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/profile error:", error);

    return NextResponse.json(
      { error: "Server error while saving the profile." },
      { status: 500 }
    );
  }
}