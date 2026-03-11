import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  CalendarDays,
  Download,
  ImageIcon,
  MessageSquare,
  Package,
  Shield,
  Sparkles,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSafeDescription(text?: string | null) {
  if (!text?.trim()) {
    return "Keine Beschreibung vorhanden.";
  }

  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function buildReleaseHref(slug?: string | null, id?: string) {
  if (slug?.trim()) {
    return `/releases/${slug}`;
  }

  return id ? `/releases/${id}` : "/releases";
}

function getPrimaryAction(role?: string | null) {
  if (role === "ADMIN") {
    return {
      href: "/dashboard/releases",
      label: "Releases verwalten",
    };
  }

  if (role) {
    return {
      href: "/profile",
      label: "Mein Profil",
    };
  }

  return {
    href: "/register",
    label: "Konto erstellen",
  };
}

export default async function ReleasesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;

  const releases = await prisma.release.findMany({
    where: {
      status: "PUBLISHED",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      version: true,
      description: true,
      imageUrl: true,
      fileUrl: true,
      downloadCount: true,
      createdAt: true,
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  const totalDownloads = releases.reduce(
    (sum, release) => sum + (release.downloadCount ?? 0),
    0
  );

  const totalComments = releases.reduce(
    (sum, release) => sum + (release._count.comments ?? 0),
    0
  );

  const primaryAction = getPrimaryAction(role);

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-cyan-400/5 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-white/[0.03] blur-3xl" />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Sparkles className="h-4 w-4" />
              Öffentliche Releases
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Entdecke alle veröffentlichten ArcadiaX Releases.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                Hier findest du alle aktuell veröffentlichten Versionen mit
                Beschreibung, Veröffentlichungsdatum, Downloads und
                Community-Feedback.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3.5 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <Package className="h-4 w-4 text-blue-300" />
                <span>{primaryAction.label}</span>
              </Link>

              {role === "ADMIN" ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                >
                  <Shield className="h-4 w-4 text-blue-300" />
                  <span>Zum Dashboard</span>
                </Link>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>Zur Startseite</span>
                </Link>
              )}
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  {releases.length}
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Veröffentlichte Releases
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  {totalDownloads}
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Gesamte Downloads
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  {totalComments}
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Kommentare gesamt
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-white/10 bg-[#07090f] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white/55">
                    Release Übersicht
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    Plattform Status
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <Package className="h-5 w-5 text-blue-300" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">
                      PUBLISHED Releases
                    </span>
                  </div>
                  <span className="text-xs text-white/40">{releases.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Download className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Downloads</span>
                  </div>
                  <span className="text-xs text-white/40">{totalDownloads}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Kommentare</span>
                  </div>
                  <span className="text-xs text-white/40">{totalComments}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Media bereit</span>
                  </div>
                  <span className="text-xs text-white/40">aktiv</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
              <div className="text-sm font-medium text-white/55">
                ArcadiaX Releases
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Eine saubere Übersicht für Launcher, Tools, Emulatoren und eigene
                Builds
              </div>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Jede veröffentlichte Version bekommt ihre eigene Seite. So wirkt
                ArcadiaX nicht nur wie ein Download-Bereich, sondern wie eine
                echte Plattform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {releases.length === 0 ? (
        <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-white/40">
                Noch leer
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Noch keine veröffentlichten Releases vorhanden
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                Sobald ein Release auf PUBLISHED gesetzt ist, erscheint es hier
                automatisch in der öffentlichen Übersicht.
              </p>
            </div>

            {role === "ADMIN" ? (
              <Link
                href="/dashboard/releases"
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <Package className="h-4 w-4 text-blue-300" />
                <span>Releases verwalten</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-white/40">
                Release Bibliothek
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Alle veröffentlichten Versionen
              </h2>
            </div>

            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/55 md:block">
              {releases.length} Einträge
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {releases.map((release) => {
              const href = buildReleaseHref(release.slug, release.id);

              return (
                <article
                  key={release.id}
                  className="group overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] transition hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="relative">
                    <div className="h-52 w-full border-b border-white/10 bg-gradient-to-br from-[#0a0d14] via-[#090b11] to-[#06080d]">
                      {release.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={release.imageUrl}
                          alt={release.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="flex flex-col items-center gap-3 text-white/35">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <ImageIcon className="h-8 w-8 text-blue-300/80" />
                            </div>
                            <span className="text-sm">Kein Vorschaubild</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="absolute left-4 top-4 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-blue-200">
                      Release
                    </div>
                  </div>

                  <div className="space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-2xl font-semibold tracking-tight text-white">
                          {release.title}
                        </h3>
                        <div className="mt-1 text-sm text-white/50">
                          Version {release.version}
                        </div>
                      </div>

                      <div className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-emerald-300">
                        Published
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-white/60">
                      {getSafeDescription(release.description)}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3">
                        <div className="flex items-center gap-2 text-white/45">
                          <Download className="h-4 w-4 text-blue-300" />
                          <span className="text-xs uppercase tracking-[0.14em]">
                            Downloads
                          </span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {release.downloadCount ?? 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3">
                        <div className="flex items-center gap-2 text-white/45">
                          <MessageSquare className="h-4 w-4 text-blue-300" />
                          <span className="text-xs uppercase tracking-[0.14em]">
                            Kommentare
                          </span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {release._count.comments}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3">
                        <div className="flex items-center gap-2 text-white/45">
                          <CalendarDays className="h-4 w-4 text-blue-300" />
                          <span className="text-xs uppercase tracking-[0.14em]">
                            Datum
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {formatDate(release.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <div className="text-xs text-white/40">
                        Veröffentlicht am {formatDateTime(release.createdAt)}
                      </div>

                      <div className="flex items-center gap-3">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
                        >
                          <span>Details ansehen</span>
                          <ArrowRight className="h-4 w-4 text-blue-300" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}