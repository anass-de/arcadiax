import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Download,
  ExternalLink,
  Film,
  Gamepad2,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Package,
  Shield,
  Sparkles,
  Users,
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

type ReleaseRow = {
  id: string;
  slug: string | null;
  title: string;
  version: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  downloadCount: number;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getPrimaryAction(role?: string | null) {
  if (role === "ADMIN") {
    return {
      href: "/dashboard",
      label: "Dashboard öffnen",
      icon: LayoutDashboard,
    };
  }

  if (role) {
    return {
      href: "/releases",
      label: "Releases entdecken",
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
    label: "Einloggen",
  };
}

function buildReleaseHref(slug?: string | null, id?: string) {
  if (slug?.trim()) {
    return `/releases/${slug}`;
  }

  return id ? `/releases/${id}` : "/releases";
}

function getSafeDescription(text?: string | null) {
  if (!text?.trim()) {
    return "Keine Beschreibung vorhanden.";
  }

  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;

  const primaryAction = getPrimaryAction(role);
  const secondaryAction = getSecondaryAction(role);
  const PrimaryIcon = primaryAction.icon;

  const [latestReleases, latestVideos, latestPhotos] = await Promise.all([
    prisma.release.findMany({
      where: {
        status: "PUBLISHED",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        version: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        downloadCount: true,
      },
    }) as Promise<ReleaseRow[]>,
    prisma.homeMedia.findMany({
      where: {
        active: true,
        type: "VIDEO",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
    }) as Promise<HomeMediaRow[]>,
    prisma.homeMedia.findMany({
      where: {
        active: true,
        type: "IMAGE",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
    }) as Promise<HomeMediaRow[]>,
  ]);

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-6 py-8 shadow-xl shadow-black/15 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              ArcadiaX Plattform
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Deine moderne Plattform für Releases, Community und Verwaltung.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                ArcadiaX verbindet öffentliche Release-Seiten mit einem
                professionellen Admin-Bereich. Veröffentliche Versionen,
                verwalte Medien, sammle Kommentare und baue Schritt für Schritt
                deine eigene Gaming-Plattform auf.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                <PrimaryIcon className="h-4 w-4" />
                <span>{primaryAction.label}</span>
              </Link>

              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                <span>{secondaryAction.label}</span>
              </Link>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">Releases</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Versionen zentral veröffentlichen
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">Media</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Screenshots, Videos und Assets verwalten
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  Community
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Kommentare und Benutzer organisieren
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Plattform Übersicht
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    ArcadiaX Core
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Gamepad2 className="h-5 w-5 text-cyan-300" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm text-zinc-200">Release Seiten</span>
                  </div>
                  <span className="text-xs text-zinc-500">aktiv</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm text-zinc-200">Media Verwaltung</span>
                  </div>
                  <span className="text-xs text-zinc-500">bereit</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm text-zinc-200">Kommentare</span>
                  </div>
                  <span className="text-xs text-zinc-500">integriert</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-cyan-300" />
                    <span className="text-sm text-zinc-200">Admin Kontrolle</span>
                  </div>
                  <span className="text-xs text-zinc-500">geschützt</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-medium text-zinc-500">
                Für dein Projekt
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Perfekt für Emulatoren, Fan-Projekte, Tools und eigene Releases
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                ArcadiaX ist eine starke Grundlage, um eigene Builds, Launcher,
                Retro-Projekte oder Community-Releases sauber und professionell
                zu präsentieren.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <Package className="h-5 w-5 text-cyan-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Release Seiten</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Präsentiere jede Version mit Titel, Beschreibung, Datei, Medien und
            später auch Download-Statistiken.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <ImageIcon className="h-5 w-5 text-cyan-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Media Verwaltung</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Verwalte Screenshots, Logos, Banner und später auch Trailer für
            Startseite, Releases und Community-Bereiche.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <MessageSquare className="h-5 w-5 text-cyan-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Kommentare</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Baue eine Community auf, sammle Feedback und moderiere Inhalte
            direkt aus deinem Dashboard.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <Users className="h-5 w-5 text-cyan-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Benutzer & Rollen</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Trenne Gäste, normale Benutzer und Admins sauber mit klarer
            Navigation und rollenbasierter Logik.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
              Neueste Releases
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Letzte veröffentlichte Versionen
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Die letzten 3 veröffentlichten Releases aus ArcadiaX.
            </p>
          </div>

          <Link
            href="/releases"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <Package className="h-4 w-4 text-cyan-300" />
            <span>Alle Releases</span>
          </Link>
        </div>

        {latestReleases.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-zinc-500">
            Noch keine veröffentlichten Releases vorhanden.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestReleases.map((release: ReleaseRow) => {
              const releaseHref = buildReleaseHref(release.slug, release.id);

              return (
                <article
                  key={release.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition hover:border-zinc-700"
                >
                  <Link href={releaseHref} className="block bg-black">
                    {release.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={release.imageUrl}
                        alt={release.title}
                        className="aspect-video w-full object-cover transition duration-300 hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-zinc-500">
                        <Package className="h-10 w-10 text-cyan-300/70" />
                      </div>
                    )}
                  </Link>

                  <div className="space-y-4 p-5">
                    <div>
                      <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                        Version {release.version}
                      </div>

                      <h3 className="text-xl font-semibold text-white">
                        {release.title}
                      </h3>

                      {release.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">
                          {release.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          Keine Beschreibung vorhanden.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-500">
                        Aktualisiert: {formatDate(release.updatedAt)}
                      </div>

                      <Link
                        href={releaseHref}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                      >
                        Öffnen
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
              Media Highlights
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Neueste Videos
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Die letzten 3 veröffentlichten Videos aus deiner Media Library.
            </p>
          </div>

          <Link
            href="/videos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <Film className="h-4 w-4 text-cyan-300" />
            <span>Alle Videos</span>
          </Link>
        </div>

        {latestVideos.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-zinc-500">
            Noch keine veröffentlichten Videos vorhanden.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestVideos.map((item: HomeMediaRow) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition hover:border-zinc-700"
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
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Keine Beschreibung vorhanden.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Aktualisiert: {formatDate(item.updatedAt)}
                    </div>

                    <Link
                      href="/videos"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
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

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
              Galerie
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Neueste Bilder
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Die letzten 3 veröffentlichten Bilder aus deiner Media Library.
            </p>
          </div>

          <Link
            href="/photos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <ImageIcon className="h-4 w-4 text-cyan-300" />
            <span>Alle Bilder</span>
          </Link>
        </div>

        {latestPhotos.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-zinc-500">
            Noch keine veröffentlichten Bilder vorhanden.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestPhotos.map((item: HomeMediaRow) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition hover:border-zinc-700"
              >
                <Link href={item.url} target="_blank" className="block bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title || "Bild"}
                    className="aspect-video w-full object-cover transition duration-300 hover:scale-[1.02]"
                  />
                </Link>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {item.title || "Ohne Titel"}
                    </h3>

                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Keine Beschreibung vorhanden.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Aktualisiert: {formatDate(item.updatedAt)}
                    </div>

                    <Link
                      href="/photos"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
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
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <Download className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-500">
                Nächste Ausbauphase
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Von der Release-Plattform zur vollständigen Gaming-Plattform
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">
                Download Tracking
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                Downloads pro Release zählen und Statistiken im Dashboard
                anzeigen.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Screenshots</div>
              <div className="mt-1 text-sm text-zinc-400">
                Bilder und Mediengalerien direkt auf der Release-Seite anzeigen.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Kommentare</div>
              <div className="mt-1 text-sm text-zinc-400">
                Benutzer können Releases kommentieren und Diskussionen starten.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Moderation</div>
              <div className="mt-1 text-sm text-zinc-400">
                Admins prüfen Inhalte, Benutzer und Community-Aktivitäten.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-white/[0.03] to-transparent p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300/80">
            Rollenbasierte Plattform
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
              <div className="text-sm font-semibold text-white">Gast</div>
              <div className="mt-1 text-sm text-zinc-400">
                Kann Startseite, Releases, Login und Registrierung sehen.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
              <div className="text-sm font-semibold text-white">Benutzer</div>
              <div className="mt-1 text-sm text-zinc-400">
                Kann Releases, Profil, Username und Logout nutzen.
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4">
              <div className="text-sm font-semibold text-white">
                Administrator
              </div>
              <div className="mt-1 text-sm text-zinc-200/80">
                Kann zusätzlich Dashboard, Media, Kommentare und Benutzer
                verwalten.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <Package className="h-4 w-4 text-cyan-300" />
              <span>Releases öffnen</span>
            </Link>

            <Link
              href="/videos"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <Film className="h-4 w-4 text-cyan-300" />
              <span>Videos</span>
            </Link>

            <Link
              href="/photos"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <ImageIcon className="h-4 w-4 text-cyan-300" />
              <span>Bilder</span>
            </Link>

            {role === "ADMIN" ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin Bereich</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}