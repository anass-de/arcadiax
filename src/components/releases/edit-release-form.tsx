"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ImageIcon, Save, Upload } from "lucide-react";

import { uploadFileMultipart } from "@/lib/upload-file-multipart";

type ReleaseFormData = {
  id: string;
  title: string;
  slug: string | null;
  version: string;
  description: string | null;
  changelog: string | null;
  fileUrl: string | null;
  imageUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
};

type Props = {
  release: ReleaseFormData;
};

type UploadKind = "image" | "release";

type UploadState = {
  isUploading: boolean;
  progress: number;
  fileName: string | null;
  uploadedUrl: string | null;
  error: string | null;
};

type PresignResponse = {
  uploadUrl?: string;
  publicUrl?: string;
  key?: string;
  error?: string;
};

const initialUploadState: UploadState = {
  isUploading: false,
  progress: 0,
  fileName: null,
  uploadedUrl: null,
  error: null,
};

const MAX_SIMPLE_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_RELEASE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_RELEASE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "application/pdf",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
];

const PRESIGN_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
const MAX_UPLOAD_RETRIES = 3;
const RETRY_DELAY_MS = 1_500;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getReleaseMimeType(file: File) {
  const rawType = file.type?.trim();
  if (rawType) return rawType;

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".zip")) {
    return "application/zip";
  }

  if (lowerName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerName.endsWith(".7z")) {
    return "application/x-7z-compressed";
  }

  if (lowerName.endsWith(".rar")) {
    return "application/x-rar-compressed";
  }

  return "application/octet-stream";
}

function validateFile(file: File, kind: UploadKind) {
  const fileType =
    kind === "release" ? getReleaseMimeType(file) : file.type?.trim() || "";

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "Ungültige Datei.";
  }

  if (kind === "image") {
    if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
      return "Nur JPG, PNG, WEBP oder GIF sind als Bild erlaubt.";
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      return `Das Bild ist zu groß. Maximal ${formatBytes(
        MAX_IMAGE_UPLOAD_SIZE
      )} sind erlaubt.`;
    }

    return null;
  }

  if (!ALLOWED_RELEASE_TYPES.includes(fileType)) {
    return "Nur ZIP, PDF, 7Z oder RAR sind als Release-Datei erlaubt.";
  }

  if (file.size > MAX_RELEASE_UPLOAD_SIZE) {
    return `Die Datei ist zu groß. Maximal ${formatBytes(
      MAX_RELEASE_UPLOAD_SIZE
    )} sind erlaubt.`;
  }

  return null;
}

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Zeitüberschreitung beim Vorbereiten des Uploads.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function uploadViaXhrWithTimeout(args: {
  uploadUrl: string;
  file: File;
  fileType: string;
  timeoutMs: number;
  onProgress: (progress: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", args.uploadUrl, true);
    xhr.timeout = args.timeoutMs;
    xhr.setRequestHeader("Content-Type", args.fileType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      args.onProgress(progress);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        args.onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            `Upload fehlgeschlagen (${xhr.status}). Bitte versuche es erneut.`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Netzwerkfehler beim Upload."));
    };

    xhr.onabort = () => {
      reject(new Error("Upload wurde abgebrochen."));
    };

    xhr.ontimeout = () => {
      reject(
        new Error(
          "Der Upload hat zu lange gedauert und wurde wegen Zeitüberschreitung beendet."
        )
      );
    };

    xhr.send(args.file);
  });
}

async function uploadImageWithProgress(args: {
  file: File;
  slug: string;
  onProgress: (progress: number) => void;
}) {
  const fileType = args.file.type?.trim() || "application/octet-stream";

  const prepareResponse = await fetchJsonWithTimeout(
    "/api/admin/uploads/presign",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: args.file.name,
        fileType,
        folder: "media",
        slug: args.slug,
        fileSize: args.file.size,
      }),
    },
    PRESIGN_TIMEOUT_MS
  );

  const prepareData = (await prepareResponse.json().catch(() => null)) as
    | PresignResponse
    | null;

  if (!prepareResponse.ok || !prepareData?.uploadUrl || !prepareData.publicUrl) {
    throw new Error(
      prepareData?.error || "Bild-Upload konnte nicht vorbereitet werden."
    );
  }

  const uploadUrl = prepareData.uploadUrl;
  const publicUrl = prepareData.publicUrl;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt += 1) {
    const cappedProgressStart =
      MAX_UPLOAD_RETRIES > 1
        ? Math.min(
            90,
            Math.max(
              0,
              Math.round(((attempt - 1) / MAX_UPLOAD_RETRIES) * 100)
            )
          )
        : 0;

    args.onProgress(cappedProgressStart);

    try {
      await uploadViaXhrWithTimeout({
        uploadUrl,
        file: args.file,
        fileType,
        timeoutMs: UPLOAD_TIMEOUT_MS,
        onProgress(progress) {
          const normalizedProgress =
            MAX_UPLOAD_RETRIES > 1
              ? Math.min(
                  99,
                  Math.round(
                    ((attempt - 1 + progress / 100) / MAX_UPLOAD_RETRIES) * 100
                  )
                )
              : progress;

          args.onProgress(normalizedProgress);
        },
      });

      args.onProgress(100);
      return publicUrl;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Bild-Upload fehlgeschlagen. Bitte versuche es erneut.");

      if (attempt < MAX_UPLOAD_RETRIES) {
        await wait(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error("Bild-Upload fehlgeschlagen.");
}

function FileCard({
  fileName,
  fileSize,
}: {
  fileName: string;
  fileSize: number;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-300">
      <div className="font-medium text-white break-all">{fileName}</div>
      <div className="mt-1 text-zinc-500">{formatBytes(fileSize)}</div>
    </div>
  );
}

function ProgressBlock({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) {
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#6c5ce7] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function EditReleaseForm({ release }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(release.title);
  const [version, setVersion] = useState(release.version);
  const [slug, setSlug] = useState(release.slug ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(release.status);
  const [description, setDescription] = useState(release.description ?? "");
  const [changelog, setChangelog] = useState(release.changelog ?? "");

  const [currentFileUrl, setCurrentFileUrl] = useState<string | null>(
    release.fileUrl ?? null
  );
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(
    release.imageUrl ?? null
  );

  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [releaseUpload, setReleaseUpload] =
    useState<UploadState>(initialUploadState);
  const [imageUpload, setImageUpload] =
    useState<UploadState>(initialUploadState);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveSlug = useMemo(() => {
    const explicitSlug = slugify(slug);
    if (explicitSlug) return explicitSlug;

    const fromTitle = slugify(title);
    if (fromTitle) return fromTitle;

    return "release";
  }, [slug, title]);

  function handleReleaseFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      setReleaseFile(null);
      setReleaseUpload(initialUploadState);
      return;
    }

    const validationError = validateFile(file, "release");

    if (validationError) {
      setReleaseFile(null);
      setReleaseUpload({
        ...initialUploadState,
        fileName: file.name,
        error: validationError,
      });
      setFormError(null);
      return;
    }

    setReleaseFile(file);
    setReleaseUpload({
      ...initialUploadState,
      fileName: file.name,
      error: null,
    });
    setFormError(null);
  }

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      setImageFile(null);
      setImageUpload(initialUploadState);
      return;
    }

    const validationError = validateFile(file, "image");

    if (validationError) {
      setImageFile(null);
      setImageUpload({
        ...initialUploadState,
        fileName: file.name,
        error: validationError,
      });
      setFormError(null);
      return;
    }

    setImageFile(file);
    setImageUpload({
      ...initialUploadState,
      fileName: file.name,
      error: null,
    });
    setFormError(null);
  }

  async function ensureUploadedRelease(file: File | null) {
    if (!file) {
      return currentFileUrl;
    }

    setReleaseUpload({
      isUploading: true,
      progress: 0,
      fileName: file.name,
      uploadedUrl: null,
      error: null,
    });

    try {
      let uploadedUrl: string;

      if (file.size > MAX_SIMPLE_UPLOAD_SIZE) {
        const uploaded = await uploadFileMultipart({
          file,
          slug: effectiveSlug,
          kind: "release",
          onProgress(progress) {
            setReleaseUpload((prev) => ({
              ...prev,
              isUploading: true,
              progress,
              fileName: file.name,
              error: null,
            }));
          },
        });

        uploadedUrl = uploaded.publicUrl;
      } else {
        const fileType = getReleaseMimeType(file);

        const prepareResponse = await fetchJsonWithTimeout(
          "/api/admin/uploads/presign",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: file.name,
              fileType,
              folder: "releases",
              slug: effectiveSlug,
              fileSize: file.size,
            }),
          },
          PRESIGN_TIMEOUT_MS
        );

        const prepareData = (await prepareResponse.json().catch(() => null)) as
          | PresignResponse
          | null;

        if (
          !prepareResponse.ok ||
          !prepareData?.uploadUrl ||
          !prepareData.publicUrl
        ) {
          throw new Error(
            prepareData?.error || "Release-Upload konnte nicht vorbereitet werden."
          );
        }

        await uploadViaXhrWithTimeout({
          uploadUrl: prepareData.uploadUrl,
          file,
          fileType,
          timeoutMs: UPLOAD_TIMEOUT_MS,
          onProgress(progress) {
            setReleaseUpload((prev) => ({
              ...prev,
              isUploading: true,
              progress,
              fileName: file.name,
              error: null,
            }));
          },
        });

        uploadedUrl = prepareData.publicUrl;
      }

      setReleaseUpload({
        isUploading: false,
        progress: 100,
        fileName: file.name,
        uploadedUrl,
        error: null,
      });

      setCurrentFileUrl(uploadedUrl);
      return uploadedUrl;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Release-Upload fehlgeschlagen. Bitte versuche es erneut.";

      setReleaseUpload({
        isUploading: false,
        progress: 0,
        fileName: file.name,
        uploadedUrl: null,
        error: message,
      });

      throw new Error(message);
    }
  }

  async function ensureUploadedImage(file: File | null) {
    if (!file) {
      return currentImageUrl;
    }

    setImageUpload({
      isUploading: true,
      progress: 0,
      fileName: file.name,
      uploadedUrl: null,
      error: null,
    });

    try {
      const uploadedUrl = await uploadImageWithProgress({
        file,
        slug: effectiveSlug,
        onProgress(progress) {
          setImageUpload((prev) => ({
            ...prev,
            isUploading: true,
            progress,
            fileName: file.name,
            error: null,
          }));
        },
      });

      setImageUpload({
        isUploading: false,
        progress: 100,
        fileName: file.name,
        uploadedUrl,
        error: null,
      });

      setCurrentImageUrl(uploadedUrl);
      return uploadedUrl;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bild-Upload fehlgeschlagen. Bitte versuche es erneut.";

      setImageUpload({
        isUploading: false,
        progress: 0,
        fileName: file.name,
        uploadedUrl: null,
        error: message,
      });

      throw new Error(message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setFormError(null);

    const cleanTitle = title.trim();
    const cleanVersion = version.trim();

    if (!cleanTitle) {
      setFormError("Titel darf nicht leer sein.");
      return;
    }

    if (!cleanVersion) {
      setFormError("Version darf nicht leer sein.");
      return;
    }

    if (releaseFile) {
      const releaseValidationError = validateFile(releaseFile, "release");
      if (releaseValidationError) {
        setFormError(releaseValidationError);
        return;
      }
    }

    if (imageFile) {
      const imageValidationError = validateFile(imageFile, "image");
      if (imageValidationError) {
        setFormError(imageValidationError);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const uploadedFileUrl = await ensureUploadedRelease(releaseFile);
      const uploadedImageUrl = await ensureUploadedImage(imageFile);

      if (!uploadedFileUrl) {
        throw new Error("Es muss eine Release-Datei vorhanden sein.");
      }

      const response = await fetch(`/api/admin/releases/${release.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: cleanTitle,
          version: cleanVersion,
          slug: effectiveSlug,
          description: description.trim() || null,
          changelog: changelog.trim() || null,
          status,
          fileUrl: uploadedFileUrl,
          imageUrl: uploadedImageUrl,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error || "Änderungen konnten nicht gespeichert werden."
        );
      }

      router.push(
        `/dashboard/releases/${release.id}/edit?success=${encodeURIComponent(
          "Änderungen wurden erfolgreich gespeichert."
        )}`
      );
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Beim Speichern ist ein Fehler aufgetreten."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const releaseBusy = releaseUpload.isUploading;
  const imageBusy = imageUpload.isUploading;
  const anyBusy = isSubmitting || releaseBusy || imageBusy;

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="title"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Titel
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            placeholder="z. B. ArcadiaX"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#6c5ce7]/40 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="version"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Version
          </label>
          <input
            id="version"
            name="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            required
            placeholder="z. B. 1.0.0"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#6c5ce7]/40 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="slug"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="z. B. arcadiax"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#6c5ce7]/40 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Optional. Wird für die öffentliche URL verwendet.
          </p>
          <p className="mt-1 text-xs text-[#8f84ff]">
            Aktueller Slug: <span className="font-medium">{effectiveSlug}</span>
          </p>
        </div>

        <div>
          <label
            htmlFor="status"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "DRAFT" | "PUBLISHED")
            }
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#6c5ce7]/40 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Beschreibung
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={7}
          placeholder="Beschreibe das Release, Funktionen, Änderungen oder wichtige Hinweise..."
          disabled={anyBusy}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#6c5ce7]/40 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label
          htmlFor="changelog"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Changelog
        </label>
        <textarea
          id="changelog"
          name="changelog"
          value={changelog}
          onChange={(event) => setChangelog(event.target.value)}
          rows={6}
          placeholder="Was hat sich geändert?"
          disabled={anyBusy}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#6c5ce7]/40 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="imageFile"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300"
          >
            <ImageIcon className="h-4 w-4 text-[#8f84ff]" />
            Neues Bild hochladen
          </label>
          <input
            id="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageFileChange}
            disabled={anyBusy}
            className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#6c5ce7]/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Optional. Wenn du keine Datei auswählst, bleibt das aktuelle Bild erhalten.
          </p>

          {imageFile ? <FileCard fileName={imageFile.name} fileSize={imageFile.size} /> : null}

          {imageUpload.isUploading ? (
            <ProgressBlock label="Bild-Upload läuft..." progress={imageUpload.progress} />
          ) : null}

          {imageUpload.uploadedUrl ? (
            <p className="mt-2 text-xs text-emerald-300">
              Bild erfolgreich hochgeladen.
            </p>
          ) : null}

          {imageUpload.error ? (
            <p className="mt-2 text-xs text-red-300">{imageUpload.error}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="releaseFile"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300"
          >
            <Upload className="h-4 w-4 text-[#8f84ff]" />
            Neue Release-Datei hochladen
          </label>
          <input
            id="releaseFile"
            type="file"
            accept=".zip,.pdf,.7z,.rar,application/zip,application/x-zip-compressed,application/x-zip,application/pdf,application/x-7z-compressed,application/x-rar-compressed,application/octet-stream"
            onChange={handleReleaseFileChange}
            disabled={anyBusy}
            className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#6c5ce7]/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Optional. Wenn du keine Datei auswählst, bleibt die aktuelle Release-Datei erhalten.
          </p>

          {releaseFile ? (
            <FileCard fileName={releaseFile.name} fileSize={releaseFile.size} />
          ) : null}

          {releaseUpload.isUploading ? (
            <ProgressBlock
              label={
                releaseFile && releaseFile.size > MAX_SIMPLE_UPLOAD_SIZE
                  ? "Multipart-Upload läuft..."
                  : "Datei-Upload läuft..."
              }
              progress={releaseUpload.progress}
            />
          ) : null}

          {releaseUpload.uploadedUrl ? (
            <p className="mt-2 text-xs text-emerald-300">
              Release-Datei erfolgreich hochgeladen.
            </p>
          ) : null}

          {releaseUpload.error ? (
            <p className="mt-2 text-xs text-red-300">{releaseUpload.error}</p>
          ) : null}
        </div>
      </div>

      {formError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {formError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={anyBusy}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          <span>{isSubmitting ? "Speichern..." : "Änderungen speichern"}</span>
        </button>

        <Link
          href="/dashboard/releases"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Abbrechen</span>
        </Link>
      </div>
    </form>
  );
}