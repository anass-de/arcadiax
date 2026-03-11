import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Statische Dateien und Next-internes immer erlauben
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/uploads") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Öffentliche Seiten und öffentliche APIs erlauben
  if (
    pathname === "/" ||
    pathname.startsWith("/releases") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/releases") ||
    pathname.startsWith("/api/comments") ||
    pathname.startsWith("/api/download")
  ) {
    return NextResponse.next();
  }

  // Dashboard nur für eingeloggte Nutzer
  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  }

  // Admin-API nur für Admins
  if (pathname.startsWith("/api/admin")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (token.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};