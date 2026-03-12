"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Home,
  Package,
  User,
  LayoutDashboard,
  LogOut,
  LogIn,
} from "lucide-react";

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

  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
        "border border-white/10 bg-white/5 text-white/80",
        "transition hover:bg-white/10 hover:text-white",
        "whitespace-nowrap",
        active ? "ring-1 ring-white/20 text-white" : "",
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

  const role = ((session?.user as any)?.role ?? "USER")
    .toString()
    .toUpperCase();

  const isAdmin = role === "ADMIN";

  const username = ((session?.user as any)?.username ?? null) as
    | string
    | null;

  const displayName =
    session?.user?.name || username || session?.user?.email || "User";

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="ArcadiaX Logo"
              width={40}
              height={40}
              className="rounded-xl"
              priority
            />

            <div className="min-w-0 leading-tight">
              <div className="truncate font-semibold tracking-wide">
                ArcadiaX
              </div>
              <div className="truncate text-xs text-white/60">
                Downloads • Community • Releases
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <NavLink href="/" icon={<Home size={16} />} label="Home" />
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

          <div className="flex items-center gap-2">
            {!isLoggedIn ? (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">Login</span>
              </Link>
            ) : (
              <>
                {username ? (
                  <Link
                    href={`/u/${username}`}
                    className="inline-flex max-w-[180px] items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 transition hover:bg-blue-500/20"
                  >
                    <User size={16} className="shrink-0" />
                    <span className="truncate">{displayName}</span>
                  </Link>
                ) : (
                  <span className="inline-flex max-w-[180px] items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
                    <User size={16} className="shrink-0" />
                    <span className="truncate">{displayName}</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 md:hidden">
          <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <NavLink href="/" icon={<Home size={16} />} label="Home" />
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}