import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Lightbulb,
  Shield,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import NewReleaseForm from "@/components/releases/new-release-form";

type SessionUser = {
  role?: "USER" | "ADMIN" | null;
};

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

function normalizeMessage(value?: string) {
  const text = value?.trim();
  return text ? text : null;
}

export default async function NewReleasePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role ?? null;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/releases/new");
  }

  if (role !== "ADMIN") {
    redirect("/");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const successMessage = normalizeMessage(resolvedSearchParams.success);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Release Management
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Neues Release erstellen
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Erstelle ein neues Release und lade direkt die Release-Datei
                sowie optional ein Vorschaubild hoch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <div className="font-semibold">Erstellen fehlgeschlagen</div>
            <p className="mt-1 text-sm text-red-100/90">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-3 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <div className="font-semibold">Erfolgreich erstellt</div>
            <p className="mt-1 text-sm text-emerald-100/90">
              {successMessage}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <FileText className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-500">Formular</div>
              <h2 className="text-2xl font-semibold text-white">
                Release-Daten eingeben
              </h2>
            </div>
          </div>

          <NewReleaseForm />
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <Lightbulb className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-500">
                  Hinweise
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  Empfehlungen
                </h2>
              </div>
            </div>

            <div className="space-y-5 text-sm leading-7 text-zinc-400">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                Verwende einen klaren Titel und eine saubere Versionsnummer,
                damit das Release später gut lesbar ist.
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                Nutze einen eindeutigen Slug wie{" "}
                <span className="font-medium text-white">arcadiax</span>.
                Wenn du nichts einträgst, wird er automatisch erzeugt.
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                Setze den Status auf{" "}
                <span className="font-medium text-white">PUBLISHED</span>,
                wenn das Release direkt auf der Website erscheinen soll.
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                Die Datei wird direkt in den Storage hochgeladen. Danach
                werden nur die Metadaten gespeichert.
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}