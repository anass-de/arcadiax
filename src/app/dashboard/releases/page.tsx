import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import {
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type ReleaseStatus = "DRAFT" | "PUBLISHED";

type ReleaseRow = {
  id: string;
  title: string;
  slug: string | null;
  version: string;
  description: string | null;
  fileUrl: string;
  imageUrl: string | null;
  downloadCount: number;
  status: ReleaseStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    comments: number;
  };
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shorten(text: string, max = 100) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function getReleaseHref(release: { id: string; slug?: string | null }) {
  if (release.slug?.trim()) {
    return `/releases/${release.slug}`;
  }

  return `/releases/${release.id}`;
}

function getStatusClasses(status: ReleaseStatus) {
  if (status === "PUBLISHED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/65";
}

export default async function DashboardReleasesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const releases: ReleaseRow[] = await prisma.release.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      version: true,
      description: true,
      fileUrl: true,
      imageUrl: true,
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

  const totalReleases = releases.length;

  const publishedReleases = releases.filter(
    (release: ReleaseRow) => release.status === "PUBLISHED"
  ).length;

  const draftReleases = releases.filter(
    (release: ReleaseRow) => release.status === "DRAFT"
  ).length;

  const totalDownloads = releases.reduce(
    (sum: number, release: ReleaseRow) => sum + (release.downloadCount ?? 0),
    0
  );

  async function toggleStatusAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      redirect("/");
    }

    const releaseId = String(formData.get("releaseId") || "").trim();

    if (!releaseId) {
      return;
    }

    const existing = await prisma.release.findUnique({
      where: { id: releaseId },
      select: { id: true, status: true },
    });

    if (!existing) return;

    await prisma.release.update({
      where: { id: releaseId },
      data: {
        status: existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
      },
    });

    revalidatePath("/dashboard/releases");
    revalidatePath("/dashboard");
    revalidatePath("/releases");
  }

  async function deleteReleaseAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      redirect("/");
    }

    const releaseId = String(formData.get("releaseId") || "").trim();

    if (!releaseId) {
      return;
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.comment.deleteMany({
        where: { releaseId },
      });

      await tx.releaseLike.deleteMany({
        where: { releaseId },
      });

      await tx.download.deleteMany({
        where: { releaseId },
      });

      await tx.release.delete({
        where: { id: releaseId },
      });
    });

    revalidatePath("/dashboard/releases");
    revalidatePath("/dashboard");
    revalidatePath("/releases");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Releases</p>
          <p className="mt-3 text-3xl font-bold text-white">{totalReleases}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Published</p>
          <p className="mt-3 text-3xl font-bold text-white">
            {publishedReleases}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Drafts</p>
          <p className="mt-3 text-3xl font-bold text-white">{draftReleases}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Downloads</p>
          <p className="mt-3 text-3xl font-bold text-white">
            {totalDownloads}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03]">
        <table className="min-w-full">
          <tbody>
            {releases.map((release: ReleaseRow) => {
              const releaseHref = getReleaseHref(release);

              return (
                <tr key={release.id}>
                  <td className="p-6">
                    <div className="font-semibold text-white">
                      {release.title}
                    </div>
                    <div className="text-sm text-zinc-400">
                      Version {release.version}
                    </div>

                    <Link
                      href={releaseHref}
                      className="text-blue-400 text-sm"
                    >
                      Release ansehen
                    </Link>
                  </td>

                  <td className="p-6">
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${getStatusClasses(
                        release.status
                      )}`}
                    >
                      {release.status}
                    </span>
                  </td>

                  <td className="p-6 text-white">
                    {release.downloadCount ?? 0}
                  </td>

                  <td className="p-6 text-white">
                    {release._count.comments}
                  </td>

                  <td className="p-6 text-white/60">
                    {formatDateTime(release.createdAt)}
                  </td>

                  <td className="p-6">
                    <Link
                      href={`/dashboard/releases/${release.id}/edit`}
                      className="mr-2 text-blue-400"
                    >
                      Edit
                    </Link>

                    <form action={deleteReleaseAction} className="inline">
                      <input
                        type="hidden"
                        name="releaseId"
                        value={release.id}
                      />
                      <button className="text-red-400">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}