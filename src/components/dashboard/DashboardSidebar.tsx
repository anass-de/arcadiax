import Link from "next/link";

type DashboardSidebarProps = {
  currentPath?: string;
  userName?: string;
  userEmail?: string;
};

type NavItem = {
  label: string;
  href: string;
  description: string;
};

const navItems: NavItem[] = [
  {
    label: "Übersicht",
    href: "/dashboard",
    description: "Dashboard Startseite",
  },
  {
    label: "Releases",
    href: "/dashboard/releases",
    description: "Versionen verwalten",
  },
  {
    label: "Media",
    href: "/dashboard/media",
    description: "Bilder und Videos",
  },
  {
    label: "Kommentare",
    href: "/dashboard/comments",
    description: "Kommentare moderieren",
  },
  {
    label: "Benutzer",
    href: "/dashboard/users",
    description: "Accounts und Rollen",
  },
];

function isActive(currentPath: string | undefined, href: string) {
  if (!currentPath) return false;
  if (href === "/dashboard") return currentPath === "/dashboard";
  return currentPath.startsWith(href);
}

export default function DashboardSidebar({
  currentPath,
  userName,
  userEmail,
}: DashboardSidebarProps) {
  return (
    <aside className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-6 border-b border-zinc-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          ArcadiaX Admin
        </p>

        <h2 className="mt-2 text-xl font-bold text-white">Dashboard</h2>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm font-medium text-white">
            {userName || "Admin"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{userEmail || "—"}</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = isActive(currentPath, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-2xl border px-4 py-3 transition ${
                active
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-800/60"
              }`}
            >
              <div className="text-sm font-semibold text-white">
                {item.label}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {item.description}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <div className="space-y-2">
          <Link
            href="/"
            className="block rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Zur Startseite
          </Link>

          <Link
            href="/releases"
            className="block rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Öffentliche Releases
          </Link>
        </div>
      </div>
    </aside>
  );
}