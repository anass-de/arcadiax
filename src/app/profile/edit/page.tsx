import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      username: true,
      bio: true,
      image: true,
      email: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
        <h1 className="text-3xl font-bold tracking-tight">Profil bearbeiten</h1>

        <form action="/api/profile" method="POST" className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Name
            </label>
            <input
              name="name"
              defaultValue={user.name ?? ""}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Username
            </label>
            <input
              name="username"
              defaultValue={user.username ?? ""}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Bild-URL
            </label>
            <input
              name="image"
              defaultValue={user.image ?? ""}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Bio
            </label>
            <textarea
              name="bio"
              defaultValue={user.bio ?? ""}
              rows={6}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Profil speichern
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}