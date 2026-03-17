"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Upload, ImageIcon, Save } from "lucide-react";

import { uploadFileMultipart } from "@/lib/upload-file-multipart";

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

const MAX_SIMPLE_UPLOAD = 50 * 1024 * 1024; // 50 MB

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
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

async function uploadSimple(
  file: File,
  slug: string,
  kind: UploadKind,
  onProgress: (p: number) => void
) {
  const res = await fetch("/api/admin/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      slug,
      folder: kind === "image" ? "media" : "releases",
    }),
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();

  if (!data?.uploadUrl) {
    throw new Error("Presign fehlgeschlagen");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload fehlgeschlagen"));
    };

    xhr.onerror = () => reject(new Error("Netzwerkfehler"));
    xhr.send(file);
  });

  return data.publicUrl;
}

export default function NewReleaseForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [slug, setSlug] = useState("");

  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [releaseUpload, setReleaseUpload] =
    useState<UploadState>(initialUploadState);
  const [imageUpload, setImageUpload] =
    useState<UploadState>(initialUploadState);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveSlug = useMemo(() => {
    return slugify(slug || title || "release");
  }, [slug, title]);

  function handleFileChange(
    e: ChangeEvent<HTMLInputElement>,
    type: UploadKind
  ) {
    const file = e.target.files?.[0] ?? null;

    if (type === "release") setReleaseFile(file);
    else setImageFile(file);
  }

  async function uploadFile(
    file: File,
    kind: UploadKind,
    setState: (fn: any) => void
  ) {
    setState({
      isUploading: true,
      progress: 0,
      fileName: file.name,
      uploadedUrl: null,
      error: null,
    });

    try {
      let url: string;

      if (file.size > MAX_SIMPLE_UPLOAD) {
        // 🔥 Multipart
        const result = await uploadFileMultipart({
          file,
          slug: effectiveSlug,
          kind,
          onProgress: (p) =>
            setState((prev: UploadState) => ({
              ...prev,
              progress: p,
            })),
        });

        url = result.publicUrl;
      } else {
        // ⚡ normal
        url = await uploadSimple(file, effectiveSlug, kind, (p) =>
          setState((prev: UploadState) => ({
            ...prev,
            progress: p,
          }))
        );
      }

      setState({
        isUploading: false,
        progress: 100,
        fileName: file.name,
        uploadedUrl: url,
        error: null,
      });

      return url;
    } catch (err: any) {
      setState({
        isUploading: false,
        progress: 0,
        fileName: file.name,
        uploadedUrl: null,
        error: err.message,
      });

      throw err;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title || !version) {
      setError("Titel & Version erforderlich");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileUrl = releaseFile
        ? await uploadFile(releaseFile, "release", setReleaseUpload)
        : null;

      const imageUrl = imageFile
        ? await uploadFile(imageFile, "image", setImageUpload)
        : null;

      if (!fileUrl) throw new Error("Release-Datei fehlt");

      const res = await fetch("/api/admin/releases", {
        method: "POST",
        body: JSON.stringify({
          title,
          version,
          slug: effectiveSlug,
          fileUrl,
          imageUrl,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Speichern fehlgeschlagen");

      router.push("/dashboard/releases?success=created");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        placeholder="Titel"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        placeholder="Version"
        value={version}
        onChange={(e) => setVersion(e.target.value)}
      />

      <input
        placeholder="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />

      <div>
        <label>Release-Datei</label>
        <input type="file" onChange={(e) => handleFileChange(e, "release")} />
        {releaseUpload.progress > 0 && <p>{releaseUpload.progress}%</p>}
      </div>

      <div>
        <label>Bild</label>
        <input type="file" onChange={(e) => handleFileChange(e, "image")} />
        {imageUpload.progress > 0 && <p>{imageUpload.progress}%</p>}
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <button disabled={loading}>
        <Save /> {loading ? "Uploading..." : "Release erstellen"}
      </button>
    </form>
  );
}