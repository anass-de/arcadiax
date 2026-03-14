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

function buildReleaseHref(slug?: string | null) {
  if (slug?.trim()) {
    return `/releases/${slug}`;
  }

  return "/releases";
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
    (sum, release) => sum + (release.downloadCount ?? 0),
    0
  );

  const totalComments = releases.reduce(
    (sum, release) => sum + (release._count.comments ?? 0),
    0
  );

  const primaryAction = getPrimaryAction(role);
  const PrimaryActionIcon = primaryAction.icon;

  return (
    <div className="space-y-8 lg:space-y-10">

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
          <div className="grid gap-4 xl:grid-cols-2">
            {releases.map((release) => {
              const href = buildReleaseHref(release.slug);

              return (
                <article
                  key={release.id}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 transition hover:border-zinc-700 hover:bg-zinc-900/70"
                >
                  <div className="relative">
                    <div className="h-52 w-full border-b border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
                      {release.imageUrl ? (
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

                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <div className="text-xs text-zinc-500">
                        Published on {formatDateTime(release.createdAt)}
                      </div>

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
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}