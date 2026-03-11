import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawUsername = String(body?.username ?? "").trim();
    const normalizedUsername = rawUsername.toLowerCase();
    const rawEmail = String(body?.email ?? "").trim().toLowerCase();
    const rawPassword = String(body?.password ?? "");

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
            "Der Username ist ungültig. Erlaubt sind 3-20 Zeichen: Buchstaben, Zahlen, _ und -.",
        },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(rawEmail)) {
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

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: normalizedUsername }, { email: rawEmail }],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username oder E-Mail existiert bereits." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const role = rawEmail === adminEmail ? "ADMIN" : "USER";

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
        message: "Registrierung erfolgreich.",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Fehler bei der Registrierung:", error);

    return NextResponse.json(
      { error: "Interner Serverfehler bei der Registrierung." },
      { status: 500 }
    );
  }
}