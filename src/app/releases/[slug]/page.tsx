import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  ImageIcon,
  LogIn,
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
    return "No description has been added for this release yet.";
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
      title: "Release Not Found | ArcadiaX",
    };
  }

  return {
    title: `${release.title} ${release.version} | ArcadiaX`,
    description:
      release.description?.slice(0, 160) ||
      `Release page for ${release.title} ${release.version} on ArcadiaX.`,
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

        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/releases"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Releases</span>
          </Link>

          {isAdmin ? (
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              <Shield className="h-4 w-4" />
              <span>Manage Releases</span>
            </Link>
          ) : null}
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
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
              Release Details
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]"
                  style={{
                    borderColor: "rgba(108, 92, 231, 0.22)",
                    backgroundColor: "rgba(108, 92, 231, 0.10)",
                    color: BRAND,
                  }}
                >
                  {release.status}
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                  Version {release.version}
                </div>
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {release.title}
              </h1>

              <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                {getSafeDescription(release.description)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasDownload && downloadHref ? (
                isLoggedIn ? (
                  <a
                    href={downloadHref}
                    className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: BRAND }}
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Release</span>
                  </a>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold text-white transition"
                    style={{
                      borderColor: "rgba(108, 92, 231, 0.28)",
                      backgroundColor: "rgba(108, 92, 231, 0.12)",
                    }}
                  >
                    <LogIn className="h-4 w-4" style={{ color: BRAND }} />
                    <span>Log in to Download</span>
                  </Link>
                )
              ) : (
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-zinc-500">
                  <Download className="h-4 w-4" />
                  <span>No Download Available</span>
                </span>
              )}
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Download className="h-4 w-4" style={{ color: BRAND }} />
                  <span className="text-xs uppercase tracking-[0.14em]">
                    Downloads
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {release.downloadCount ?? 0}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <MessageSquare className="h-4 w-4" style={{ color: BRAND }} />
                  <span className="text-xs uppercase tracking-[0.14em]">
                    Comments
                  </span>
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {commentsCount}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <CalendarDays className="h-4 w-4" style={{ color: BRAND }} />
                  <span className="text-xs uppercase tracking-[0.14em]">
                    Published
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDate(release.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
              <div className="flex h-[320px] w-full items-center justify-center border-b border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
                {hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.imageUrl!}
                    alt={release.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-500">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <ImageIcon className="h-8 w-8" style={{ color: `${BRAND}cc` }} />
                    </div>
                    <span className="text-sm">No preview image available</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-5">
                <div className="text-sm font-medium text-zinc-500">
                  Release Overview
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Title</span>
                  </div>
                  <span className="max-w-[180px] truncate text-xs text-zinc-400">
                    {release.title}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Version</span>
                  </div>
                  <span className="text-xs text-zinc-400">{release.version}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Created</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {formatDateTime(release.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4" style={{ color: BRAND }} />
                    <span className="text-sm text-zinc-200">Updated</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {formatDateTime(release.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-medium text-zinc-500">
                Community Status
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {isLoggedIn
                  ? "You are signed in and can download this release and take part in the discussion."
                  : "You can view this release publicly, but you must log in to download or comment."}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                ArcadiaX keeps release pages public, while downloads and
                interactions are reserved for signed-in users.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <Package className="h-5 w-5" style={{ color: BRAND }} />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-500">
                Description
              </div>
              <h2 className="text-2xl font-semibold text-white">
                About This Release
              </h2>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="whitespace-pre-line text-sm leading-7 text-zinc-300">
              {getSafeDescription(release.description)}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {hasDownload && downloadHref ? (
              isLoggedIn ? (
                <a
                  href={downloadHref}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  <Download className="h-4 w-4" />
                  <span>Download Now</span>
                </a>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold text-white transition"
                  style={{
                    borderColor: "rgba(108, 92, 231, 0.28)",
                    backgroundColor: "rgba(108, 92, 231, 0.12)",
                  }}
                >
                  <LogIn className="h-4 w-4" style={{ color: BRAND }} />
                  <span>Log in to Download</span>
                </Link>
              )
            ) : null}

            <Link
              href="/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>More Releases</span>
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
              <MessageSquare className="h-5 w-5" style={{ color: BRAND }} />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-500">
                Community
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Discussion & Feedback
              </h2>
            </div>
          </div>

          {isLoggedIn ? (
            <p className="text-sm leading-6 text-zinc-400">
              Signed-in users can write comments, reply to discussions, and
              share feedback about this release.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-zinc-400">
                Comments are available only for signed-in users.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold text-white transition"
                style={{
                  borderColor: "rgba(108, 92, 231, 0.28)",
                  backgroundColor: "rgba(108, 92, 231, 0.12)",
                }}
              >
                <LogIn className="h-4 w-4" style={{ color: BRAND }} />
                <span>Log in to Comment</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      <ReleaseComments
        releaseId={release.id}
        currentUser={
          isLoggedIn
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