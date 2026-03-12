import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FileText, ImageIcon, Lightbulb, Plus, Shield, Upload } from "lucide-react";

import { authOptions } from "@/lib/auth";

export default async function NewReleasePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Shield className="h-4 w-4" />
              Release Management
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Neues Release erstellen
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Erstelle ein neues Release und lade direkt die Release-Datei sowie
                optional ein Vorschaubild hoch.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
              <FileText className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/50">Formular</div>
              <h2 className="text-2xl font-semibold text-white">
                Release-Daten eingeben
              </h2>
            </div>
          </div>

          <form
            action="/api/admin/releases"
            method="POST"
            encType="multipart/form-data"
            className="grid gap-5"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Titel
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="z. B. ArcadiaX"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Version
                </label>
                <input
                  type="text"
                  name="version"
                  placeholder="z. B. 1.0.0"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Slug
                </label>
                <input
                  type="text"
                  name="slug"
                  placeholder="z. B. arcadiax"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
                />
                <p className="mt-2 text-xs text-white/45">
                  Optional. Wenn leer, wird der Slug automatisch aus dem Titel erzeugt.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="DRAFT"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Beschreibung
              </label>
              <textarea
                name="description"
                rows={5}
                placeholder="Beschreibe das Release, Funktionen, Änderungen oder Hinweise..."
                className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">
                Changelog
              </label>
              <textarea
                name="changelog"
                rows={5}
                placeholder="Was hat sich geändert?"
                className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white outline-none placeholder:text-white/30"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
                  <ImageIcon className="h-4 w-4 text-blue-300" />
                  Vorschaubild hochladen
                </label>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="block w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                <p className="mt-2 text-xs text-white/45">
                  Optional. Bild für Karten, Listen und Vorschau.
                </p>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
                  <Upload className="h-4 w-4 text-blue-300" />
                  Release-Datei hochladen
                </label>
                <input
                  type="file"
                  name="file"
                  required
                  className="block w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                <p className="mt-2 text-xs text-white/45">
                  Pflichtfeld. Das ist die eigentliche Release-Datei zum Download.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18"
              >
                <Plus className="h-4 w-4 text-blue-300" />
                <span>Release erstellen</span>
              </button>

              <Link
                href="/dashboard/releases"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Abbrechen
              </Link>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
                <Lightbulb className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/50">Hinweise</div>
                <h2 className="text-2xl font-semibold text-white">
                  Empfehlungen
                </h2>
              </div>
            </div>

            <div className="space-y-5 text-sm leading-8 text-white/65">
              <div className="rounded-3xl border border-white/10 bg-[#07090f] p-5">
                Verwende einen klaren Titel und eine saubere Versionsnummer, damit
                das Release später gut lesbar ist.
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#07090f] p-5">
                Nutze einen eindeutigen Slug wie <span className="text-white">arcadiax</span>.
                Wenn du nichts einträgst, wird er automatisch erzeugt.
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#07090f] p-5">
                Setze den Status zunächst auf <span className="text-white">DRAFT</span>,
                wenn du das Release erst intern vorbereiten möchtest.
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#07090f] p-5">
                Lade die Datei direkt hoch. Die Download-URL wird automatisch gespeichert.
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}