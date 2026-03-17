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
  partSize: number;
  publicUrl?: string;
};

type PartUrlResponse = {
  uploadUrl: string;
  partNumber?: number;
};

type CompleteMultipartResponse = {
  key: string;
  location: string;
  publicUrl: string;
  etag: string | null;
};

export type LargeUploadResult = {
  key: string;
  publicUrl: string;
  etag: string | null;
};

export type LargeUploadOptions = {
  folder: "releases" | "media" | "avatars";
  slug?: string;
  kind: UploadKind;
  partSize?: number;
  parallel?: number;
  maxRetries?: number;
  onProgress?: (
    percent: number,
    uploadedBytes: number,
    totalBytes: number
  ) => void;
  signal?: AbortSignal;
};

function assertAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Upload abgebrochen.", "AbortError");
  }
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

  const name = file.name.toLowerCase();

  if (kind === "image") {
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".gif")) return "image/gif";
  }

  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".7z")) return "application/x-7z-compressed";
  if (name.endsWith(".rar")) return "application/x-rar-compressed";

  return "application/octet-stream";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

async function sleep(ms: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeout);
      cleanup();
      reject(new DOMException("Upload abgebrochen.", "AbortError"));
    }

    function cleanup() {
      signal?.removeEventListener("abort", onAbort);
    }

    if (signal?.aborted) {
      clearTimeout(timeout);
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

      const backoffMs = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(backoffMs, signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Retry fehlgeschlagen.");
}

export async function uploadFileLarge(
  file: File,
  options: LargeUploadOptions
): Promise<LargeUploadResult> {
  const parallel = Math.max(
    1,
    Math.min(options.parallel ?? MAX_PARALLEL_UPLOADS, 6)
  );
  const maxRetries = Math.max(0, options.maxRetries ?? 3);
  const contentType = guessContentType(file, options.kind);

  assertAbort(options.signal);

  const start = await postJson<StartMultipartResponse>(
    "/api/uploads/multipart/start",
    {
      folder: options.folder,
      slug: options.slug,
      fileName: file.name,
      fileSize: file.size,
      contentType,
      kind: options.kind,
    }
  );

  const uploadId = start.uploadId;
  const key = start.key;

  const partSize = Math.max(
    options.partSize ?? start.partSize ?? DEFAULT_PART_SIZE,
    MIN_PART_SIZE
  );

  const partsCount = Math.ceil(file.size / partSize);
  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];
  const uploadedBytesByPart = new Map<number, number>();

  const reportProgress = () => {
    const totalUploadedBytes = Array.from(uploadedBytesByPart.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    const percent =
      file.size > 0
        ? Math.min(100, Math.round((totalUploadedBytes / file.size) * 100))
        : 0;

    options.onProgress?.(percent, totalUploadedBytes, file.size);
  };

  async function uploadPart(partNumber: number) {
    assertAbort(options.signal);

    const startByte = (partNumber - 1) * partSize;
    const endByte = Math.min(startByte + partSize, file.size);
    const blob = file.slice(startByte, endByte);

    const { uploadUrl } = await retry(
      () =>
        postJson<PartUrlResponse>("/api/uploads/multipart/part-url", {
          key,
          uploadId,
          partNumber,
        }),
      maxRetries,
      options.signal
    );

    const etag = await retry(async () => {
      assertAbort(options.signal);

      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        signal: options.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Part ${partNumber} Upload fehlgeschlagen (${res.status}). ${text.slice(0, 300)}`
        );
      }

      uploadedBytesByPart.set(partNumber, blob.size);
      reportProgress();

      const receivedETag = getETag(res.headers);

      if (!receivedETag) {
        throw new Error(`ETag für Part ${partNumber} fehlt.`);
      }

      return receivedETag;
    }, maxRetries, options.signal);

    completedParts.push({
      ETag: etag,
      PartNumber: partNumber,
    });
  }

  let abortedByClient = false;

  try {
    let nextPartNumber = 1;

    async function worker() {
      while (true) {
        assertAbort(options.signal);

        const current = nextPartNumber;
        nextPartNumber += 1;

        if (current > partsCount) {
          return;
        }

        await uploadPart(current);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(parallel, partsCount) }, () => worker())
    );

    completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    const completed = await postJson<CompleteMultipartResponse>(
      "/api/uploads/multipart/complete",
      {
        key,
        uploadId,
        parts: completedParts,
      }
    );

    options.onProgress?.(100, file.size, file.size);

    return {
      key: completed.key,
      publicUrl: completed.publicUrl,
      etag: completed.etag,
    };
  } catch (error) {
    abortedByClient =
      error instanceof DOMException && error.name === "AbortError";

    try {
      await fetch("/api/uploads/multipart/abort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, uploadId }),
      });
    } catch (abortError) {
      console.error("abort cleanup failed", abortError);
    }

    if (abortedByClient) {
      throw new Error("Upload wurde abgebrochen.");
    }

    throw error;
  }
}