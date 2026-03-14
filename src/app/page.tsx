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

const BRAND = "#6c5ce7";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getPrimaryAction(role?: string | null) {
  if (role === "ADMIN") {
    return {
      href: "/dashboard",
      label: "Open Dashboard",
      icon: LayoutDashboard,
    };
  }

  if (role) {
    return {
      href: "/releases",
      label: "Explore Releases",
      icon: Package,
    };
  }

  return {
    href: "/register",
    label: "Get Started",
    icon: ArrowRight,
  };
}

function getSecondaryAction(role?: string | null) {
  if (role === "ADMIN") {
    return {
      href: "/dashboard/releases",
      label: "Manage Releases",
    };
  }

  if (role) {
    return {
      href: "/profile",
      label: "Go to Profile",
    };
  }

  return {
    href: "/login",
    label: "Login",
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
    return "No description available.";
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
          <div
            className="absolute -left-20 top-0 h-56 w-56 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(108, 92, 231, 0.12)" }}
          />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div
            className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(108, 92, 231, 0.06)" }}
          />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
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
              ArcadiaX Platform
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Your modern platform for releases, community, and management.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                ArcadiaX combines public release pages with a professional admin
                area. Publish versions, manage media, collect comments, and
                build your own gaming platform step by step.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
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
                  Publish versions in one central place
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">Media</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Manage screenshots, videos, and assets
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-2xl font-semibold text-white">
                  Community
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Organize comments and users
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Platform Overview
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    ArcadiaX Core
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Gamepad2 className="h-5 w-5" style={{ color: BRAND }} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Release Pages</span>
                  </div>
                  <span className="text-xs text-zinc-500">active</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Media Library</span>
                  </div>
                  <span className="text-xs text-zinc-500">ready</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Comments</span>
                  </div>
                  <span className="text-xs text-zinc-500">integrated</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Admin Control</span>
                  </div>
                  <span className="text-xs text-zinc-500">protected</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-medium text-zinc-500">
                For Your Project
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                Perfect for emulators, fan projects, tools, and custom releases
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                ArcadiaX is a strong foundation for presenting your own builds,
                launchers, retro projects, or community releases in a clean and
                professional way.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <Package className="h-5 w-5" style={{ color: BRAND }} />
          </div>
          <h2 className="text-xl font-semibold text-white">Release Pages</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Present every version with title, description, file, media, and
            later also download statistics.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <ImageIcon className="h-5 w-5" style={{ color: BRAND }} />
          </div>
          <h2 className="text-xl font-semibold text-white">Media Management</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Manage screenshots, logos, banners, and later even trailers for the
            homepage, releases, and community sections.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <MessageSquare className="h-5 w-5" style={{ color: BRAND }} />
          </div>
          <h2 className="text-xl font-semibold text-white">Comments</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Build a community, collect feedback, and moderate content directly
            from your dashboard.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-3">
            <Users className="h-5 w-5" style={{ color: BRAND }} />
          </div>
          <h2 className="text-xl font-semibold text-white">Users & Roles</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Separate guests, regular users, and admins with clear navigation and
            role-based logic.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-zinc-500">
              Latest Releases
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Recently Published Versions
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              The latest 3 published releases from ArcadiaX.
            </p>
          </div>

          <Link
            href="/releases"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <Package className="h-4 w-4" style={{ color: BRAND }} />
            <span>All Releases</span>
          </Link>
        </div>

        {latestReleases.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-zinc-500">
            No published releases available yet.
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
                        <Package className="h-10 w-10" style={{ color: `${BRAND}b3` }} />
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
                          No description available.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-500">
                        Updated: {formatDate(release.updatedAt)}
                      </div>

                      <Link
                        href={releaseHref}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                      >
                        Open
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
              Latest Videos
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              The latest 3 published videos from your media library.
            </p>
          </div>

          <Link
            href="/videos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <Film className="h-4 w-4" style={{ color: BRAND }} />
            <span>All Videos</span>
          </Link>
        </div>

        {latestVideos.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-zinc-500">
            No published videos available yet.
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
                      {item.title || "Untitled"}
                    </h3>

                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        No description available.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Updated: {formatDate(item.updatedAt)}
                    </div>

                    <Link
                      href="/videos"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                      More
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
              Gallery
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Latest Photos
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              The latest 3 published images from your media library.
            </p>
          </div>

          <Link
            href="/photos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <ImageIcon className="h-4 w-4" style={{ color: BRAND }} />
            <span>All Photos</span>
          </Link>
        </div>

        {latestPhotos.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-zinc-500">
            No published photos available yet.
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
                    alt={item.title || "Photo"}
                    className="aspect-video w-full object-cover transition duration-300 hover:scale-[1.02]"
                  />
                </Link>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {item.title || "Untitled"}
                    </h3>

                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        No description available.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Updated: {formatDate(item.updatedAt)}
                    </div>

                    <Link
                      href="/photos"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                      More
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
              <Download className="h-5 w-5" style={{ color: BRAND }} />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-500">
                Next Expansion Stage
              </div>
              <h2 className="text-2xl font-semibold text-white">
                From release platform to a complete gaming platform
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">
                Download Tracking
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                Count downloads per release and display statistics in the
                dashboard.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Screenshots</div>
              <div className="mt-1 text-sm text-zinc-400">
                Show images and media galleries directly on the release page.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Comments</div>
              <div className="mt-1 text-sm text-zinc-400">
                Users can comment on releases and start discussions.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Moderation</div>
              <div className="mt-1 text-sm text-zinc-400">
                Admins review content, users, and community activity.
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-3xl border border-white/10 p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(to bottom right, rgba(108,92,231,0.12), rgba(255,255,255,0.03), transparent)",
          }}
        >
          <div
            className="text-sm font-medium uppercase tracking-[0.22em]"
            style={{ color: "rgba(108, 92, 231, 0.85)" }}
          >
            Role-Based Platform
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
              <div className="text-sm font-semibold text-white">Guest</div>
              <div className="mt-1 text-sm text-zinc-400">
                Can view the homepage, releases, login, and register pages.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
              <div className="text-sm font-semibold text-white">User</div>
              <div className="mt-1 text-sm text-zinc-400">
                Can access releases, profile, username, and logout.
              </div>
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{
                borderColor: "rgba(108, 92, 231, 0.22)",
                backgroundColor: "rgba(108, 92, 231, 0.10)",
              }}
            >
              <div className="text-sm font-semibold text-white">
                Administrator
              </div>
              <div className="mt-1 text-sm text-white/80">
                Can also manage the dashboard, media, comments, and users.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <Package className="h-4 w-4" style={{ color: BRAND }} />
              <span>Open Releases</span>
            </Link>

            <Link
              href="/videos"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <Film className="h-4 w-4" style={{ color: BRAND }} />
              <span>Videos</span>
            </Link>

            <Link
              href="/photos"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <ImageIcon className="h-4 w-4" style={{ color: BRAND }} />
              <span>Photos</span>
            </Link>

            {role === "ADMIN" ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin Area</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}