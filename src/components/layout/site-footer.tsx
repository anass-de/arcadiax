import Link from "next/link";

type FooterUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type SiteFooterProps = {
  user?: FooterUser | null;
};

function getDisplayName(user?: FooterUser | null) {
  if (!user) return "";
  return user.name?.trim() || user.email?.split("@")[0] || "User";
}

export default function SiteFooter({ user }: SiteFooterProps) {
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "ADMIN";
  const displayName = getDisplayName(user);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#05070b]/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-3">
              <div className="text-xl font-semibold tracking-tight text-white">
                ArcadiaX
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-white/40">
                {isAdmin ? "Admin Console" : "Release Platform"}
              </div>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/60">
              Verwalte Releases, Medien und Community-Inhalte in einer
              modernen Plattform mit dunklem, klar strukturiertem Interface.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-sm font-semibold text-white">
              Navigation
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/releases"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Releases
              </Link>

              {isLoggedIn && !isAdmin && (
                <Link
                  href="/profile"
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                >
                  Profil
                </Link>
              )}

              {isAdmin && (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-sm text-white transition hover:border-blue-400/35 hover:bg-blue-500/15"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/media"
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  >
                    Media
                  </Link>
                  <Link
                    href="/dashboard/comments"
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  >
                    Kommentare
                  </Link>
                  <Link
                    href="/dashboard/users"
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  >
                    Benutzer
                  </Link>
                </>
              )}

              {!isLoggedIn && (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-sm font-semibold text-white">Status</div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#06080d] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-white/35">
                  Konto
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {isLoggedIn ? displayName : "Nicht eingeloggt"}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {isAdmin
                    ? "Administrator"
                    : isLoggedIn
                    ? "Benutzerkonto aktiv"
                    : "Gastzugriff"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#06080d] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-white/35">
                  Plattform
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  ArcadiaX
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Releases, Verwaltung und Community
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {year} ArcadiaX. Alle Rechte vorbehalten.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="transition hover:text-white/80"
            >
              Startseite
            </Link>
            <Link
              href="/releases"
              className="transition hover:text-white/80"
            >
              Releases
            </Link>
            <span className="text-white/20">•</span>
            <span className="text-white/35">
              Built with Next.js, Prisma & Supabase
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}