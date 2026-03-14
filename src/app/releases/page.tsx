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

type ReleaseListItem = {
  id: string;
  title: string;
  slug: string | null;
  version: string;
  description: string | null;
  imageUrl: string | null;
  fileUrl: string;
  downloadCount: number;
  createdAt: Date;
  _count: {
    comments: number;
  };
};

const BRAND = "#6c5ce7";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getSafeDescription(text?: string | null) {
  if (!text?.trim()) {
    return "No description available.";
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
      label: "Manage Releases",
      icon: Package,
    };
  }

  if (role) {
    return {
      href: "/profile",
      label: "My Profile",
      icon: Shield,
    };
  }

  return {
    href: "/register",
    label: "Create Account",
    icon: Sparkles,
  };
}

export default async function ReleasesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;

  const releases: ReleaseListItem[] = await prisma.release.findMany({
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
    (sum: number, release: ReleaseListItem) =>
      sum + (release.downloadCount ?? 0),
    0
  );

  const totalComments = releases.reduce(
    (sum: number, release: ReleaseListItem) =>
      sum + (release._count.comments ?? 0),
    0
  );

  const primaryAction = getPrimaryAction(role);
  const PrimaryActionIcon = primaryAction.icon;

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-6 py-8 shadow-xl shadow-black/15 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -left-16 top-0 h-56 w-56 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(108, 92, 231, 0.12)" }}
          />
          <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div
            className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(108, 92, 231, 0.06)" }}
          />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]"
              style={{
                borderColor: "rgba(108, 92, 231, 0.22)",
                backgroundColor: "rgba(108, 92, 231, 0.10)",
                color: BRAND,
              }}
            >
              <Sparkles className="h-4 w-4" />
              Public Releases
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Explore all published ArcadiaX releases.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                Here you can find every currently published version with
                description, release date, downloads, and community feedback.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                <PrimaryActionIcon className="h-4 w-4" />
                <span>{primaryAction.label}</span>
              </Link>

              {role === "ADMIN" ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <Shield className="h-4 w-4" style={{ color: BRAND }} />
                  <span>Go to Dashboard</span>
                </Link>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>Back to Home</span>
                </Link>
              )}
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  {releases.length}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Published releases
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  {totalDownloads}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Total downloads
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  {totalComments}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Total comments
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Release Overview
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    Platform Status
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Package className="h-5 w-5" style={{ color: BRAND }} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">
                      Published Releases
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">{releases.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Download className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Downloads</span>
                  </div>
                  <span className="text-xs text-zinc-500">{totalDownloads}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Comments</span>
                  </div>
                  <span className="text-xs text-zinc-500">{totalComments}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Media Ready</span>
                  </div>
                  <span className="text-xs text-zinc-500">active</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-medium text-zinc-500">
                ArcadiaX Releases
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                A clean release hub for launchers, tools, emulators, and custom
                builds
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Every published version gets its own page. That makes ArcadiaX
                feel like more than a download area — it becomes a real
                platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {releases.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
                Empty for now
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                No published releases available yet
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                As soon as a release is set to PUBLISHED, it will automatically
                appear here in the public release list.
              </p>
            </div>

            {role === "ADMIN" ? (
              <Link
                href="/dashboard/releases"
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                <Package className="h-4 w-4" />
                <span>Manage Releases</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
                Release Library
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                All Published Versions
              </h2>
            </div>

            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 md:block">
              {releases.length} items
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {releases.map((release: ReleaseListItem) => {
              const href = buildReleaseHref(release.slug, release.id);

              return (
                <article
                  key={release.id}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 transition hover:border-zinc-700 hover:bg-zinc-900/70"
                >
                  <div className="relative">
                    <div className="h-52 w-full border-b border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
                      {release.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={release.imageUrl}
                          alt={release.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="flex flex-col items-center gap-3 text-zinc-500">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <ImageIcon className="h-8 w-8" style={{ color: `${BRAND}cc` }} />
                            </div>
                            <span className="text-sm">No preview image</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className="absolute left-4 top-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]"
                      style={{
                        borderColor: "rgba(108, 92, 231, 0.22)",
                        backgroundColor: "rgba(108, 92, 231, 0.10)",
                        color: BRAND,
                      }}
                    >
                      Release
                    </div>
                  </div>

                  <div className="space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-2xl font-semibold tracking-tight text-white">
                          {release.title}
                        </h3>
                        <div className="mt-1 text-sm text-zinc-500">
                          Version {release.version}
                        </div>
                      </div>

                      <div
                        className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "rgba(108, 92, 231, 0.22)",
                          backgroundColor: "rgba(108, 92, 231, 0.10)",
                          color: BRAND,
                        }}
                      >
                        Published
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-zinc-400">
                      {getSafeDescription(release.description)}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Download className="h-4 w-4" style={{ color: BRAND }} />
                          <span className="text-xs uppercase tracking-[0.14em]">
                            Downloads
                          </span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {release.downloadCount ?? 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <MessageSquare className="h-4 w-4" style={{ color: BRAND }} />
                          <span className="text-xs uppercase tracking-[0.14em]">
                            Comments
                          </span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {release._count.comments}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <CalendarDays className="h-4 w-4" style={{ color: BRAND }} />
                          <span className="text-xs uppercase tracking-[0.14em]">
                            Date
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {formatDate(release.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <div className="text-xs text-zinc-500">
                        Published on {formatDateTime(release.createdAt)}
                      </div>

                      <div className="flex items-center gap-3">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                          style={{ backgroundColor: BRAND }}
                        >
                          <span>View Details</span>
                          <ArrowRight className="h-4 w-4" />
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