"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import {
  Home,
  Package,
  Heart,
  User,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

import SearchBar from "@/components/SearchBar";

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();

  const active =
    pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        "border border-white/10 bg-white/5 hover:bg-white/10 transition",
        "whitespace-nowrap",
        active ? "ring-1 ring-white/20" : "",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

  const isLoggedIn = status === "authenticated";

  const role =
    ((session?.user as any)?.role ?? "USER")
      .toString()
      .toUpperCase();

  const isAdmin = role === "ADMIN";

  const username =
    ((session?.user as any)?.username ?? null) as string | null;

  const displayName =
    session?.user?.name ||
    username ||
    session?.user?.email ||
    "User";

  return (
    <div className="min-h-screen bg-black text-white">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">

        {/* FIRST ROW */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-3">

            <Image
              src="/logo.png"
              alt="ArcadiaX Logo"
              width={40}
              height={40}
              className="rounded-xl"
              priority
            />

            <div className="leading-tight">
              <div className="font-semibold">
                ArcadiaX
              </div>

              <div className="text-xs text-white/60">
                Downloads • Community • Releases
              </div>
            </div>

          </Link>

          {/* NAVBAR */}
          <nav className="flex items-center gap-2 overflow-x-auto">

            <NavLink
              href="/"
              icon={<Home size={16} />}
              label="Home"
            />

            <NavLink
              href="/releases"
              icon={<Package size={16} />}
              label="Releases"
            />

            {isLoggedIn && (
              <NavLink
                href="/profile"
                icon={<User size={16} />}
                label="Profile"
              />
            )}

            {isAdmin && (
              <NavLink
                href="/dashboard"
                icon={<LayoutDashboard size={16} />}
                label="Dashboard"
              />
            )}

          </nav>

          {/* USER AREA */}
          <div className="flex items-center gap-2">

            {!isLoggedIn ? (

              <Link
                href="/login"
                className="rounded-xl bg-white px-3 py-2 text-sm text-black hover:opacity-90"
              >
                Login
              </Link>

            ) : (

              <>

                {username ? (

                  <Link
                    href={`/u/${username}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 transition"
                  >
                    <User size={16} />
                    {displayName}
                  </Link>

                ) : (

                  <span className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
                    {displayName}
                  </span>

                )}

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition"
                >
                  <LogOut size={16} />
                  Logout
                </button>

              </>

            )}

          </div>

        </div>

        {/* SECOND ROW — SEARCHBAR */}
        <div className="border-t border-white/10 py-4">

          <div className="mx-auto flex w-full max-w-7xl justify-center px-4">

            <div className="w-full sm:w-[90%] md:w-[80%] lg:w-[70%]">

              <SearchBar />

            </div>

          </div>

        </div>

      </header>

      {/* MAIN */}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {children}

      </main>

    </div>
  );
}