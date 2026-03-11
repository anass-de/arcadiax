import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  ExternalLink,
  ImageIcon,
  MessageSquare,
  Package,
  Shield,
  Sparkles,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import ReleaseComments from "@/components/releases/release-comments";

type ReleasePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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
    return "Für dieses Release wurde noch keine Beschreibung hinterlegt.";
  }

  return text;
}

async function getRelease(slug: string) {
  const bySlug = await prisma.release.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
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
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  if (bySlug) {
    return bySlug;
  }

  const byId = await prisma.release.findFirst({
    where: {
      id: slug,
      status: "PUBLISHED",
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
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  return byId;
}

function getDownloadHref(release: {
  id: string;
  fileUrl?: string | null;
}) {
  if (!release.fileUrl?.trim()) {
    return null;
  }

  return `/api/releases/${release.id}/download`;
}

export async function generateMetadata({ params }: ReleasePageProps) {
  const { slug } = await params;
  const release = await getRelease(slug);

  if (!release) {
    return {
      title: "Release nicht gefunden | ArcadiaX",
    };
  }

  return {
    title: `${release.title} ${release.version} | ArcadiaX`,
    description:
      release.description?.slice(0, 160) ||
      `Release-Seite für ${release.title} ${release.version} auf ArcadiaX.`,
  };
}

export default async function ReleaseDetailPage({
  params,
}: ReleasePageProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  const isAdmin = role === "ADMIN";
  const isLoggedIn = !!session?.user;

  const release = await getRelease(slug);

  if (!release) {
    notFound();
  }

  const downloadHref = getDownloadHref(release);
  const hasDownload = !!downloadHref;
  const hasImage = !!release.imageUrl?.trim();
  const commentsCount = release._count.comments ?? 0;

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-cyan-400/5 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-white/[0.03] blur-3xl" />
        </div>

        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/releases"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Zurück zu Releases</span>
          </Link>

          {isAdmin ? (
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
            >
              <Shield className="h-4 w-4 text-blue-300" />
              <span>Releases verwalten</span>
            </Link>
          ) : null}
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Sparkles className="h-4 w-4" />
              Release Details
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-300">
                  {release.status}
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-white/50">
                  Version {release.version}
                </div>
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {release.title}
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                {getSafeDescription(release.description)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasDownload && downloadHref ? (
                <a
                  href={downloadHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3.5 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
                >
                  <Download className="h-4 w-4 text-blue-300" />
                  <span>Release herunterladen</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-white/45">
                  <Download className="h-4 w-4" />
                  <span>Kein Download verfügbar</span>
                </span>
              )}

              {release.fileUrl?.trim() ? (
                <a
                  href={release.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Datei direkt öffnen</span>
                </a>
              ) : null}
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="flex items-center gap-2 text-white/45">
                  <Download className="h-4 w-4 text-blue-300" />
                  <span className="text-xs uppercase tracking-[0.14em]">
                    Downloads
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {release.downloadCount ?? 0}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="flex items-center gap-2 text-white/45">
                  <MessageSquare className="h-4 w-4 text-blue-300" />
                  <span className="text-xs uppercase tracking-[0.14em]">
                    Kommentare
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {commentsCount}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="flex items-center gap-2 text-white/45">
                  <CalendarDays className="h-4 w-4 text-blue-300" />
                  <span className="text-xs uppercase tracking-[0.14em]">
                    Veröffentlicht
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDate(release.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07090f]">
              <div className="flex h-[320px] w-full items-center justify-center border-b border-white/10 bg-gradient-to-br from-[#0a0d14] via-[#090b11] to-[#06080d]">
                {hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.imageUrl!}
                    alt={release.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/35">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <ImageIcon className="h-8 w-8 text-blue-300/80" />
                    </div>
                    <span className="text-sm">Kein Vorschaubild vorhanden</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-5">
                <div className="text-sm font-medium text-white/55">
                  Release Übersicht
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Titel</span>
                  </div>
                  <span className="max-w-[180px] truncate text-xs text-white/45">
                    {release.title}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Version</span>
                  </div>
                  <span className="text-xs text-white/45">{release.version}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Erstellt</span>
                  </div>
                  <span className="text-xs text-white/45">
                    {formatDateTime(release.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-blue-300" />
                    <span className="text-sm text-white/80">Aktualisiert</span>
                  </div>
                  <span className="text-xs text-white/45">
                    {formatDateTime(release.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
              <div className="text-sm font-medium text-white/55">
                Community Status
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {isLoggedIn
                  ? "Du bist angemeldet und kannst direkt kommentieren und antworten."
                  : "Öffentliche Release-Seite mit Platz für Community-Features."}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Diese Seite ist die ideale Basis für Downloads, Screenshots,
                Kommentare, Bewertungen und zukünftige Plattform-Funktionen.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
              <Package className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/50">
                Beschreibung
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Über dieses Release
              </h2>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#07090f] p-5">
            <p className="whitespace-pre-line text-sm leading-7 text-white/70">
              {getSafeDescription(release.description)}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {hasDownload && downloadHref ? (
              <a
                href={downloadHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <Download className="h-4 w-4 text-blue-300" />
                <span>Jetzt herunterladen</span>
              </a>
            ) : null}

            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Weitere Releases</span>
            </Link>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
              <MessageSquare className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/50">
                Community
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Diskussion & Feedback
              </h2>
            </div>
          </div>

          <p className="text-sm leading-6 text-white/60">
            Nutzer können hier direkt Kommentare schreiben, Antworten posten und
            Feedback zu diesem Release hinterlassen.
          </p>
        </div>
      </section>

      <ReleaseComments
        releaseId={release.id}
        currentUser={
          session?.user
            ? {
              id: session.user.id ?? null,
              name: session.user.name ?? null,
              username: session.user.username ?? null,
              image: session.user.image ?? null,
              role: session.user.role ?? null,
            }
            : null
        }
      />
    </div>
  );
}