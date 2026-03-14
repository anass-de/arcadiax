"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  File,
  FileImage,
  Film,
  Loader2,
  Upload,
} from "lucide-react";

type MediaType = "IMAGE" | "VIDEO";

type UploadResponse = {
  ok: boolean;
  media?: {
    id: string;
    title?: string | null;
    description?: string | null;
    url: string;
    type: MediaType;
    createdAt: string;
    updatedAt?: string;
  };
  error?: string;
};

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

export default function DashboardMediaPage() {
  const [selectedType, setSelectedType] = useState<MediaType>("IMAGE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Please select a file first.");
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

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setSelectedFile(null);
      setUploadTitle("");
      setUploadDescription("");

      const input = document.getElementById("media-file") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }

      setSuccessMessage(
        selectedType === "IMAGE"
          ? "Image uploaded successfully."
          : "Video uploaded successfully."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
      setSuccessMessage(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className="text-sm font-medium uppercase tracking-[0.2em]"
              style={{ color: "#6c5ce7cc" }}
            >
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Media Upload
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              Upload images and videos for ArcadiaX. This page is intentionally
              simplified and focused only on uploading new media.
            </p>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-red-500/20 bg-red-500/10 p-4 text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <div className="font-semibold">Upload failed</div>
            <p className="mt-1 text-sm text-red-100/90">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="flex items-start gap-3 rounded-[24px] border p-4 text-white"
          style={{
            borderColor: "rgba(108, 92, 231, 0.25)",
            backgroundColor: "rgba(108, 92, 231, 0.12)",
          }}
        >
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "#6c5ce7" }}
          />
          <div>
            <div className="font-semibold">Upload successful</div>
            <p className="mt-1 text-sm text-white/85">{successMessage}</p>
          </div>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-4xl rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#07090f] p-3">
            {selectedType === "IMAGE" ? (
              <FileImage className="h-5 w-5" style={{ color: "#6c5ce7" }} />
            ) : (
              <Film className="h-5 w-5" style={{ color: "#6c5ce7" }} />
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-white/50">Upload</div>
            <h2 className="text-2xl font-semibold text-white">
              Upload New Media
            </h2>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              Media Type
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedType("IMAGE")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition"
                style={
                  selectedType === "IMAGE"
                    ? {
                        border: "1px solid rgba(108, 92, 231, 0.45)",
                        backgroundColor: "rgba(108, 92, 231, 0.10)",
                        color: "white",
                      }
                    : {
                        border: "1px solid rgba(255,255,255,0.10)",
                        backgroundColor: "#07090f",
                        color: "#d4d4d8",
                      }
                }
              >
                <FileImage className="h-4 w-4" />
                Image
              </button>

              <button
                type="button"
                onClick={() => setSelectedType("VIDEO")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition"
                style={
                  selectedType === "VIDEO"
                    ? {
                        border: "1px solid rgba(108, 92, 231, 0.45)",
                        backgroundColor: "rgba(108, 92, 231, 0.10)",
                        color: "white",
                      }
                    : {
                        border: "1px solid rgba(255,255,255,0.10)",
                        backgroundColor: "#07090f",
                        color: "#d4d4d8",
                      }
                }
              >
                <Film className="h-4 w-4" />
                Video
              </button>
            </div>
          </div>

          <div>
            <label
              className="mb-3 block text-sm font-medium text-white/70"
              htmlFor="media-file"
            >
              File
            </label>

            <input
              id="media-file"
              type="file"
              accept={selectedType === "IMAGE" ? "image/*" : "video/*"}
              onChange={handleFileChange}
              className="block w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-zinc-200 file:mr-4 file:rounded-xl file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              style={
                {
                  // Tailwind file pseudo replacement kept by classes; base color here for consistency
                }
              }
            />

            {selectedFile ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-zinc-300">
                <div className="flex flex-wrap items-center gap-2">
                  <File className="h-4 w-4" style={{ color: "#6c5ce7" }} />
                  <span className="font-medium text-white">{selectedFile.name}</span>
                  <span className="text-zinc-500">
                    ({formatBytes(selectedFile.size)})
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-white/70"
              htmlFor="media-title"
            >
              Title
            </label>
            <input
              id="media-title"
              type="text"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Optional title"
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-white/70"
              htmlFor="media-description"
            >
              Description
            </label>
            <textarea
              id="media-description"
              value={uploadDescription}
              onChange={(event) => setUploadDescription(event.target.value)}
              placeholder="Optional description"
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-[#07090f] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: "#6c5ce7",
            }}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {selectedType === "IMAGE" ? "Upload Image" : "Upload Video"}
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}