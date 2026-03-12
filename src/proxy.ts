import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

async function getAuthToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Immer erlauben: Next intern + statische Dateien
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/uploads") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getAuthToken(req);
  const isLoggedIn = !!token;
  const role = String(token?.role ?? "").toUpperCase();
  const isAdmin = role === "ADMIN";

  // Login/Register nur für Gäste
  if (pathname === "/login" || pathname === "/register") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  // Öffentliche Seiten
  if (pathname === "/" || pathname.startsWith("/releases")) {
    return NextResponse.next();
  }

  // Öffentliche APIs
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/register" ||
    pathname.startsWith("/api/releases") ||
    pathname.startsWith("/api/comments") ||
    pathname.startsWith("/api/download")
  ) {
    return NextResponse.next();
  }

  // Profile nur für eingeloggte Nutzer
  if (pathname.startsWith("/profile")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  }

  // Dashboard strikt nur für Admins
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  // Admin-API strikt nur für Admins
  if (pathname.startsWith("/api/admin")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};