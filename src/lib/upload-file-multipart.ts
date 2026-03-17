"use client";

import {
  DEFAULT_PART_SIZE,
  MAX_PARALLEL_UPLOADS,
  MIN_PART_SIZE,
  type UploadKind,
} from "@/lib/upload-rules";

type StartMultipartResponse = {
  uploadId: string;
  key: string;
  publicUrl?: string;
  partSize?: number;
};

type PartUrlResponse = {
  uploadUrl: string;
  partNumber?: number;
};

type CompleteMultipartResponse = {
  key: string;
  publicUrl: string;
  location?: string;
  etag?: string | null;
};

export type MultipartUploadResult = {
  key: string;
  publicUrl: string;
  etag: string | null;
};

export type MultipartUploadOptions = {
  file: File;
  slug: string;
  kind: UploadKind;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  partSize?: number;
  parallel?: number;
  maxRetries?: number;
};

const DEFAULT_MAX_RETRIES = 3;

function assertAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Upload abgebrochen.", "AbortError");
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function onAbort() {
      window.clearTimeout(timer);
      cleanup();
      reject(new DOMException("Upload abgebrochen.", "AbortError"));
    }

    function cleanup() {
      signal?.removeEventListener("abort", onAbort);
    }

    if (signal?.aborted) {
      window.clearTimeout(timer);
      cleanup();
      reject(new DOMException("Upload abgebrochen.", "AbortError"));
      return;
    }

    signal?.addEventListener("abort", onAbort);
  });
}

async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    assertAbort(signal);

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(delay, signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unbekannter Upload-Fehler.");
}

async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data as T;
}

function getETag(headers: Headers) {
  const raw =
    headers.get("etag") ||
    headers.get("ETag") ||
    headers.get("Etag");

  return raw?.replace(/^"+|"+$/g, "") ?? null;
}

function guessContentType(file: File, kind: UploadKind) {
  if (file.type?.trim()) {
    return file.type;
  }

  const lower = file.name.toLowerCase();

  if (kind === "image") {
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
  }

  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  if (lower.endsWith(".rar")) return "application/x-rar-compressed";

  return "application/octet-stream";
}

export async function uploadFileMultipart(
  options: MultipartUploadOptions
): Promise<MultipartUploadResult> {
  const {
    file,
    slug,
    kind,
    onProgress,
    signal,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const parallel = Math.max(
    1,
    Math.min(options.parallel ?? MAX_PARALLEL_UPLOADS, 6)
  );

  assertAbort(signal);

  const contentType = guessContentType(file, kind);
  const folder = kind === "image" ? "media" : "releases";

  const started = await postJson<StartMultipartResponse>(
    "/api/uploads/multipart/start",
    {
      folder,
      slug,
      fileName: file.name,
      fileSize: file.size,
      contentType,
      kind,
    },
    signal
  );

  const uploadId = started.uploadId;
  const key = started.key;

  const partSize = Math.max(
    options.partSize ?? started.partSize ?? DEFAULT_PART_SIZE,
    MIN_PART_SIZE
  );

  const totalParts = Math.ceil(file.size / partSize);
  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];
  const uploadedBytesByPart = new Map<number, number>();

  function reportProgress() {
    const uploadedBytes = Array.from(uploadedBytesByPart.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    const progress =
      file.size > 0
        ? Math.min(100, Math.round((uploadedBytes / file.size) * 100))
        : 0;

    onProgress?.(progress);
  }

  async function uploadPart(partNumber: number) {
    assertAbort(signal);

    const startByte = (partNumber - 1) * partSize;
    const endByte = Math.min(startByte + partSize, file.size);
    const blob = file.slice(startByte, endByte);

    const { uploadUrl } = await retry(
      () =>
        postJson<PartUrlResponse>(
          "/api/uploads/multipart/part-url",
          {
            key,
            uploadId,
            partNumber,
          },
          signal
        ),
      maxRetries,
      signal
    );

    const etag = await retry(async () => {
      assertAbort(signal);

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Part ${partNumber} Upload fehlgeschlagen (${response.status}). ${text.slice(0, 300)}`
        );
      }

      uploadedBytesByPart.set(partNumber, blob.size);
      reportProgress();

      const receivedETag = getETag(response.headers);

      if (!receivedETag) {
        throw new Error(`ETag für Part ${partNumber} fehlt.`);
      }

      return receivedETag;
    }, maxRetries, signal);

    completedParts.push({
      ETag: etag,
      PartNumber: partNumber,
    });
  }

  try {
    let nextPartNumber = 1;

    async function worker() {
      while (true) {
        assertAbort(signal);

        const current = nextPartNumber;
        nextPartNumber += 1;

        if (current > totalParts) {
          return;
        }

        await uploadPart(current);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(parallel, totalParts) }, () => worker())
    );

    completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    const completed = await postJson<CompleteMultipartResponse>(
      "/api/uploads/multipart/complete",
      {
        key,
        uploadId,
        parts: completedParts,
      },
      signal
    );

    onProgress?.(100);

    return {
      key: completed.key,
      publicUrl: completed.publicUrl,
      etag: completed.etag ?? null,
    };
  } catch (error) {
    try {
      await fetch("/api/uploads/multipart/abort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, uploadId }),
      });
    } catch (abortError) {
      console.error("multipart abort cleanup failed:", abortError);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Upload wurde abgebrochen.");
    }

    throw error;
  }
}