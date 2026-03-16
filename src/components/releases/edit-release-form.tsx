"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { ArrowLeft, ImageIcon, Save, Upload } from "lucide-react";

type ReleaseFormData = {
  id: string;
  title: string;
  slug: string | null;
  version: string;
  description: string | null;
  changelog: string | null;
  fileUrl: string;
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

const initialUploadState: UploadState = {
  isUploading: false,
  progress: 0,
  fileName: null,
  uploadedUrl: null,
  error: null,
};

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

async function uploadFileWithProgress(args: {
  file: File;
  slug: string;
  title: string;
  kind: UploadKind;
  onProgress: (progress: number) => void;
}) {
  const prepareResponse = await fetch("/api/admin/uploads/r2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: args.file.name,
      contentType: args.file.type,
      size: args.file.size,
      slug: args.slug,
      title: args.title,
      kind: args.kind,
    }),
  });

  const prepareData = (await prepareResponse.json().catch(() => null)) as
    | {
        error?: string;
        uploadUrl?: string;
        publicUrl?: string;
        headers?: Record<string, string>;
      }
    | null;

  if (!prepareResponse.ok || !prepareData?.uploadUrl || !prepareData.publicUrl) {
    throw new Error(
      prepareData?.error || "Upload konnte nicht vorbereitet werden."
    );
  }

  const uploadUrl = prepareData.uploadUrl;
  const publicUrl = prepareData.publicUrl;
  const headers = prepareData.headers ?? {};

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

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

    xhr.send(args.file);
  });

  return publicUrl;
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
    setReleaseFile(file);
    setReleaseUpload({
      ...initialUploadState,
      fileName: file?.name ?? null,
    });
    setFormError(null);
  }

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setImageUpload({
      ...initialUploadState,
      fileName: file?.name ?? null,
    });
    setFormError(null);
  }

  async function ensureUploadedFile(args: {
    file: File | null;
    kind: UploadKind;
  }) {
    if (!args.file) {
      return args.kind === "release" ? currentFileUrl : currentImageUrl;
    }

    const setState = args.kind === "release" ? setReleaseUpload : setImageUpload;

    setState({
      isUploading: true,
      progress: 0,
      fileName: args.file.name,
      uploadedUrl: null,
      error: null,
    });

    try {
      const uploadedUrl = await uploadFileWithProgress({
        file: args.file,
        kind: args.kind,
        slug: effectiveSlug,
        title: title.trim(),
        onProgress(progress) {
          setState((prev) => ({
            ...prev,
            isUploading: true,
            progress,
            fileName: args.file?.name ?? prev.fileName,
            error: null,
          }));
        },
      });

      setState({
        isUploading: false,
        progress: 100,
        fileName: args.file.name,
        uploadedUrl,
        error: null,
      });

      if (args.kind === "release") {
        setCurrentFileUrl(uploadedUrl);
      } else {
        setCurrentImageUrl(uploadedUrl);
      }

      return uploadedUrl;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Upload fehlgeschlagen. Bitte versuche es erneut.";

      setState({
        isUploading: false,
        progress: 0,
        fileName: args.file.name,
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
    const cleanSlug = slug.trim();

    if (!cleanTitle) {
      setFormError("Titel darf nicht leer sein.");
      return;
    }

    if (!cleanVersion) {
      setFormError("Version darf nicht leer sein.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedFileUrl = await ensureUploadedFile({
        file: releaseFile,
        kind: "release",
      });

      const uploadedImageUrl = await ensureUploadedFile({
        file: imageFile,
        kind: "image",
      });

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
          slug: cleanSlug,
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
        throw new Error(data?.error || "Änderungen konnten nicht gespeichert werden.");
      }

      router.push(
        `/dashboard/releases/${release.id}/edit?success=${encodeURIComponent(
          "Your changes have been saved successfully."
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
            className="mb-2 block text-sm font-medium text-white/75"
          >
            Title
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            placeholder="e.g. ArcadiaX"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="version"
            className="mb-2 block text-sm font-medium text-white/75"
          >
            Version
          </label>
          <input
            id="version"
            name="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            required
            placeholder="e.g. 1.0.0"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="slug"
            className="mb-2 block text-sm font-medium text-white/75"
          >
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="e.g. arcadiax"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-white/45">
            Optional. Used for the public URL.
          </p>
          <p className="mt-1 text-xs text-[#9d8dff]/80">
            Current slug: <span className="font-medium">{effectiveSlug}</span>
          </p>
        </div>

        <div>
          <label
            htmlFor="status"
            className="mb-2 block text-sm font-medium text-white/75"
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
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#6c5ce7]/50 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-medium text-white/75"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={7}
          placeholder="Describe the release, features, changes, or important notes..."
          disabled={anyBusy}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label
          htmlFor="changelog"
          className="mb-2 block text-sm font-medium text-white/75"
        >
          Changelog
        </label>
        <textarea
          id="changelog"
          name="changelog"
          value={changelog}
          onChange={(event) => setChangelog(event.target.value)}
          rows={6}
          placeholder="What changed?"
          disabled={anyBusy}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#6c5ce7]/50 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="grid gap-5">
        <div>
          <label
            htmlFor="imageFile"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75"
          >
            <ImageIcon className="h-4 w-4 text-[#9d8dff]" />
            Upload New Image
          </label>
          <input
            id="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
            onChange={handleImageFileChange}
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 file:mr-4 file:rounded-xl file:border-0 file:bg-[#6c5ce7]/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-white/45">
            Optional. If you do not select a file, the current image will be kept.
          </p>

          {imageFile ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/75">
              <div className="font-medium text-white">{imageFile.name}</div>
              <div className="mt-1 text-white/45">{formatBytes(imageFile.size)}</div>
            </div>
          ) : null}

          {imageUpload.isUploading ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                <span>Image upload in progress...</span>
                <span>{imageUpload.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#6c5ce7] transition-all"
                  style={{ width: `${imageUpload.progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {imageUpload.uploadedUrl ? (
            <p className="mt-2 text-xs text-emerald-300">
              Image uploaded successfully.
            </p>
          ) : null}

          {imageUpload.error ? (
            <p className="mt-2 text-xs text-red-300">{imageUpload.error}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="releaseFile"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75"
          >
            <Upload className="h-4 w-4 text-[#9d8dff]" />
            Upload New Release File
          </label>
          <input
            id="releaseFile"
            type="file"
            onChange={handleReleaseFileChange}
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 file:mr-4 file:rounded-xl file:border-0 file:bg-[#6c5ce7]/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-white/45">
            Optional. If you do not select a file, the current release file will be kept.
          </p>

          {releaseFile ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/75">
              <div className="font-medium text-white">{releaseFile.name}</div>
              <div className="mt-1 text-white/45">
                {formatBytes(releaseFile.size)}
              </div>
            </div>
          ) : null}

          {releaseUpload.isUploading ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                <span>Release file upload in progress...</span>
                <span>{releaseUpload.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#6c5ce7] transition-all"
                  style={{ width: `${releaseUpload.progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {releaseUpload.uploadedUrl ? (
            <p className="mt-2 text-xs text-emerald-300">
              Release file uploaded successfully.
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
          className="inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
        </button>

        <Link
          href="/dashboard/releases"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#6c5ce7]/40 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Cancel</span>
        </Link>
      </div>
    </form>
  );
}