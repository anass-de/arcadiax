import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Shield,
  Upload,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import EditReleaseForm from "@/components/releases/edit-release-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

type SessionUser = {
  id?: string | null;
  role?: "USER" | "ADMIN" | null;
  email?: string | null;
  name?: string | null;
};

function getSessionUser(
  session: Awaited<ReturnType<typeof getServerSession>>
): SessionUser | null {
  if (!session) {
    return null;
  }

  const maybeSession = session as { user?: unknown };

  if (!maybeSession.user || typeof maybeSession.user !== "object") {
    return null;
  }

  return maybeSession.user as SessionUser;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function normalizeMessage(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function getStatusLabel(status: "DRAFT" | "PUBLISHED") {
  return status === "PUBLISHED" ? "Published" : "Draft";
}

function getStatusClasses(status: "DRAFT" | "PUBLISHED") {
  if (status === "PUBLISHED") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border border-white/10 bg-white/[0.03] text-white/70";
}

export default async function EditReleasePage({
  params,
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);
  const sessionUser = getSessionUser(session);

  if (!sessionUser) {
    redirect("/login?callbackUrl=/dashboard/releases");
  }

  if (sessionUser.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const successMessage = normalizeMessage(resolvedSearchParams.success);

  const release = await prisma.release.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      version: true,
      description: true,
      changelog: true,
      fileUrl: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          comments: true,
          downloads: true,
        },
      },
    },
  });

  if (!release) {
    notFound();
  }

  const publicHref = release.slug?.trim()
    ? `/releases/${release.slug}`
    : `/releases/${release.id}`;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(108,92,231,0.05),transparent)]" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6c5ce7]/30 bg-[#6c5ce7]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#9d8dff]">
              <Shield className="h-4 w-4" />
              Edit Release
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {release.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                Update the title, version, slug, status, and description. You
                can also replace the current image and release file directly
                from your computer.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#6c5ce7]/40 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Releases</span>
            </Link>

            <Link
              href={publicHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" />
              <span>View Public Page</span>
            </Link>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-[28px] border border-red-500/20 bg-red-500/10 p-4 text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <div className="font-semibold">Save failed</div>
            <p className="mt-1 text-sm text-red-100/90">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-3 rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <div className="font-semibold">Saved successfully</div>
            <p className="mt-1 text-sm text-emerald-100/90">
              {successMessage}
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Status
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${getStatusClasses(
                release.status
              )}`}
            >
              {getStatusLabel(release.status)}
            </span>
          </div>
          <div className="mt-3 text-sm text-white/60">
            Current publication status
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Downloads
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release._count.downloads}
          </div>
          <div className="mt-2 text-sm text-white/60">
            Total number of downloads
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Comments
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {release._count.comments}
          </div>
          <div className="mt-2 text-sm text-white/60">
            Community activity for this release
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">
            Updated
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {formatDateTime(release.updatedAt)}
          </div>
          <div className="mt-2 text-sm text-white/60">Latest update</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <ImageIcon className="h-5 w-5 text-[#9d8dff]" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/45">Form</div>
              <h2 className="text-2xl font-semibold text-white">
                Edit Release Details
              </h2>
            </div>
          </div>

          <EditReleaseForm
            release={{
              id: release.id,
              title: release.title,
              slug: release.slug,
              version: release.version,
              description: release.description,
              changelog: release.changelog,
              fileUrl: release.fileUrl,
              imageUrl: release.imageUrl,
              status: release.status,
            }}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <ImageIcon className="h-5 w-5 text-[#9d8dff]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/45">
                  Preview
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  Current Image & File
                </h2>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
              <div className="flex h-[260px] w-full items-center justify-center border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
                {release.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.imageUrl}
                    alt={release.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/45">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <ImageIcon className="h-8 w-8 text-[#9d8dff]/80" />
                    </div>
                    <span className="text-sm">No preview image available</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                    Current Image
                  </div>
                  <div className="mt-2 text-sm text-white/75">
                    {release.imageUrl ? "Image available" : "No image saved"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                    Current File
                  </div>
                  <div className="mt-2 text-sm text-white/75">
                    {release.fileUrl ? "File available" : "No file saved"}
                  </div>
                </div>

                {release.fileUrl ? (
                  <Link
                    href={release.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-[#6c5ce7]/40 hover:text-white"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Open Current File</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <div className="text-sm font-medium text-white/45">Metadata</div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Created
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(release.createdAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Last Updated
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDateTime(release.updatedAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Public URL
                </div>
                <div className="mt-2 break-all text-sm font-semibold text-white">
                  {publicHref}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}