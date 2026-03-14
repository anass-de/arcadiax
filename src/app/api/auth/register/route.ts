import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    const rawUsername = String((body as { username?: unknown }).username ?? "").trim();
    const normalizedUsername = rawUsername.toLowerCase();

    const rawEmail = String((body as { email?: unknown }).email ?? "")
      .trim()
      .toLowerCase();

    const rawPassword = String((body as { password?: unknown }).password ?? "");

    if (!rawUsername || !rawEmail || !rawPassword) {
      return NextResponse.json(
        { error: "Username, E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    if (!isValidUsername(rawUsername)) {
      return NextResponse.json(
        {
          error:
            "Der Username ist ungültig. Erlaubt sind 3 bis 20 Zeichen: Buchstaben, Zahlen, _ und -.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(rawEmail)) {
      return NextResponse.json(
        { error: "Bitte gib eine gültige E-Mail-Adresse ein." },
        { status: 400 }
      );
    }

    if (rawPassword.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
        { status: 400 }
      );
    }

    const existingUsername = await prisma.user.findUnique({
      where: {
        username: normalizedUsername,
      },
      select: {
        id: true,
      },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Dieser Username ist bereits vergeben." },
        { status: 409 }
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: {
        email: rawEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const role = adminEmail && rawEmail === adminEmail ? "ADMIN" : "USER";

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: rawEmail,
        passwordHash,
        role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Registrierung erfolgreich.",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler bei der Registrierung." },
      { status: 500 }
    );
  }
}