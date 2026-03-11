import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { authOptions } from "@/lib/auth";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if ((session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  const headersList = await headers();
  const currentPath = headersList.get("x-pathname") || "/dashboard";

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Admin Bereich</p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            ArcadiaX Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Verwalte Releases, Medien, Kommentare und Benutzer in einer
            übersichtlichen Oberfläche.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <DashboardSidebar
            currentPath={currentPath}
            userName={session.user.name || undefined}
            userEmail={session.user.email || undefined}
          />

          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}