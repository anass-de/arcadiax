"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImageIcon, Loader2, Plus, Upload, XCircle } from "lucide-react";

type ReleaseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type UploadKind = "image" | "release";

type StartMultipartResponse = {
  uploadId: string;
  key: string;
  publicUrl: string;
  partSize: number;
};

type PresignPartResponse = {
  uploadUrl: string;
  partNumber: number;
};

type CompleteMultipartResponse = {
  key: string;
  publicUrl: string;
  location?: string | null;
  etag?: string | null;
};

type DirectUploadResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

type UploadedPart = {
  PartNumber: number;
  ETag: string;
};

type UploadState = {
  isUploading: boolean;
  progress: number;
  fileName: string | null;
  uploadedUrl: string | null;
  error: string | null;
};

const initialUploadState: UploadState = {
  isUploading: false,
  progress: 0,
  fileName: null,
  uploadedUrl: null,
  error: null,
};

const MAX_IMAGE_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_RELEASE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB

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
  "application/x-rar-compressed",
] as const;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function validateFile(kind: UploadKind, file: File) {
  if (kind === "image") {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return "Ungültiger Bildtyp. Erlaubt sind JPG, PNG, WEBP und GIF.";
    }
    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      return "Bild ist zu groß. Maximal 20 MB erlaubt.";
    }
    return null;
  }

  if (!ALLOWED_RELEASE_TYPES.includes(file.type as (typeof ALLOWED_RELEASE_TYPES)[number])) {
    return `Ungültiger Release-Dateityp: ${file.type || "unbekannt"}`;
  }

  if (file.size > MAX_RELEASE_UPLOAD_SIZE) {
    return "Release-Datei ist zu groß. Maximal 30 GB erlaubt.";
  }

  return null;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Unbekannter Fehler.";

    throw new Error(error);
  }

  return data as T;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 60_000
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function uploadPartWithRetry(params: {
  uploadUrl: string;
  chunk: Blob;
  retries?: number;
  timeoutMs?: number;
}) {
  const retries = params.retries ?? 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        params.uploadUrl,
        {
          method: "PUT",
          body: params.chunk,
        },
        params.timeoutMs ?? 120_000
      );

      if (!response.ok) {
        throw new Error(`Part-Upload fehlgeschlagen (${response.status}).`);
      }

      const etag = response.headers.get("ETag");
      if (!etag) {
        throw new Error(
          "ETag fehlt im Upload-Response. Prüfe R2-CORS (ExposeHeaders: ETag)."
        );
      }

      return etag;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Part-Upload endgültig fehlgeschlagen.");
}

type NewReleaseFormProps = {
  createAction?: (formData: FormData) => Promise<void>;
};

export default function NewReleaseForm({ createAction }: NewReleaseFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [status, setStatus] = useState<ReleaseStatus>("PUBLISHED");
  const [description, setDescription] = useState("");
  const [changelog, setChangelog] = useState("");

  const [imageUpload, setImageUpload] = useState<UploadState>(initialUploadState);
  const [releaseUpload, setReleaseUpload] = useState<UploadState>(initialUploadState);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [releaseFile, setReleaseFile] = useState<File | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const releaseInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSlug = useMemo(() => slugify(slug || title), [slug, title]);

  useEffect(() => {
    if (!title && slug) {
      setSlug("");
    }
  }, [title, slug]);

  async function uploadImageDirect(file: File, currentSlug: string) {
    const presign = await fetchJson<DirectUploadResponse>("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        folder: "media",
        slug: currentSlug,
      }),
    });

    const uploadResponse = await fetchWithTimeout(
      presign.uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      },
      120_000
    );

    if (!uploadResponse.ok) {
      throw new Error(`Bild-Upload fehlgeschlagen (${uploadResponse.status}).`);
    }

    return presign.publicUrl;
  }

  async function uploadReleaseMultipart(
    file: File,
    currentSlug: string,
    onProgress: (progress: number) => void
  ) {
    const started = await fetchJson<StartMultipartResponse>("/api/upload/multipart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        folder: "releases",
        slug: currentSlug,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        kind: "release",
      }),
    });

    const partSize = Math.max(started.partSize || 10 * 1024 * 1024, 5 * 1024 * 1024);
    const partCount = Math.ceil(file.size / partSize);
    const uploadedParts: UploadedPart[] = [];
    let uploadedBytes = 0;

    try {
      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        const presignedPart = await fetchJson<PresignPartResponse>(
          "/api/upload/multipart/part",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              key: started.key,
              uploadId: started.uploadId,
              partNumber,
            }),
          }
        );

        const etag = await uploadPartWithRetry({
          uploadUrl: presignedPart.uploadUrl,
          chunk,
          retries: 3,
          timeoutMs: 120_000,
        });

        uploadedParts.push({
          PartNumber: partNumber,
          ETag: etag,
        });

        uploadedBytes += chunk.size;
        onProgress(Math.min(100, Math.round((uploadedBytes / file.size) * 100)));
      }

      const completed = await fetchJson<CompleteMultipartResponse>(
        "/api/upload/multipart/complete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: started.key,
            uploadId: started.uploadId,
            parts: uploadedParts,
          }),
        }
      );

      return completed.publicUrl;
    } catch (error) {
      try {
        await fetch("/api/upload/multipart/abort", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: started.key,
            uploadId: started.uploadId,
          }),
        });
      } catch {
        // ignore abort failure
      }

      throw error;
    }
  }

  async function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageUpload(initialUploadState);
    setImageFile(null);

    if (!file) return;

    const error = validateFile("image", file);
    if (error) {
      setImageUpload({
        isUploading: false,
        progress: 0,
        fileName: file.name,
        uploadedUrl: null,
        error,
      });
      return;
    }

    setImageFile(file);
    setImageUpload({
      isUploading: false,
      progress: 0,
      fileName: file.name,
      uploadedUrl: null,
      error: null,
    });
  }

  async function handleReleaseSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setReleaseUpload(initialUploadState);
    setReleaseFile(null);

    if (!file) return;

    const error = validateFile("release", file);
    if (error) {
      setReleaseUpload({
        isUploading: false,
        progress: 0,
        fileName: file.name,
        uploadedUrl: null,
        error,
      });
      return;
    }

    setReleaseFile(file);
    setReleaseUpload({
      isUploading: false,
      progress: 0,
      fileName: file.name,
      uploadedUrl: null,
      error: null,
    });
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

    if (!releaseFile) {
      setSubmitError("Bitte eine Release-Datei auswählen.");
      return;
    }

    const currentSlug = effectiveSlug || "general";

    setIsSubmitting(true);

    try {
      let imageUrl: string | null = imageUpload.uploadedUrl;
      let releaseUrl: string | null = releaseUpload.uploadedUrl;

      if (imageFile && !imageUrl) {
        setImageUpload((prev) => ({
          ...prev,
          isUploading: true,
          progress: 10,
          error: null,
        }));

        imageUrl = await uploadImageDirect(imageFile, currentSlug);

        setImageUpload((prev) => ({
          ...prev,
          isUploading: false,
          progress: 100,
          uploadedUrl: imageUrl,
          error: null,
        }));
      }

      if (!releaseUrl) {
        setReleaseUpload((prev) => ({
          ...prev,
          isUploading: true,
          progress: 1,
          error: null,
        }));

        releaseUrl = await uploadReleaseMultipart(releaseFile, currentSlug, (progress) => {
          setReleaseUpload((prev) => ({
            ...prev,
            isUploading: true,
            progress,
            error: null,
          }));
        });

        setReleaseUpload((prev) => ({
          ...prev,
          isUploading: false,
          progress: 100,
          uploadedUrl: releaseUrl,
          error: null,
        }));
      }

      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("slug", currentSlug);
      formData.set("version", version.trim());
      formData.set("status", status);
      formData.set("description", description.trim());
      formData.set("changelog", changelog.trim());
      formData.set("fileUrl", releaseUrl);
      formData.set("imageUrl", imageUrl ?? "");

      if (createAction) {
        await createAction(formData);
      } else {
        const response = await fetch("/api/admin/releases", {
          method: "POST",
          body: formData,
        });

        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          const message =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Release konnte nicht erstellt werden.";

          throw new Error(message);
        }
      }

      router.push("/dashboard/releases");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload oder Speichern fehlgeschlagen.";

      setImageUpload((prev) => ({
        ...prev,
        isUploading: false,
        error: prev.error ?? null,
      }));
      setReleaseUpload((prev) => ({
        ...prev,
        isUploading: false,
        error: prev.error ?? null,
      }));
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetImage() {
    setImageFile(null);
    setImageUpload(initialUploadState);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function resetRelease() {
    setReleaseFile(null);
    setReleaseUpload(initialUploadState);
    if (releaseInputRef.current) {
      releaseInputRef.current.value = "";
    }
  }

  const isBusy =
    isSubmitting || imageUpload.isUploading || releaseUpload.isUploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <Plus className="h-3.5 w-3.5" />
              Release Verwaltung
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Neues Release erstellen
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Erstelle ein neues Release und lade direkt die Release-Datei sowie optional ein Vorschaubild hoch.
            </p>
          </div>

          <Link
            href="/dashboard/releases"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Zurück zur Übersicht
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">
                Titel
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. ArcadiaX"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/85">
                  Slug
                </label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="optional"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
                />
                <p className="mt-2 text-xs text-white/45">
                  Aktueller Slug: <span className="text-violet-300">{effectiveSlug}</span>
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/85">
                  Version
                </label>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-violet-400/50"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">
                Beschreibung
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Kurze Beschreibung des Releases"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">
                Changelog
              </label>
              <textarea
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                rows={6}
                placeholder="Was ist neu?"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-2 text-cyan-300">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Vorschaubild hochladen</h2>
              <p className="text-sm text-white/50">
                Optional. JPG, PNG, WEBP, GIF. Maximal 20 MB.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500">
                <Upload className="h-4 w-4" />
                Datei auswählen
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>

              {imageFile ? (
                <button
                  type="button"
                  onClick={resetImage}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <XCircle className="h-4 w-4" />
                  Entfernen
                </button>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-white/85">
                {imageFile ? imageFile.name : "Keine Datei ausgewählt"}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {imageFile ? formatBytes(imageFile.size) : "Optionaler Upload"}
              </p>

              {imageUpload.error ? (
                <p className="mt-3 text-sm text-rose-400">{imageUpload.error}</p>
              ) : null}

              {imageUpload.uploadedUrl ? (
                <p className="mt-3 text-sm text-emerald-400 break-all">
                  Upload erfolgreich: {imageUpload.uploadedUrl}
                </p>
              ) : null}

              {imageUpload.isUploading ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                    <span>Upload läuft...</span>
                    <span>{imageUpload.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all"
                      style={{ width: `${imageUpload.progress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-violet-400/15 bg-violet-400/10 p-2 text-violet-300">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Release-Datei hochladen</h2>
              <p className="text-sm text-white/50">
                Pflichtfeld. ZIP, PDF, 7Z oder RAR. Große Dateien per Multipart.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500">
                <Upload className="h-4 w-4" />
                Datei auswählen
                <input
                  ref={releaseInputRef}
                  type="file"
                  accept=".zip,.pdf,.7z,.rar"
                  className="hidden"
                  onChange={handleReleaseSelect}
                />
              </label>

              {releaseFile ? (
                <button
                  type="button"
                  onClick={resetRelease}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <XCircle className="h-4 w-4" />
                  Entfernen
                </button>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-white/85">
                {releaseFile ? releaseFile.name : "Keine Datei ausgewählt"}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {releaseFile ? formatBytes(releaseFile.size) : "Pflicht-Upload"}
              </p>

              {releaseUpload.error ? (
                <p className="mt-3 text-sm text-rose-400">{releaseUpload.error}</p>
              ) : null}

              {releaseUpload.uploadedUrl ? (
                <p className="mt-3 break-all text-sm text-emerald-400">
                  Upload erfolgreich: {releaseUpload.uploadedUrl}
                </p>
              ) : null}

              {(releaseUpload.isUploading || releaseUpload.progress > 0) && !releaseUpload.error ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                    <span>Multipart-Upload läuft...</span>
                    <span>{releaseUpload.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${releaseUpload.progress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">Hinweise</h2>
        <div className="mt-4 grid gap-3 text-sm text-white/60 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            Bild wird direkt als einzelner Upload gespeichert.
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            Release-Dateien werden robust per Multipart zu R2 hochgeladen.
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            Bei Fehlern wird der Multipart-Upload automatisch abgebrochen.
          </div>
        </div>

        {submitError ? (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            {submitError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Release wird erstellt...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Release erstellen
              </>
            )}
          </button>

          <Link
            href="/dashboard/releases"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Abbrechen
          </Link>
        </div>
      </section>
    </form>
  );
}