import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED";

type ReleaseOption = {
  id: string;
  slug: string;
  title: string | null;
};

type CommentItem = {
  id: string;
  content: string;
  status: CommentStatus;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
  } | null;
  release: {
    id: string;
    title: string | null;
    slug: string;
  } | null;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") redirect("/");

  return session.user;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function approveComment(formData: FormData) {
  "use server";

  const id = String(formData.get("id"));

  await prisma.comment.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  revalidatePath("/dashboard/comments");
}

async function rejectComment(formData: FormData) {
  "use server";

  const id = String(formData.get("id"));

  await prisma.comment.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  revalidatePath("/dashboard/comments");
}

async function deleteComment(formData: FormData) {
  "use server";

  const id = String(formData.get("id"));

  await prisma.comment.delete({
    where: { id },
  });

  revalidatePath("/dashboard/comments");
}

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    filter?: CommentStatus;
    releaseId?: string;
  };
}) {
  await requireAdmin();

  const page = Number(searchParams.page ?? "1");
  const filter = searchParams.filter;
  const releaseId = searchParams.releaseId;

  const where = {
    ...(filter ? { status: filter } : {}),
    ...(releaseId ? { releaseId } : {}),
  };

  const releases: ReleaseOption[] = await prisma.release.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.comment.count({ where });

  const comments: CommentItem[] = await prisma.comment.findMany({
    where,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
      },
      release: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-white">Kommentare</h1>
        <p className="text-white/60">
          Moderation aller Release-Kommentare
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">

        <select
          name="filter"
          defaultValue={filter ?? ""}
          className="rounded-xl bg-[#07090f] border border-white/10 p-3"
        >
          <option value="">Alle Status</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>

        <select
          name="releaseId"
          defaultValue={releaseId ?? ""}
          className="rounded-xl bg-[#07090f] border border-white/10 p-3"
        >
          <option value="">Alle Releases</option>

          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.title ?? release.slug}
            </option>
          ))}
        </select>

      </div>

      <div className="space-y-6">

        {comments.map((comment) => {

          const author =
            comment.author?.username ||
            comment.author?.name ||
            comment.author?.email ||
            "Unbekannt";

          return (
            <div
              key={comment.id}
              className="border border-white/10 rounded-2xl p-6 bg-white/[0.02]"
            >

              <div className="flex justify-between items-center mb-3">
                <div className="text-sm text-white/60">
                  {author}
                </div>

                <div className="text-xs text-white/40">
                  {formatDate(comment.createdAt)}
                </div>
              </div>

              <div className="text-white mb-4 whitespace-pre-wrap">
                {comment.content}
              </div>

              <div className="flex gap-3 flex-wrap">

                <form action={approveComment}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button className="px-4 py-2 bg-green-600 rounded-lg text-white text-sm">
                    Approve
                  </button>
                </form>

                <form action={rejectComment}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button className="px-4 py-2 bg-yellow-600 rounded-lg text-white text-sm">
                    Reject
                  </button>
                </form>

                <form action={deleteComment}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button className="px-4 py-2 bg-red-600 rounded-lg text-white text-sm">
                    Delete
                  </button>
                </form>

                {comment.release && (
                  <Link
                    href={`/releases/${comment.release.slug}`}
                    className="px-4 py-2 border border-white/20 rounded-lg text-sm"
                  >
                    Release ansehen
                  </Link>
                )}

              </div>

            </div>
          );
        })}

      </div>

      <div className="flex gap-4">

        {page > 1 && (
          <Link
            href={`/dashboard/comments?page=${page - 1}`}
            className="px-4 py-2 border border-white/20 rounded-lg"
          >
            Zurück
          </Link>
        )}

        {page < totalPages && (
          <Link
            href={`/dashboard/comments?page=${page + 1}`}
            className="px-4 py-2 border border-white/20 rounded-lg"
          >
            Weiter
          </Link>
        )}

      </div>

    </div>
  );
}