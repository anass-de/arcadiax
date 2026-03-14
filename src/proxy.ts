import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

async function getAuthToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
}

function buildLoginUrl(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return loginUrl;
}

export async function middleware(req: NextRequest) {
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
  const role = String((token as { role?: string } | null)?.role ?? "").toUpperCase();
  const isAdmin = role === "ADMIN";

  // Login/Register nur für Gäste
  if (pathname === "/login" || pathname === "/register") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  // Öffentliche Seiten
  if (
    pathname === "/" ||
    pathname.startsWith("/releases") ||
    pathname.startsWith("/videos") ||
    pathname.startsWith("/photos")
  ) {
    return NextResponse.next();
  }

  // Öffentliche APIs
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/releases")
  ) {
    return NextResponse.next();
  }

  // Profil-API nur für eingeloggte Nutzer
  if (pathname.startsWith("/api/profile")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    return NextResponse.next();
  }

  // Profile nur für eingeloggte Nutzer
  if (pathname.startsWith("/profile")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(buildLoginUrl(req));
    }

    return NextResponse.next();
  }

  // Dashboard strikt nur für Admins
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(buildLoginUrl(req));
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  // Admin-API strikt nur für Admins
  if (pathname.startsWith("/api/admin")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};