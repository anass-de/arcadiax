import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon } from "lucide-react";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type SearchParams = Promise<{
  page?: string;
}>;

type PhotoItem = {
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
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
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="text-sm text-zinc-400">
        Seite <span className="font-semibold text-white">{currentPage}</span> von{" "}
        <span className="font-semibold text-white">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`${basePath}?page=${Math.max(1, currentPage - 1)}`}
          aria-disabled={currentPage <= 1}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            currentPage <= 1
              ? "pointer-events-none border-white/10 bg-white/5 text-zinc-600"
              : "border-white/10 bg-black/20 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
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
              ? "pointer-events-none border-white/10 bg-white/5 text-zinc-600"
              : "border-white/10 bg-black/20 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
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

  const photos: PhotoItem[] = await prisma.homeMedia.findMany({
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
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <ImageIcon className="h-5 w-5 text-cyan-300" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                Bilder
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Alle veröffentlichten Bilder mit Pagination.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
            {totalCount} Bilder insgesamt
          </div>
        </div>
      </section>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        basePath="/photos"
      />

      {photos.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-8 text-zinc-400">
          Keine Bilder verfügbar.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((item: PhotoItem) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 transition hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              <Link href={item.url} target="_blank" className="block bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.title || "Bild"}
                  className="aspect-video w-full object-cover transition duration-300 hover:scale-[1.02]"
                />
              </Link>

              <div className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {item.title || "Ohne Titel"}
                  </h2>

                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {item.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Keine Beschreibung vorhanden.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    Aktualisiert: {formatDate(item.updatedAt)}
                  </div>

                  <Link
                    href={item.url}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  >
                    Öffnen
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
        basePath="/photos"
      />
    </div>
  );
}