"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  File,
  FileImage,
  Film,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type MediaType = "IMAGE" | "VIDEO";

type MediaItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  url: string;
  type: MediaType;
  sortOrder?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  author?: {
    id: string;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
};

type MediaListResponse = {
  media: MediaItem[];
};

type UploadResponse = {
  ok: boolean;
  media?: MediaItem;
  error?: string;
};

type DeleteResponse = {
  ok: boolean;
  deletedId?: string;
  error?: string;
};

type FilterKind = "all" | "IMAGE" | "VIDEO";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(bytes?: number | null) {
  if (!bytes || Number.isNaN(bytes)) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getKindLabel(kind: MediaType) {
  switch (kind) {
    case "IMAGE":
      return "Bild";
    case "VIDEO":
      return "Video";
    default:
      return kind;
  }
}

function getKindIcon(kind: MediaType) {
  switch (kind) {
    case "IMAGE":
      return <FileImage className="h-4 w-4" />;
    case "VIDEO":
      return <Film className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
}

function isImage(item: MediaItem) {
  return item.type === "IMAGE";
}

function isVideo(item: MediaItem) {
  return item.type === "VIDEO";
}

function getDisplayTitle(item: MediaItem) {
  if (item.title?.trim()) return item.title.trim();

  const parts = item.url.split("/");
  const fileName = parts[parts.length - 1] || "Datei";

  return decodeURIComponent(fileName);
}

function getDisplayFileName(item: MediaItem) {
  const parts = item.url.split("/");
  const fileName = parts[parts.length - 1] || item.id;

  return decodeURIComponent(fileName);
}

export default function DashboardMediaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");

  const [selectedType, setSelectedType] = useState<MediaType>("IMAGE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadMedia(showRefreshSpinner = false) {
    try {
      setErrorMessage(null);

      if (showRefreshSpinner) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch("/api/admin/media", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as MediaListResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Medien konnten nicht geladen werden.",
        );
      }

      const items =
        data && "media" in data && Array.isArray(data.media) ? data.media : [];

      setMediaItems(items);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Laden der Medien.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadMedia();
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return mediaItems.filter((item: MediaItem) => {
      const matchesKind = filterKind === "all" ? true : item.type === filterKind;

      const haystack = [
        getDisplayTitle(item),
        getDisplayFileName(item),
        item.description ?? "",
        item.url,
        item.author?.name ?? "",
        item.author?.username ?? "",
        item.author?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;

      return matchesKind && matchesQuery;
    });
  }, [mediaItems, query, filterKind]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Bitte wähle zuerst eine Datei aus.");
      setSuccessMessage(null);
      return;
    }

    try {
      setUploading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const formData = new FormData();
      formData.append("type", selectedType);
      formData.append("file", selectedFile);

      if (uploadTitle.trim()) {
        formData.append("title", uploadTitle.trim());
      }

      if (uploadDescription.trim()) {
        formData.append("description", uploadDescription.trim());
      }

      formData.append("sortOrder", "0");
      formData.append("active", "true");

      const response = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.ok || !data.media) {
        throw new Error(data.error || "Upload fehlgeschlagen.");
      }

      setMediaItems((current: MediaItem[]) => [data.media as MediaItem, ...current]);
      setSelectedFile(null);
      setUploadTitle("");
      setUploadDescription("");
      setSuccessMessage(
        selectedType === "IMAGE"
          ? "Bild wurde erfolgreich hochgeladen."
          : "Video wurde erfolgreich hochgeladen.",
      );

      const input = document.getElementById("media-file") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Upload fehlgeschlagen.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: MediaItem) {
    const confirmed = window.confirm(
      `Möchtest du "${getDisplayTitle(item)}" wirklich löschen?`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(
        `/api/admin/media?id=${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
        },
      );

      const data = (await response.json()) as DeleteResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Löschen fehlgeschlagen.");
      }

      setMediaItems((current: MediaItem[]) =>
        current.filter((entry: MediaItem) => entry.id !== item.id),
      );
      setSuccessMessage("Medium wurde erfolgreich gelöscht.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Löschen fehlgeschlagen.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-xl shadow-black/15 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Media Library
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Verwalte Bilder und Videos für ArcadiaX zentral an einem Ort.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMedia(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Neu laden
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <div className="font-semibold">Fehler</div>
            <p className="mt-1 text-sm text-red-100/90">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 shadow-xl shadow-black/10">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Neues Medium hochladen</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Wähle zuerst aus, ob du ein Bild oder ein Video veröffentlichen willst.
            </p>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Medientyp
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType("IMAGE")}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    selectedType === "IMAGE"
                      ? "border border-cyan-400/40 bg-cyan-400/10 text-white"
                      : "border border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <FileImage className="h-4 w-4" />
                  Bild
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType("VIDEO")}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    selectedType === "VIDEO"
                      ? "border border-cyan-400/40 bg-cyan-400/10 text-white"
                      : "border border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <Film className="h-4 w-4" />
                  Video
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300" htmlFor="media-file">
                Datei
              </label>

              <input
                id="media-file"
                type="file"
                accept={selectedType === "IMAGE" ? "image/*" : "video/*"}
                onChange={handleFileChange}
                className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />

              {selectedFile ? (
                <p className="text-xs text-zinc-400">
                  Ausgewählt: <span className="text-zinc-200">{selectedFile.name}</span> (
                  {formatBytes(selectedFile.size)})
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300" htmlFor="media-title">
                Titel
              </label>

              <input
                id="media-title"
                type="text"
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="Optionaler Titel"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/40 focus:bg-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-zinc-300"
                htmlFor="media-description"
              >
                Beschreibung
              </label>

              <textarea
                id="media-description"
                value={uploadDescription}
                onChange={(event) => setUploadDescription(event.target.value)}
                placeholder="Optionale Beschreibung"
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/40 focus:bg-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {selectedType === "IMAGE" ? "Bild hochladen" : "Video hochladen"}
                </>
              )}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 shadow-xl shadow-black/10">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Medien</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {filteredItems.length} von {mediaItems.length} Einträgen sichtbar
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suchen..."
                  className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/40 focus:bg-zinc-900"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-white"
                    aria-label="Suche leeren"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <select
                value={filterKind}
                onChange={(event) => setFilterKind(event.target.value as FilterKind)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40 focus:bg-zinc-900"
              >
                <option value="all">Alle Typen</option>
                <option value="IMAGE">Bilder</option>
                <option value="VIDEO">Videos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10">
              <div className="flex items-center gap-3 text-zinc-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                Medien werden geladen...
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 px-6 text-center">
              <div className="rounded-2xl bg-white/5 p-4 text-zinc-300">
                <File className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Keine Medien gefunden
              </h3>
              <p className="mt-2 max-w-md text-sm text-zinc-400">
                Passe Suche oder Filter an oder lade ein neues Medium hoch.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
              {filteredItems.map((item: MediaItem) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-black/20"
                >
                  <div className="relative aspect-[16/10] bg-black">
                    {isImage(item) ? (
                      <Image
                        src={item.url}
                        alt={item.title || getDisplayFileName(item)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                        unoptimized
                      />
                    ) : isVideo(item) ? (
                      <video
                        src={item.url}
                        controls
                        className="h-full w-full object-cover"
                        preload="metadata"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-500">
                        <File className="h-14 w-14" />
                      </div>
                    )}

                    <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      {getKindIcon(item.type)}
                      {getKindLabel(item.type)}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <h3 className="line-clamp-1 text-base font-semibold text-white">
                        {getDisplayTitle(item)}
                      </h3>

                      <p className="line-clamp-1 text-sm text-zinc-400">
                        {getDisplayFileName(item)}
                      </p>

                      {item.description ? (
                        <p className="line-clamp-2 text-sm text-zinc-500">
                          {item.description}
                        </p>
                      ) : null}

                      <div className="grid grid-cols-1 gap-2 text-xs text-zinc-500">
                        <div>
                          <span className="text-zinc-400">Typ:</span> {getKindLabel(item.type)}
                        </div>
                        <div>
                          <span className="text-zinc-400">Status:</span>{" "}
                          {item.active ? "Aktiv" : "Inaktiv"}
                        </div>
                        <div>
                          <span className="text-zinc-400">Hochgeladen:</span>{" "}
                          {formatDate(item.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-zinc-700 hover:bg-zinc-800"
                      >
                        Öffnen
                      </a>

                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`${getDisplayFileName(item)} löschen`}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}