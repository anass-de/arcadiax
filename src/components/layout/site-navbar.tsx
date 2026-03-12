"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ImageIcon,
  MessageSquare,
  Users,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Shield,
  Film,
  House,
} from "lucide-react";

type NavbarUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type SiteNavbarProps = {
  user?: NavbarUser | null;
};

function getDisplayName(user?: NavbarUser | null) {
  if (!user) return "";
  return user.name?.trim() || user.email?.split("@")[0] || "User";
}

function getInitials(user?: NavbarUser | null) {
  const source = getDisplayName(user) || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavbar({ user }: SiteNavbarProps) {
  const pathname = usePathname();

  const isLoggedIn = !!user;
  const isAdmin = user?.role === "ADMIN";

  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  const guestLinks = [
    { href: "/", label: "Home", icon: House },
    { href: "/releases", label: "Releases", icon: Package },
    { href: "/videos", label: "Videos", icon: Film },
    { href: "/photos", label: "Fotos", icon: ImageIcon },
  ];

  const userLinks = [
    { href: "/", label: "Home", icon: House },
    { href: "/releases", label: "Releases", icon: Package },
    { href: "/videos", label: "Videos", icon: Film },
    { href: "/photos", label: "Fotos", icon: ImageIcon },
    { href: "/profile", label: "Profil", icon: User },
  ];

  const adminLinks = [
    { href: "/", label: "Home", icon: House },
    { href: "/releases", label: "Releases", icon: Package },
    { href: "/videos", label: "Videos", icon: Film },
    { href: "/photos", label: "Fotos", icon: ImageIcon },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/media", label: "Home Media", icon: ImageIcon },
    { href: "/dashboard/comments", label: "Kommentare", icon: MessageSquare },
    { href: "/dashboard/users", label: "Benutzer", icon: Users },
  ];

  const navLinks = isAdmin ? adminLinks : isLoggedIn ? userLinks : guestLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05070b]/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={isAdmin ? "/dashboard" : "/"}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-blue-500/30 hover:bg-white/[0.05]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/20 via-cyan-400/10 to-transparent shadow-[0_0_30px_rgba(59,130,246,0.14)]">
              {isAdmin ? (
                <Shield className="h-5 w-5 text-blue-300" />
              ) : (
                <Package className="h-5 w-5 text-blue-300" />
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-lg font-semibold tracking-tight text-white">
                ArcadiaX
              </div>
              <div className="truncate text-[11px] uppercase tracking-[0.28em] text-white/45">
                {isAdmin ? "Admin Console" : "Release Platform"}
              </div>
            </div>
          </Link>
        </div>

        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    active
                      ? "border border-blue-500/30 bg-blue-500/12 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_30px_rgba(0,0,0,0.25)]"
                      : "border border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-4 w-4 transition",
                      active
                        ? "text-blue-300"
                        : "text-white/45 group-hover:text-white/80",
                    ].join(" ")}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-3">
          {!isLoggedIn ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Link>

              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-medium text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <UserPlus className="h-4 w-4 text-blue-300" />
                <span>Register</span>
              </Link>
            </div>
          ) : (
            <>
              <Link
                href={isAdmin ? "/dashboard" : "/profile"}
                className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-white/15 hover:bg-white/[0.05] md:flex"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] text-sm font-semibold text-white">
                  {initials}
                </div>

                <div className="max-w-[180px] min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {displayName}
                  </div>
                  <div className="truncate text-xs text-white/45">
                    {isAdmin ? "Administrator" : "Angemeldet"}
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-3 lg:hidden sm:px-6">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-blue-500/30 bg-blue-500/12 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05] hover:text-white",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-4 w-4",
                    active ? "text-blue-300" : "text-white/45",
                  ].join(" ")}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {!isLoggedIn ? (
            <>
              <Link
                href="/login"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Link>

              <Link
                href="/register"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/12 px-3 py-2 text-sm font-medium text-white"
              >
                <UserPlus className="h-4 w-4 text-blue-300" />
                <span>Register</span>
              </Link>
            </>
          ) : (
            <Link
              href={isAdmin ? "/dashboard" : "/profile"}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/80"
            >
              <User className="h-4 w-4 text-white/60" />
              <span>{displayName}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}