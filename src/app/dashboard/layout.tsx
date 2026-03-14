import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

type SessionUser = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  image?: string | null;
};

const BRAND = "#6c5ce7";

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "rgba(108, 92, 231, 0.85)" }}
              >
                Admin Area
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                ArcadiaX Dashboard
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Manage releases, media, comments, and users in one central and
                clean interface.
              </p>
            </div>

            <div
              className="rounded-2xl border bg-white/5 px-4 py-3 backdrop-blur"
              style={{ borderColor: "rgba(255,255,255,0.10)" }}
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Signed in as
              </p>
              <p className="mt-1 font-semibold text-white">
                {user.name?.trim() || "Administrator"}
              </p>
              <p className="text-sm text-zinc-400">
                {user.email?.trim() || "No email available"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <DashboardSidebar
              userName={user.name || undefined}
              userEmail={user.email || undefined}
            />
          </aside>

          <section className="min-w-0">
            <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-6">
              {children}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}