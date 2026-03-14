"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
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
  icon: ComponentType<{ className?: string }>;
};

const BRAND = "#6c5ce7";

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    description: "Dashboard home",
    icon: LayoutDashboard,
  },
  {
    label: "Releases",
    href: "/dashboard/releases",
    description: "Manage versions",
    icon: Package,
  },
  {
    label: "Media",
    href: "/dashboard/media",
    description: "Images and videos",
    icon: FolderOpen,
  },
  {
    label: "Comments",
    href: "/dashboard/comments",
    description: "Moderate discussions",
    icon: MessageSquare,
  },
  {
    label: "Users",
    href: "/dashboard/users",
    description: "Accounts and roles",
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
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{
            borderColor: "rgba(108, 92, 231, 0.22)",
            backgroundColor: "rgba(108, 92, 231, 0.10)",
            color: BRAND,
          }}
        >
          <Shield className="h-3.5 w-3.5" />
          ArcadiaX Admin
        </div>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Control content, media, community, and users from one place.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">{displayName}</p>
          <p className="mt-1 break-all text-xs text-zinc-500">
            {userEmail?.trim() || "No email available"}
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
                  ? "shadow-lg"
                  : "border-white/10 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-800/70",
              ].join(" ")}
              style={
                active
                  ? {
                      borderColor: "rgba(108, 92, 231, 0.28)",
                      backgroundColor: "rgba(108, 92, 231, 0.10)",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition"
                  style={
                    active
                      ? {
                          borderColor: "rgba(108, 92, 231, 0.28)",
                          backgroundColor: "rgba(108, 92, 231, 0.14)",
                          color: BRAND,
                        }
                      : {
                          borderColor: "rgba(255,255,255,0.10)",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          color: "#a1a1aa",
                        }
                  }
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
                      active ? "text-white/75" : "text-zinc-500 group-hover:text-zinc-400",
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
            <span>Back to Home</span>
            <ExternalLink className="h-4 w-4" />
          </Link>

          <Link
            href="/releases"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-white"
          >
            <span>Public Releases</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}