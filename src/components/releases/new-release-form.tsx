"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Plus, Upload, XCircle } from "lucide-react";

import { uploadFileToR2, type UploadMetrics } from "@/lib/upload-file";

type UploadState = {
  isUploading: boolean;
  progress: number;
  fileName: string | null;
  uploadedUrl: string | null;
  error: string | null;
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  remainingSeconds: number | null;
};

const initialUploadState: UploadState = {
  isUploading: false,
  progress: 0,
  fileName: null,
  uploadedUrl: null,
  error: null,
  uploadedBytes: 0,
  totalBytes: 0,
  speedBytesPerSecond: 0,
  remainingSeconds: null,
};

const MAX_IMAGE_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_RELEASE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const ALLOWED_RELEASE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "application/pdf",
  "application/x-7z-compressed",
  "application/vnd.rar",
] as const;

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "release"
  );
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSecond: number) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatRemainingTime(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  if (seconds < 60) {
    return `${Math.ceil(seconds)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.ceil(seconds % 60);

  if (minutes < 60) {
    return `${minutes} min ${restSeconds} s`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return `${hours} h ${restMinutes} min`;
}

export default function NewReleaseForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [imageUpload, setImageUpload] = useState<UploadState>(initialUploadState);
  const [releaseUpload, setReleaseUpload] = useState<UploadState>(initialUploadState);

  const imageAbortRef = useRef<AbortController | null>(null);
  const releaseAbortRef = useRef<AbortController | null>(null);

  const slug = useMemo(() => slugify(title), [title]);

  function applyMetrics(
    fileName: string,
    metrics: UploadMetrics,
    target: "image" | "release"
  ) {
    const updater = (prev: UploadState): UploadState => ({
      ...prev,
      isUploading: true,
      fileName,
      progress: metrics.progress,
      uploadedBytes: metrics.uploadedBytes,
      totalBytes: metrics.totalBytes,
      speedBytesPerSecond: metrics.speedBytesPerSecond,
      remainingSeconds: metrics.remainingSeconds,
    });

    if (target === "image") {
      setImageUpload(updater);
      return;
    }

    setReleaseUpload(updater);
  }

  function resetUpload(which: "image" | "release") {
    if (which === "image") {
      imageAbortRef.current?.abort();
      setImageUpload(initialUploadState);
      setImageUrl("");
      return;
    }

    releaseAbortRef.current?.abort();
    setReleaseUpload(initialUploadState);
    setDownloadUrl("");
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setImageUpload({
        ...initialUploadState,
        fileName: file.name,
        totalBytes: file.size,
        error: "Ungültiger Bildtyp. Erlaubt: JPG, PNG, WEBP, GIF.",
      });
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      setImageUpload({
        ...initialUploadState,
        fileName: file.name,
        totalBytes: file.size,
        error: "Bild ist zu groß. Maximal 20 MB.",
      });
      return;
    }

    imageAbortRef.current?.abort();
    const controller = new AbortController();
    imageAbortRef.current = controller;

    setImageUpload({
      ...initialUploadState,
      isUploading: true,
      fileName: file.name,
      totalBytes: file.size,
    });

    try {
      const result = await uploadFileToR2({
        file,
        folder: "releases",
        slug,
        kind: "image",
        signal: controller.signal,
        onProgress: (metrics) => applyMetrics(file.name, metrics, "image"),
      });

      setImageUrl(result.uploadedUrl);
      setImageUpload((prev) => ({
        ...prev,
        isUploading: false,
        progress: 100,
        uploadedUrl: result.uploadedUrl,
        error: null,
        uploadedBytes: prev.totalBytes || file.size,
        totalBytes: prev.totalBytes || file.size,
        remainingSeconds: 0,
      }));
    } catch (error) {
      setImageUpload((prev) => ({
        ...prev,
        isUploading: false,
        progress: 0,
        uploadedUrl: null,
        error:
          error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.",
      }));
    }
  }

  async function handleReleaseChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const detectedType = file.type || "application/octet-stream";

    if (
      !ALLOWED_RELEASE_TYPES.includes(
        detectedType as (typeof ALLOWED_RELEASE_TYPES)[number]
      )
    ) {
      setReleaseUpload({
        ...initialUploadState,
        fileName: file.name,
        totalBytes: file.size,
        error: "Ungültiger Dateityp. Erlaubt: ZIP, PDF, 7Z, RAR.",
      });
      return;
    }

    if (file.size > MAX_RELEASE_UPLOAD_SIZE) {
      setReleaseUpload({
        ...initialUploadState,
        fileName: file.name,
        totalBytes: file.size,
        error: "Datei ist zu groß. Maximal 30 GB.",
      });
      return;
    }

    releaseAbortRef.current?.abort();
    const controller = new AbortController();
    releaseAbortRef.current = controller;

    setReleaseUpload({
      ...initialUploadState,
      isUploading: true,
      fileName: file.name,
      totalBytes: file.size,
    });

    try {
      const result = await uploadFileToR2({
        file,
        folder: "releases",
        slug,
        kind: "release",
        signal: controller.signal,
        onProgress: (metrics) => applyMetrics(file.name, metrics, "release"),
      });

      setDownloadUrl(result.uploadedUrl);
      setReleaseUpload((prev) => ({
        ...prev,
        isUploading: false,
        progress: 100,
        uploadedUrl: result.uploadedUrl,
        error: null,
        uploadedBytes: prev.totalBytes || file.size,
        totalBytes: prev.totalBytes || file.size,
        remainingSeconds: 0,
      }));
    } catch (error) {
      setReleaseUpload((prev) => ({
        ...prev,
        isUploading: false,
        progress: 0,
        uploadedUrl: null,
        error:
          error instanceof Error ? error.message : "Datei konnte nicht hochgeladen werden.",
      }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!title.trim()) {
      setSubmitError("Titel fehlt.");
      return;
    }

    if (!version.trim()) {
      setSubmitError("Version fehlt.");
      return;
    }

    if (!downloadUrl.trim()) {
      setSubmitError("Bitte lade zuerst eine Release-Datei hoch.");
      return;
    }

    if (imageUpload.isUploading || releaseUpload.isUploading) {
      setSubmitError("Warte bitte, bis alle Uploads abgeschlossen sind.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/releases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          slug,
          version: version.trim(),
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
          downloadUrl: downloadUrl.trim(),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        release?: { slug?: string | null; id: string };
      };

      if (!response.ok || !data.ok || !data.release) {
        throw new Error(data.error || "Release konnte nicht erstellt werden.");
      }

      router.push(`/releases/${data.release.slug || data.release.id}`);
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Release konnte nicht gespeichert werden."
      );
      setSubmitting(false);
    }
  }

  function renderStats(upload: UploadState, accent: "violet" | "cyan") {
    if (!upload.fileName) return null;

    const barClass = accent === "violet" ? "bg-violet-400" : "bg-cyan-400";

    return (
      <div className="rounded-2xl bg-white/5 px-4 py-3 text-white/80">
        <div className="font-medium">{upload.fileName}</div>

        {(upload.isUploading || upload.progress > 0 || upload.uploadedUrl) && (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${barClass}`}
                style={{ width: `${upload.progress}%` }}
              />
            </div>

            <div className="mt-2 grid gap-1 text-xs text-white/60 sm:grid-cols-2">
              <div>{upload.progress}% hochgeladen</div>
              <div>
                {formatBytes(upload.uploadedBytes)} / {formatBytes(upload.totalBytes)}
              </div>
              <div>Speed: {formatSpeed(upload.speedBytesPerSecond)}</div>
              <div>Restzeit: {formatRemainingTime(upload.remainingSeconds)}</div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur"
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Neue Release erstellen</h1>
        <p className="text-sm text-white/70">
          Lade Cover und Release-Datei direkt nach Cloudflare R2 hoch.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-white">Titel</span>
          <input
            name="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="z. B. ArcadiaX Pack"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-violet-400"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-white">Version</span>
          <input
            name="version"
            type="text"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="z. B. v1.0.0"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-violet-400"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white">Beschreibung</span>
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Beschreibung der Release ..."
          rows={5}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-violet-400"
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/20 p-3 text-violet-300">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Cover / Bild</h2>
              <p className="text-sm text-white/60">JPG, PNG, WEBP, GIF bis 20 MB</p>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center transition hover:border-violet-400/50 hover:bg-white/10">
            <input
              name="image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <Upload className="mb-3 h-6 w-6 text-white/70" />
            <span className="text-sm font-medium text-white">Bild auswählen</span>
          </label>

          <div className="mt-4 space-y-3 text-sm">
            {renderStats(imageUpload, "violet")}

            {imageUpload.uploadedUrl && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-200">
                Bild erfolgreich hochgeladen.
              </div>
            )}

            {imageUpload.error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                {imageUpload.error}
              </div>
            )}

            {(imageUpload.isUploading || imageUpload.uploadedUrl) && (
              <button
                type="button"
                onClick={() => resetUpload("image")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-white/80 transition hover:bg-white/10"
              >
                <XCircle className="h-4 w-4" />
                Bild zurücksetzen
              </button>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/20 p-3 text-cyan-300">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Release-Datei</h2>
              <p className="text-sm text-white/60">ZIP, PDF, 7Z, RAR bis 30 GB</p>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center transition hover:border-cyan-400/50 hover:bg-white/10">
            <input
              name="releaseFile"
              type="file"
              accept=".zip,.pdf,.7z,.rar,application/zip,application/pdf,application/x-7z-compressed,application/vnd.rar,application/octet-stream"
              className="hidden"
              onChange={handleReleaseChange}
            />
            <Upload className="mb-3 h-6 w-6 text-white/70" />
            <span className="text-sm font-medium text-white">Release-Datei auswählen</span>
          </label>

          <div className="mt-4 space-y-3 text-sm">
            {renderStats(releaseUpload, "cyan")}

            {releaseUpload.uploadedUrl && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-200">
                Datei erfolgreich hochgeladen.
              </div>
            )}

            {releaseUpload.error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                {releaseUpload.error}
              </div>
            )}

            {(releaseUpload.fileName ||
              releaseUpload.uploadedUrl ||
              releaseUpload.isUploading) && (
              <button
                type="button"
                onClick={() => resetUpload("release")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-white/80 transition hover:bg-white/10"
              >
                <XCircle className="h-4 w-4" />
                Datei zurücksetzen
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-white">Bild-URL</span>
          <input
            name="imageUrl"
            type="url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="Wird automatisch gesetzt"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-violet-400"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-white">Download-URL</span>
          <input
            name="downloadUrl"
            type="url"
            value={downloadUrl}
            onChange={(event) => setDownloadUrl(event.target.value)}
            placeholder="Wird automatisch gesetzt"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-violet-400"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
        <div>
          <span className="font-medium text-white">Slug:</span> {slug}
        </div>
        {releaseUpload.fileName && (
          <div>
            <span className="font-medium text-white">Datei:</span> {releaseUpload.fileName}
          </div>
        )}
      </div>

      {submitError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || imageUpload.isUploading || releaseUpload.isUploading}
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Release erstellen
        </button>

        <Link
          href="/dashboard/releases"
          className="rounded-2xl border border-white/10 px-5 py-3 text-white/80 transition hover:bg-white/10"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}