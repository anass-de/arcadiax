"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { ImageIcon, Plus, Upload } from "lucide-react";

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

export default function NewReleaseForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("PUBLISHED");
  const [description, setDescription] = useState("");
  const [changelog, setChangelog] = useState("");

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
      if (args.kind === "release") {
        throw new Error("Bitte wähle eine Release-Datei aus.");
      }
      return null;
    }

    if (args.kind === "release" && releaseUpload.uploadedUrl) {
      return releaseUpload.uploadedUrl;
    }

    if (args.kind === "image" && imageUpload.uploadedUrl) {
      return imageUpload.uploadedUrl;
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

    if (!releaseFile) {
      setFormError("Bitte wähle eine Release-Datei aus.");
      return;
    }

    setIsSubmitting(true);

    try {
      const fileUrl = await ensureUploadedFile({
        file: releaseFile,
        kind: "release",
      });

      const imageUrl = await ensureUploadedFile({
        file: imageFile,
        kind: "image",
      });

      const response = await fetch("/api/admin/releases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "follow",
        body: JSON.stringify({
          title: cleanTitle,
          version: cleanVersion,
          slug: cleanSlug,
          description: description.trim() || null,
          changelog: changelog.trim() || null,
          status,
          fileUrl,
          fileName: releaseFile.name,
          fileSize: releaseFile.size,
          mimeType: releaseFile.type || null,
          imageUrl,
        }),
      });

      if (response.redirected && response.url) {
        router.push(response.url);
        router.refresh();
        return;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Release konnte nicht erstellt werden.");
      }

      router.push("/dashboard/releases?success=Release wurde erfolgreich erstellt.");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Beim Erstellen des Releases ist ein Fehler aufgetreten."
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
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Titel
          </label>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="z. B. ArcadiaX"
            required
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Version
          </label>
          <input
            type="text"
            name="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="z. B. 1.0.0"
            required
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Slug
          </label>
          <input
            type="text"
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="z. B. arcadiax"
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Optional. Wenn leer, wird der Slug automatisch aus dem Titel erzeugt.
          </p>
          <p className="mt-1 text-xs text-cyan-300/80">
            Aktueller Slug: <span className="font-medium">{effectiveSlug}</span>
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Status
          </label>
          <select
            name="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "DRAFT" | "PUBLISHED")
            }
            disabled={anyBusy}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Beschreibung
        </label>
        <textarea
          name="description"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Beschreibe das Release, Funktionen, Änderungen oder Hinweise..."
          disabled={anyBusy}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Changelog
        </label>
        <textarea
          name="changelog"
          rows={5}
          value={changelog}
          onChange={(event) => setChangelog(event.target.value)}
          placeholder="Was hat sich geändert?"
          disabled={anyBusy}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/30 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <ImageIcon className="h-4 w-4 text-cyan-300" />
            Vorschaubild hochladen
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            disabled={anyBusy}
            className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Optional. Bild für Karten, Listen und Vorschau.
          </p>

          {imageFile ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-300">
              <div className="font-medium text-white">{imageFile.name}</div>
              <div className="mt-1 text-zinc-500">{formatBytes(imageFile.size)}</div>
            </div>
          ) : null}

          {imageUpload.isUploading ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                <span>Bild-Upload läuft...</span>
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
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Upload className="h-4 w-4 text-cyan-300" />
            Release-Datei hochladen
          </label>
          <input
            type="file"
            onChange={handleReleaseFileChange}
            required
            disabled={anyBusy}
            className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Pflichtfeld. Das ist die eigentliche Release-Datei zum Download.
          </p>

          {releaseFile ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-300">
              <div className="font-medium text-white">{releaseFile.name}</div>
              <div className="mt-1 text-zinc-500">
                {formatBytes(releaseFile.size)}
              </div>
            </div>
          ) : null}

          {releaseUpload.isUploading ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                <span>Datei-Upload läuft...</span>
                <span>{releaseUpload.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${releaseUpload.progress}%` }}
                />
              </div>
            </div>
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

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={anyBusy}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          <span>
            {isSubmitting ? "Release wird erstellt..." : "Release erstellen"}
          </span>
        </button>

        <Link
          href="/dashboard/releases"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}