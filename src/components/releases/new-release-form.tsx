"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileArchive,
  ImageIcon,
  Loader2,
  PackagePlus,
  UploadCloud,
  X,
} from "lucide-react";

type ReleaseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type UploadKind = "image" | "release";

type UploadState = {
  isUploading: boolean;
  progress: number;
  fileName: string | null;
  uploadedUrl: string | null;
  error: string | null;
};

type DirectUploadResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

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

type UploadedPart = {
  PartNumber: number;
  ETag: string;
};

const IMAGE_UPLOAD_API = "/api/uploads";
const MULTIPART_START_API = "/api/uploads/multipart/start";
const MULTIPART_PART_API = "/api/uploads/multipart/part-url";
const MULTIPART_COMPLETE_API = "/api/uploads/multipart/complete";
const MULTIPART_ABORT_API = "/api/uploads/multipart/abort";
const CREATE_RELEASE_API = "/api/admin/releases";

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

const initialUploadState: UploadState = {
  isUploading: false,
  progress: 0,
  fileName: null,
  uploadedUrl: null,
  error: null,
};

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "general"
  );
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
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
      )
    ) {
      return "Ungültiger Bildtyp. Erlaubt sind JPG, PNG, WEBP und GIF.";
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      return "Bild ist zu groß. Maximal 20 MB erlaubt.";
    }

    return null;
  }

  if (
    !ALLOWED_RELEASE_TYPES.includes(
      file.type as (typeof ALLOWED_RELEASE_TYPES)[number]
    )
  ) {
    return `Ungültiger Release-Dateityp: ${file.type || "unbekannt"}`;
  }

  if (file.size > MAX_RELEASE_UPLOAD_SIZE) {
    return "Release-Datei ist zu groß. Maximal 30 GB erlaubt.";
  }

  return null;
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
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
        : `Request fehlgeschlagen (${response.status}).`;

    throw new Error(error);
  }

  return data as T;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 120_000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
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

function fieldClass() {
  return "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-violet-400/50 focus:bg-white/[0.05]";
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-white/80">{children}</label>;
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-[11px] text-white/45">
        <span>Upload läuft</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function UploadCard(props: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accent: string;
  accept: string;
  file: File | null;
  state: UploadState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}) {
  const {
    title,
    subtitle,
    icon,
    accent,
    accept,
    file,
    state,
    inputRef,
    onChange,
    onReset,
  } = props;

  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-[0.06]`}
      />

      <div className="relative">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-white/85">
            {icon}
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-white/50">{subtitle}</p>
          </div>
        </div>

        <div className="rounded-[22px] border border-dashed border-white/12 bg-black/20 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500">
              <UploadCloud className="h-4 w-4" />
              Datei auswählen
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={onChange}
              />
            </label>

            {file ? (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
                Entfernen
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/85">
                  {file ? file.name : "Keine Datei ausgewählt"}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {file ? formatBytes(file.size) : "Noch kein Upload"}
                </p>
              </div>

              {state.uploadedUrl ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              ) : null}
            </div>

            {state.error ? (
              <p className="mt-3 text-sm text-rose-400">{state.error}</p>
            ) : null}

            {state.uploadedUrl ? (
              <p className="mt-3 break-all text-xs text-emerald-400/90">
                {state.uploadedUrl}
              </p>
            ) : null}

            {(state.isUploading || state.progress > 0) && !state.error ? (
              <ProgressBar progress={state.progress} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewReleaseForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [status, setStatus] = useState<ReleaseStatus>("PUBLISHED");
  const [description, setDescription] = useState("");
  const [changelog, setChangelog] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [releaseFile, setReleaseFile] = useState<File | null>(null);

  const [imageUpload, setImageUpload] = useState<UploadState>(initialUploadState);
  const [releaseUpload, setReleaseUpload] =
    useState<UploadState>(initialUploadState);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const releaseInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSlug = useMemo(() => slugify(slug || title), [slug, title]);
  const isBusy =
    isSubmitting || imageUpload.isUploading || releaseUpload.isUploading;

  async function uploadImageDirect(file: File, currentSlug: string) {
    const presign = await fetchJson<DirectUploadResponse>(IMAGE_UPLOAD_API, {
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

    setImageUpload((prev) => ({
      ...prev,
      isUploading: true,
      progress: 35,
      error: null,
    }));

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
    const started = await fetchJson<StartMultipartResponse>(
      MULTIPART_START_API,
      {
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
      }
    );

    const partSize = Math.max(
      started.partSize || 10 * 1024 * 1024,
      5 * 1024 * 1024
    );
    const partCount = Math.ceil(file.size / partSize);
    const uploadedParts: UploadedPart[] = [];
    let uploadedBytes = 0;

    try {
      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        const presignedPart = await fetchJson<PresignPartResponse>(
          MULTIPART_PART_API,
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
        MULTIPART_COMPLETE_API,
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
        await fetch(MULTIPART_ABORT_API, {
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

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setImageFile(null);
    setImageUpload(initialUploadState);

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

  function handleReleaseSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setReleaseFile(null);
    setReleaseUpload(initialUploadState);

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
        const url = await uploadImageDirect(imageFile, currentSlug);
        imageUrl = url;

        setImageUpload((prev) => ({
          ...prev,
          isUploading: false,
          progress: 100,
          uploadedUrl: url,
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

        const url = await uploadReleaseMultipart(
          releaseFile,
          currentSlug,
          (progress) => {
            setReleaseUpload((prev) => ({
              ...prev,
              isUploading: true,
              progress,
              error: null,
            }));
          }
        );

        releaseUrl = url;

        setReleaseUpload((prev) => ({
          ...prev,
          isUploading: false,
          progress: 100,
          uploadedUrl: url,
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

      const response = await fetch(CREATE_RELEASE_API, {
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

      router.push("/dashboard/releases");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Upload oder Speichern fehlgeschlagen.";

      setSubmitError(message);
      setImageUpload((prev) => ({ ...prev, isUploading: false }));
      setReleaseUpload((prev) => ({ ...prev, isUploading: false }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_30%),rgba(7,7,10,0.92)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              <PackagePlus className="h-3.5 w-3.5" />
              Release Verwaltung
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Neues Release erstellen
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/58 md:text-[15px]">
              Lade deine Release-Datei robust per Multipart hoch, ergänze eine
              Vorschau und veröffentliche alles in einer sauberen Admin-Oberfläche.
            </p>
          </div>

          <Link
            href="/dashboard/releases"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <SectionLabel>Titel</SectionLabel>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. ArcadiaX"
                  className={fieldClass()}
                />
              </div>

              <div>
                <SectionLabel>Slug</SectionLabel>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="optional"
                  className={fieldClass()}
                />
                <p className="mt-2 text-xs text-white/35">
                  Aktueller Slug:{" "}
                  <span className="text-violet-300">{effectiveSlug}</span>
                </p>
              </div>

              <div>
                <SectionLabel>Version</SectionLabel>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className={fieldClass()}
                />
              </div>

              <div>
                <SectionLabel>Status</SectionLabel>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
                  className={fieldClass()}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
            <div className="space-y-5">
              <div>
                <SectionLabel>Beschreibung</SectionLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Kurze Beschreibung des Releases"
                  className={`${fieldClass()} resize-none`}
                />
              </div>

              <div>
                <SectionLabel>Changelog</SectionLabel>
                <textarea
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  rows={5}
                  placeholder="Was ist neu?"
                  className={`${fieldClass()} resize-none`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <UploadCard
          title="Vorschaubild"
          subtitle="Optional · JPG, PNG, WEBP, GIF · max. 20 MB"
          icon={<ImageIcon className="h-5 w-5" />}
          accent="from-cyan-400 via-sky-500 to-transparent"
          accept=".jpg,.jpeg,.png,.webp,.gif"
          file={imageFile}
          state={imageUpload}
          inputRef={imageInputRef}
          onChange={handleImageSelect}
          onReset={resetImage}
        />

        <UploadCard
          title="Release-Datei"
          subtitle="Pflichtfeld · ZIP, PDF, 7Z, RAR · große Dateien via Multipart"
          icon={<FileArchive className="h-5 w-5" />}
          accent="from-violet-500 via-fuchsia-500 to-transparent"
          accept=".zip,.pdf,.7z,.rar"
          file={releaseFile}
          state={releaseUpload}
          inputRef={releaseInputRef}
          onChange={handleReleaseSelect}
          onReset={resetRelease}
        />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-black/30 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
            Bild wird separat direkt hochgeladen.
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
            Release-Dateien laufen stabil über Multipart.
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
            Bei Fehler wird der Upload automatisch abgebrochen.
          </div>
        </div>

        {submitError ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {submitError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Release wird erstellt...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4" />
                Release erstellen
              </>
            )}
          </button>

          <Link
            href="/dashboard/releases"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            Abbrechen
          </Link>
        </div>
      </section>
    </form>
  );
}