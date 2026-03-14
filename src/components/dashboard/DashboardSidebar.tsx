"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Package,
  Shield,
  Users,
} from "lucide-react";

type DashboardSidebarProps = {
  userName?: string;
  userEmail?: string;
};

type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  {
    label: "Übersicht",
    href: "/dashboard",
    description: "Dashboard Startseite",
    icon: LayoutDashboard,
  },
  {
    label: "Releases",
    href: "/dashboard/releases",
    description: "Versionen verwalten",
    icon: Package,
  },
  {
    label: "Media",
    href: "/dashboard/media",
    description: "Bilder und Videos",
    icon: FolderOpen,
  },
  {
    label: "Kommentare",
    href: "/dashboard/comments",
    description: "Kommentare moderieren",
    icon: MessageSquare,
  },
  {
    label: "Benutzer",
    href: "/dashboard/users",
    description: "Accounts und Rollen",
    icon: Users,
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getDisplayName(userName?: string, userEmail?: string) {
  if (userName?.trim()) return userName.trim();
  if (userEmail?.trim()) return userEmail.split("@")[0];
  return "Administrator";
}

export default function DashboardSidebar({
  userName,
  userEmail,
}: DashboardSidebarProps) {
  const pathname = usePathname() || "/dashboard";
  const displayName = getDisplayName(userName, userEmail);

  return (
    <aside className="sticky top-6 rounded-3xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-6 border-b border-white/10 pb-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
          <Shield className="h-3.5 w-3.5" />
          ArcadiaX Admin
        </div>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Verwaltung für Inhalte, Medien, Community und Benutzer.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">{displayName}</p>
          <p className="mt-1 break-all text-xs text-zinc-500">
            {userEmail?.trim() || "Keine E-Mail verfügbar"}
          </p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group block rounded-2xl border px-4 py-3 transition-all duration-200",
                active
                  ? "border-cyan-400/30 bg-cyan-400/10 shadow-lg shadow-cyan-950/20"
                  : "border-white/10 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-800/70",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",
                    active
                      ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-300"
                      : "border-white/10 bg-white/5 text-zinc-400 group-hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0">
                  <div
                    className={[
                      "text-sm font-semibold transition",
                      active ? "text-white" : "text-zinc-200 group-hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </div>

                  <div
                    className={[
                      "mt-1 text-xs transition",
                      active ? "text-cyan-100/80" : "text-zinc-500 group-hover:text-zinc-400",
                    ].join(" ")}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="space-y-2">
          <Link
            href="/"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-white"
          >
            <span>Zur Startseite</span>
            <ExternalLink className="h-4 w-4" />
          </Link>

          <Link
            href="/releases"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-white"
          >
            <span>Öffentliche Releases</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}