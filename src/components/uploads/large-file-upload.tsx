"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, XCircle } from "lucide-react";

import { uploadFileLarge } from "@/lib/upload-file-large";
import type { UploadKind } from "@/lib/upload-rules";

type LargeFileUploadProps = {
  label: string;
  folder: "releases" | "media" | "avatars";
  kind: UploadKind;
  slug?: string;
  accept?: string;
  onUploaded: (url: string) => void;
};

const MAX_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = -1;

  do {
    value /= 1024;
    index += 1;
  } while (value >= 1024 && index < units.length - 1);

  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

export default function LargeFileUpload({
  label,
  folder,
  kind,
  slug,
  accept,
  onUploaded,
}: LargeFileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressLabel = useMemo(() => `${progress}%`, [progress]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // dieselbe Datei erneut auswählbar machen
    event.target.value = "";

    if (!file) return;
    if (isUploading) return;

    setError(null);
    setUploadedUrl(null);
    setProgress(0);
    setStatusText("");

    if (file.size <= 0) {
      setFileName(file.name);
      setError("Datei ist leer.");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setFileName(file.name);
      setError("Datei ist größer als 30 GB.");
      return;
    }

    setFileName(file.name);
    setStatusText("Upload wird vorbereitet ...");

    const controller = new AbortController();
    abortRef.current = controller;
    setIsUploading(true);

    try {
      const result = await uploadFileLarge(file, {
        folder,
        slug,
        kind,
        parallel: 4,
        partSize: 100 * 1024 * 1024,
        maxRetries: 3,
        signal: controller.signal,
        onProgress(percent, uploadedBytes, totalBytes) {
          setProgress(percent);
          setStatusText(
            `${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)} hochgeladen`
          );
        },
      });

      setUploadedUrl(result.publicUrl);
      onUploaded(result.publicUrl);
      setProgress(100);
      setStatusText("Upload abgeschlossen.");
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload fehlgeschlagen.";

      setError(message);
      setStatusText("");
    } finally {
      setIsUploading(false);
      abortRef.current = null;
    }
  }

  function handleAbort() {
    abortRef.current?.abort();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="mb-2 block text-sm font-medium text-white/90">
        {label}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#6c5ce7] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={16} />
          Datei auswählen
        </button>

        {isUploading && (
          <button
            type="button"
            onClick={handleAbort}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/20"
          >
            <XCircle size={16} />
            Upload abbrechen
          </button>
        )}

        <span className="text-sm text-white/70">
          {fileName || "Keine Datei ausgewählt"}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {(isUploading || progress > 0) && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/70">
            <span>{statusText || "Upload läuft ..."}</span>
            <span>{progressLabel}</span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#6c5ce7] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {uploadedUrl && (
        <p className="mt-3 break-all text-sm text-emerald-300">
          Hochgeladen: {uploadedUrl}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <p className="mt-3 text-xs text-white/50">
        Unterstützt große Dateien per Multipart-Upload bis 30 GB.
      </p>
    </div>
  );
}