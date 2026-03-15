import { getServerSession } from "next-auth";
import { MessageSquare } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CommunityFeed from "@/components/community/CommunityFeed";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string | null;
  role?: string | null;
};

export default async function CommunityPage() {
  const session = await getServerSession(authOptions);

  const posts = await prisma.communityPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          role: true,
        },
      },
    },
  });

  const user = session?.user as SessionUser | undefined;

  const currentUser = user
    ? {
        id: user.id ?? null,
        name: user.name ?? null,
        username: user.username ?? null,
        image: user.image ?? null,
        role: user.role ?? null,
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(108,92,231,0.05),transparent)]" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6c5ce7]/30 bg-[#6c5ce7]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#9d8dff]">
              <MessageSquare className="h-4 w-4" />
              ArcadiaX Community
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Exchange ideas, talk about releases, and connect with the community.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-white/70 sm:text-base lg:text-lg">
              The community area is your place for discussion inside ArcadiaX.
              Everyone can read messages, but only logged-in users can create new
              posts. Each user can edit and delete their own messages, and admins
              can remove any message when needed.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                Public reading
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                Login required to post
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                Own posts editable
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                Admin moderation
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/30 p-5 shadow-xl shadow-black/20">
            <p className="text-sm font-medium text-white/50">Community Status</p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-white/70">Messages</span>
                <span className="text-sm font-semibold text-white">
                  {posts.length}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-white/70">Posting</span>
                <span className="text-sm font-semibold text-[#9d8dff]">
                  {currentUser?.id ? "Enabled" : "Login required"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-white/70">Moderation</span>
                <span className="text-sm font-semibold text-white">
                  {currentUser?.role === "ADMIN" ? "Admin access" : "Standard access"}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#6c5ce7]/20 bg-[#6c5ce7]/10 px-4 py-4 text-sm leading-6 text-white/80">
              {currentUser?.id ? (
                <>
                  You are signed in as{" "}
                  <span className="font-semibold text-white">
                    {currentUser.name || currentUser.username || "User"}
                  </span>
                  . You can post new messages and manage your own content.
                </>
              ) : (
                <>
                  You are currently browsing as a guest. Sign in to write a new
                  message and participate in the discussion.
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <CommunityFeed posts={posts} currentUser={currentUser} />
      </section>
    </main>
  );
}