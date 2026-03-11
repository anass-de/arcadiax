import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  FileText,
  ImageIcon,
  Plus,
  Shield,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function normalizeOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export default async function NewReleasePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  async function createReleaseAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      redirect("/");
    }

    const title = String(formData.get("title") || "").trim();
    const version = String(formData.get("version") || "").trim();
    const status = String(formData.get("status") || "DRAFT")
      .trim()
      .toUpperCase();

    const slug = normalizeOptional(formData.get("slug"));
    const description = normalizeOptional(formData.get("description"));
    const imageUrl = normalizeOptional(formData.get("imageUrl"));
    const fileUrl = normalizeOptional(formData.get("fileUrl"));

    if (!title) {
      throw new Error("Titel darf nicht leer sein.");
    }

    if (!version) {
      throw new Error("Version darf nicht leer sein.");
    }

    if (status !== "DRAFT" && status !== "PUBLISHED") {
      throw new Error("Ungültiger Status.");
    }

    const userId = session.user.id;

    if (!userId) {
      throw new Error("Kein gültiger Benutzer gefunden.");
    }

    const release = await prisma.release.create({
      data: {
        title,
        version,
        status: status as "DRAFT" | "PUBLISHED",
        slug,
        description,
        imageUrl,
        fileUrl,
        authorId: userId,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/releases");
    revalidatePath("/releases");

    if (release.slug) {
      revalidatePath(`/releases/${release.slug}`);
    } else {
      revalidatePath(`/releases/${release.id}`);
    }

    redirect("/dashboard/releases");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
              <Shield className="h-4 w-4" />
              Neues Release
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Release erstellen
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Lege eine neue Version an, definiere Status, Beschreibung sowie
                Bild- und Datei-URLs und veröffentliche dein Release später
                direkt über das Dashboard.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Zurück zu Releases</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          action={createReleaseAction}
          className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8"
        >
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

          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Titel
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="z. B. ArcadiaX"
                />
              </div>

              <div>
                <label
                  htmlFor="version"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Version
                </label>
                <input
                  id="version"
                  name="version"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="z. B. 1.0.0"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Slug
                </label>
                <input
                  id="slug"
                  name="slug"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="z. B. arcadiax"
                />
                <p className="mt-2 text-xs text-white/40">
                  Optional. Wird für die öffentliche URL verwendet.
                </p>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="DRAFT"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/30"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Beschreibung
              </label>
              <textarea
                id="description"
                name="description"
                rows={7}
                className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                placeholder="Beschreibe das Release, Funktionen, Änderungen oder Hinweise..."
              />
            </div>

            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="imageUrl"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Bild-URL
                </label>
                <input
                  id="imageUrl"
                  name="imageUrl"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label
                  htmlFor="fileUrl"
                  className="mb-2 block text-sm font-medium text-white/70"
                >
                  Datei-URL
                </label>
                <input
                  id="fileUrl"
                  name="fileUrl"
                  className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-500/30"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
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
                <ArrowLeft className="h-4 w-4" />
                <span>Abbrechen</span>
              </Link>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
                <ImageIcon className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/50">Hinweise</div>
                <h2 className="text-2xl font-semibold text-white">
                  Empfehlungen
                </h2>
              </div>
            </div>

            <div className="space-y-4 text-sm leading-7 text-white/65">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                Verwende einen klaren Titel und eine saubere Versionsnummer,
                damit das Release später in Tabellen und auf der öffentlichen
                Seite gut lesbar ist.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                Nutze einen eindeutigen Slug wie <span className="text-white">arcadiax</span>
                , damit die URL professionell aussieht.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                Setze den Status zunächst auf <span className="text-white">DRAFT</span>,
                wenn du das Release erst intern vorbereiten möchtest.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                Hinterlege eine Bild-URL für die Vorschau und eine Datei-URL,
                damit dein Download-Button später sofort funktioniert.
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6 sm:p-8">
            <div className="text-sm font-medium text-white/50">
              Was nach dem Erstellen passiert
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-sm font-semibold text-white">
                  1. Release wird gespeichert
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Alle Daten werden direkt in deiner Datenbank angelegt.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-sm font-semibold text-white">
                  2. Dashboard wird aktualisiert
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Release-Listen und Statistiken werden neu validiert.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#07090f] px-4 py-4">
                <div className="text-sm font-semibold text-white">
                  3. Rückkehr zur Release-Verwaltung
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Nach dem Speichern landest du direkt wieder in der Übersicht.
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}