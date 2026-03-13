import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Download,
  Gamepad2,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Package,
  Shield,
  Sparkles,
  Users,
  Film,
  ExternalLink,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type HomeMediaRow = {
  id: string;
  type: "IMAGE" | "VIDEO";
  title: string | null;
  description: string | null;
  url: string;
  sortOrder: number;
  active: boolean;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function getPrimaryAction(role?: string | null) {
  if (role === "ADMIN") {
    return {
      href: "/dashboard",
      label: "Zum Dashboard",
      icon: LayoutDashboard,
    };
  }

  if (role) {
    return {
      href: "/releases",
      label: "Releases ansehen",
      icon: Package,
    };
  }

  return {
    href: "/register",
    label: "Jetzt starten",
    icon: ArrowRight,
  };
}

function getSecondaryAction(role?: string | null) {
  if (role === "ADMIN") {
    return {
      href: "/dashboard/releases",
      label: "Releases verwalten",
    };
  }

  if (role) {
    return {
      href: "/profile",
      label: "Zum Profil",
    };
  }

  return {
    href: "/login",
    label: "Login",
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;

  const primaryAction = getPrimaryAction(role);
  const secondaryAction = getSecondaryAction(role);
  const PrimaryIcon = primaryAction.icon;

  const latestVideos: HomeMediaRow[] = await prisma.homeMedia.findMany({
    where: {
      active: true,
      type: "VIDEO",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  const latestPhotos: HomeMediaRow[] = await prisma.homeMedia.findMany({
    where: {
      active: true,
      type: "IMAGE",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-cyan-400/5 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl" />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Sparkles className="h-4 w-4" />
              ArcadiaX Platform
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Deine moderne Plattform für Releases, Community und Verwaltung.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                ArcadiaX verbindet öffentliche Release-Seiten mit einem
                professionellen Admin-Bereich. Veröffentliche Versionen,
                verwalte Medien, sammle Kommentare und baue Schritt für Schritt
                deine eigene Gaming-Plattform auf.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3.5 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <PrimaryIcon className="h-4 w-4 text-blue-300" />
                <span>{primaryAction.label}</span>
              </Link>

              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                <span>{secondaryAction.label}</span>
              </Link>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-2xl font-semibold text-white">Releases</div>
                <div className="mt-1 text-sm text-white/45">
                  Versionen zentral veröffentlichen
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-2xl font-semibold text-white">Media</div>
                <div className="mt-1 text-sm text-white/45">
                  Screenshots und Assets organisieren
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  Community
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Kommentare und Benutzer verwalten
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-white/10 bg-[#07090f] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white/55">
                    Plattform Überblick
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    ArcadiaX Core
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <Gamepad2 className="h-5 w-5 text-blue-300" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Release Pages</span>
                  </div>
                  <span className="text-xs text-white/40">aktiv</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Media Verwaltung</span>
                  </div>
                  <span className="text-xs text-white/40">bereit</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Kommentare</span>
                  </div>
                  <span className="text-xs text-white/40">integrierbar</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Admin Control</span>
                  </div>
                  <span className="text-xs text-white/40">geschützt</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
              <div className="text-sm font-medium text-white/55">
                Für dein Projekt
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Ideal für Emulatoren, Fan-Projekte, Tools und eigene Releases
              </div>
              <p className="mt-3 text-sm leading-6 text-white/60">
                ArcadiaX ist die perfekte Basis, um eigene Build-Versionen,
                Launcher, Retro-Projekte oder Community-Releases übersichtlich
                und professionell zu präsentieren.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <Package className="h-5 w-5 text-blue-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Release Pages</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Präsentiere jede Version mit Titel, Beschreibung, Datei, Medien und
            später auch Download-Statistiken.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <ImageIcon className="h-5 w-5 text-blue-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Media Verwaltung</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Verwalte Screenshots, Logos, Banner und später Trailer zentral für
            Home, Releases und Community-Seiten.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <MessageSquare className="h-5 w-5 text-blue-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Kommentare</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Baue eine Community auf, sammle Feedback und moderiere Inhalte
            direkt aus deinem Dashboard.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <Users className="h-5 w-5 text-blue-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Benutzer & Rollen</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Trenne sauber zwischen Gästen, normalen Nutzern und Admins mit
            klarer Navigation und Rollenlogik.
          </p>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/40">
              Media Highlights
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Neueste Videos
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Die letzten 3 veröffentlichten Videos aus deiner Media-Bibliothek.
            </p>
          </div>

          <Link
            href="/videos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
          >
            <Film className="h-4 w-4 text-blue-300" />
            <span>Alle Videos</span>
          </Link>
        </div>

        {latestVideos.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-6 text-white/50">
            Noch keine veröffentlichten Videos vorhanden.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestVideos.map((item: HomeMediaRow) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07090f] transition hover:border-blue-400/20"
              >
                <video
                  src={item.url}
                  controls
                  className="aspect-video w-full bg-black object-cover"
                />

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {item.title || "Ohne Titel"}
                    </h3>

                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-white/35">
                        Keine Beschreibung vorhanden.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-white/40">
                      Aktualisiert:{" "}
                      {new Intl.DateTimeFormat("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(item.updatedAt)}
                    </div>

                    <Link
                      href="/videos"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
                    >
                      Mehr
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/40">
              Gallery
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Neueste Fotos
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Die letzten 3 veröffentlichten Bilder aus deiner Media-Bibliothek.
            </p>
          </div>

          <Link
            href="/photos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
          >
            <ImageIcon className="h-4 w-4 text-blue-300" />
            <span>Alle Fotos</span>
          </Link>
        </div>

        {latestPhotos.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-6 text-white/50">
            Noch keine veröffentlichten Fotos vorhanden.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestPhotos.map((item: HomeMediaRow) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07090f] transition hover:border-blue-400/20"
              >
                <Link href={item.url} target="_blank" className="block bg-black">
                  <img
                    src={item.url}
                    alt={item.title || "Foto"}
                    className="aspect-video w-full object-cover transition duration-300 hover:scale-[1.02]"
                  />
                </Link>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {item.title || "Ohne Titel"}
                    </h3>

                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-white/35">
                        Keine Beschreibung vorhanden.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-white/40">
                      Aktualisiert:{" "}
                      {new Intl.DateTimeFormat("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(item.updatedAt)}
                    </div>

                    <Link
                      href="/photos"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
                    >
                      Mehr
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
              <Download className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/50">
                Nächste Ausbaustufe
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Von Release-Plattform zu echter Gaming-Plattform
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-sm font-semibold text-white">
                Download Tracking
              </div>
              <div className="mt-1 text-sm text-white/55">
                Zähle Downloads pro Release und zeige Statistiken im Dashboard.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-sm font-semibold text-white">Screenshots</div>
              <div className="mt-1 text-sm text-white/55">
                Zeige Bilder und Media-Galerien direkt auf der Release-Seite.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-sm font-semibold text-white">Kommentare</div>
              <div className="mt-1 text-sm text-white/55">
                Nutzer können Releases kommentieren und diskutieren.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
              <div className="text-sm font-semibold text-white">Moderation</div>
              <div className="mt-1 text-sm text-white/55">
                Admins prüfen Inhalte, Nutzer und Community-Aktivität.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-blue-500/10 via-white/[0.03] to-transparent p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.22em] text-blue-200/80">
            Rollenbasierte Plattform
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#07090f]/90 px-4 py-4">
              <div className="text-sm font-semibold text-white">Gast</div>
              <div className="mt-1 text-sm text-white/55">
                Sieht Startseite, Releases, Login und Register.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07090f]/90 px-4 py-4">
              <div className="text-sm font-semibold text-white">Benutzer</div>
              <div className="mt-1 text-sm text-white/55">
                Sieht Releases, Profil, Username und Logout.
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-4">
              <div className="text-sm font-semibold text-white">Administrator</div>
              <div className="mt-1 text-sm text-white/65">
                Sieht zusätzlich Dashboard, Media, Kommentare und Benutzer.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <Package className="h-4 w-4 text-blue-300" />
              <span>Releases öffnen</span>
            </Link>

            <Link
              href="/videos"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <Film className="h-4 w-4 text-blue-300" />
              <span>Videos</span>
            </Link>

            <Link
              href="/photos"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ImageIcon className="h-4 w-4 text-blue-300" />
              <span>Fotos</span>
            </Link>

            {role === "ADMIN" ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <LayoutDashboard className="h-4 w-4 text-blue-300" />
                <span>Admin Bereich</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}