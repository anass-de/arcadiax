import Link from "next/link";
import {
  Boxes,
  Users,
  ImageIcon,
  Film,
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  User,
  LogIn,
  UserPlus,
} from "lucide-react";

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

function FooterLink({
  href,
  icon: Icon,
  children,
  highlighted = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
        highlighted
          ? "border-[#6c5ce7]/30 bg-[#6c5ce7]/10 text-white hover:border-[#6c5ce7]/50 hover:bg-[#6c5ce7]/15"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.05] hover:text-white",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-4 w-4 transition",
          highlighted
            ? "text-[#8b7cf6]"
            : "text-white/45 group-hover:text-[#8b7cf6]",
        ].join(" ")}
      />
      <span>{children}</span>
    </Link>
  );
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
              <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-[#8b7cf6]/70">
                {isAdmin ? "Admin Console" : "Release Platform"}
              </div>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/60">
              Verwalte Releases, Medien und Community-Inhalte in einer modernen
              Plattform mit dunklem, elegantem Interface im ArcadiaX-Stil.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-sm font-semibold text-white">
              Navigation
            </div>

            <div className="flex flex-wrap gap-2">
              <FooterLink href="/releases" icon={Boxes}>
                Releases
              </FooterLink>

              <FooterLink href="/community" icon={Users}>
                Community
              </FooterLink>

              <FooterLink href="/photos" icon={ImageIcon}>
                Fotos
              </FooterLink>

              <FooterLink href="/videos" icon={Film}>
                Videos
              </FooterLink>

              {isLoggedIn && !isAdmin && (
                <FooterLink href="/profile" icon={User}>
                  Profil
                </FooterLink>
              )}

              {isAdmin && (
                <>
                  <FooterLink
                    href="/dashboard"
                    icon={LayoutDashboard}
                    highlighted
                  >
                    Dashboard
                  </FooterLink>

                  <FooterLink href="/dashboard/media" icon={FolderOpen}>
                    Media
                  </FooterLink>

                  <FooterLink
                    href="/dashboard/comments"
                    icon={MessageSquare}
                  >
                    Kommentare
                  </FooterLink>

                  <FooterLink href="/dashboard/users" icon={Users}>
                    Benutzer
                  </FooterLink>
                </>
              )}

              {!isLoggedIn && (
                <>
                  <FooterLink href="/login" icon={LogIn}>
                    Login
                  </FooterLink>

                  <FooterLink href="/register" icon={UserPlus}>
                    Register
                  </FooterLink>
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
                  Releases, Medien, Verwaltung und Community
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <div>© {year} ArcadiaX. Alle Rechte vorbehalten.</div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="transition hover:text-white/80">
              Startseite
            </Link>
            <Link
              href="/releases"
              className="transition hover:text-white/80"
            >
              Releases
            </Link>
            <Link
              href="/community"
              className="transition hover:text-white/80"
            >
              Community
            </Link>
            <Link href="/photos" className="transition hover:text-white/80">
              Fotos
            </Link>
            <Link href="/videos" className="transition hover:text-white/80">
              Videos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}