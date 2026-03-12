import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type SearchParams = Promise<{
  page?: string;
}>;

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
        Seite <span className="font-semibold text-white">{currentPage}</span> von{" "}
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
          Zurück
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
          Weiter
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default async function PhotosPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const currentPage = parsePage(searchParams.page);

  const totalCount = await prisma.homeMedia.count({
    where: {
      active: true,
      type: "IMAGE",
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const photos = await prisma.homeMedia.findMany({
    where: {
      active: true,
      type: "IMAGE",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip,
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
            <ImageIcon className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Fotos
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Alle veröffentlichten Bilder mit Pagination.
            </p>
          </div>
        </div>
      </section>

      <Pagination currentPage={safePage} totalPages={totalPages} basePath="/photos" />

      {photos.length === 0 ? (
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8 text-white/55">
          Keine Fotos vorhanden.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]"
            >
              <img
                src={item.url}
                alt={item.title || "Foto"}
                className="aspect-video w-full bg-black object-cover"
              />

              <div className="p-5">
                <h2 className="text-xl font-semibold text-white">
                  {item.title || "Ohne Titel"}
                </h2>

                {item.description ? (
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination currentPage={safePage} totalPages={totalPages} basePath="/photos" />
    </div>
  );
}