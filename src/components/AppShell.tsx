// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Home, LogOut, LayoutDashboard, User } from "lucide-react";

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
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        "border border-white/10 bg-white/5 hover:bg-white/10 transition",
        active ? "ring-1 ring-white/20" : "",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const role = ((session?.user as any)?.role ?? "USER").toString().toUpperCase();
  const isAdmin = role === "ADMIN";

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/10">
              <span className="text-sm font-bold">AX</span>
            </div>
            <div className="leading-tight">
              <div className="font-semibold">ArcadiaX</div>
              <div className="text-xs text-white/60">Downloads • Community</div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <NavLink href="/" icon={<Home size={16} />} label="Home" />

            {isLoggedIn && (
              <NavLink href="/profile" icon={<User size={16} />} label="Profil" />
            )}

            {isAdmin && (
              <NavLink
                href="/dashboard"
                icon={<LayoutDashboard size={16} />}
                label="Dashboard"
              />
            )}

            <div className="ml-2 flex items-center gap-2">
              {!isLoggedIn ? (
                <Link
                  href="/login"
                  className="rounded-xl bg-white px-3 py-2 text-sm text-black hover:opacity-90"
                >
                  Login
                </Link>
              ) : (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}