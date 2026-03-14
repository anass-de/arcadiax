import Link from "next/link";
import { ChevronLeft, ChevronRight, Film, ExternalLink } from "lucide-react";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 6;

type SearchParams = Promise<{
  page?: string;
}>;

type VideoItem = {
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

function parsePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function Pagination({
  currentPage,
  totalPages,
  basePath,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm text-white/60">
        Page <span className="font-semibold text-white">{currentPage}</span> of{" "}
        <span className="font-semibold text-white">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`${basePath}?page=${Math.max(1, currentPage - 1)}`}
          aria-disabled={currentPage <= 1}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage <= 1
              ? "pointer-events-none border-white/10 bg-white/[0.03] text-white/30"
              : "border-white/10 bg-[#07090f] text-white hover:border-blue-400/40 hover:bg-blue-500/10"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>

        <Link
          href={`${basePath}?page=${Math.min(totalPages, currentPage + 1)}`}
          aria-disabled={currentPage >= totalPages}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage >= totalPages
              ? "pointer-events-none border-white/10 bg-white/[0.03] text-white/30"
              : "border-white/10 bg-[#07090f] text-white hover:border-blue-400/40 hover:bg-blue-500/10"
          }`}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default async function VideosPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const currentPage = parsePage(searchParams.page);

  const totalCount = await prisma.homeMedia.count({
    where: {
      active: true,
      type: "VIDEO",
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const videos: VideoItem[] = await prisma.homeMedia.findMany({
    where: {
      active: true,
      type: "VIDEO",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip,
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
              <Film className="h-5 w-5 text-blue-300" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                Videos
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Browse all published videos with pagination.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white/60">
            {totalCount} videos total
          </div>
        </div>
      </section>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        basePath="/videos"
      />

      {videos.length === 0 ? (
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8 text-white/55">
          No videos available.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((item: VideoItem) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition hover:border-blue-400/20 hover:bg-white/[0.05]"
            >
              <div className="bg-black">
                <video
                  src={item.url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full object-cover"
                />
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {item.title || "Untitled"}
                  </h2>

                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      {item.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-white/35">
                      No description available.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-white/40">
                    Updated:{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                    }).format(item.updatedAt)}
                  </div>

                  <Link
                    href={item.url}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#07090f] px-3 py-2 text-sm text-white/75 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
                  >
                    Open
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        basePath="/videos"
      />
    </div>
  );
}