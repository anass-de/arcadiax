export type UploadKind = "image" | "release";

export type UploadMetrics = {
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  remainingSeconds: number | null;
};

export type UploadFileOptions = {
  file: File;
  folder: "releases" | "media" | "avatars";
  slug?: string;
  kind: UploadKind;
  onProgress?: (metrics: UploadMetrics) => void;
  signal?: AbortSignal;
};

type StartSingleResponse = {
  ok: true;
  mode: "single";
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

type StartMultipartResponse = {
  ok: true;
  mode: "multipart";
  uploadId: string;
  key: string;
  publicUrl: string;
  partSize: number;
  parts: Array<{
    partNumber: number;
    uploadUrl: string;
  }>;
};

type StartErrorResponse = {
  error: string;
};

type StartResponse =
  | StartSingleResponse
  | StartMultipartResponse
  | StartErrorResponse;

export type UploadResult = {
  uploadedUrl: string;
  key: string;
};

const MULTIPART_CONCURRENCY = 3;
const PART_RETRY_COUNT = 3;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function createMetricsEmitter(
  totalBytes: number,
  onProgress?: (metrics: UploadMetrics) => void
) {
  const startedAt = Date.now();
  let uploadedBytes = 0;
  const perPartLoaded = new Map<number, number>();

  function emit() {
    if (!onProgress) return;

    const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
    const speedBytesPerSecond = uploadedBytes / elapsedSeconds;
    const remainingBytes = Math.max(totalBytes - uploadedBytes, 0);
    const remainingSeconds =
      speedBytesPerSecond > 0 ? remainingBytes / speedBytesPerSecond : null;

    const progress =
      totalBytes > 0
        ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100))
        : 0;

    onProgress({
      progress,
      uploadedBytes,
      totalBytes,
      speedBytesPerSecond,
      remainingSeconds,
    });
  }

  return {
    setSingleLoaded(bytes: number) {
      uploadedBytes = Math.min(bytes, totalBytes);
      emit();
    },
    setPartLoaded(partNumber: number, bytes: number) {
      perPartLoaded.set(partNumber, Math.max(0, bytes));
      uploadedBytes = Array.from(perPartLoaded.values()).reduce(
        (sum, value) => sum + value,
        0
      );
      emit();
    },
    markDone() {
      uploadedBytes = totalBytes;
      emit();
    },
  };
}

function uploadWithXhr(params: {
  url: string;
  blob: Blob;
  contentType?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgressBytes?: (loadedBytes: number, totalBytes: number) => void;
}) {
  return new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", params.url, true);
    xhr.withCredentials = false;
    xhr.timeout = params.timeoutMs ?? 60_000;

    if (params.contentType) {
      xhr.setRequestHeader("Content-Type", params.contentType);
    }

    xhr.upload.onprogress = (event) => {
      if (!params.onProgressBytes) return;
      if (!event.lengthComputable) return;

      params.onProgressBytes(event.loaded, event.total);
    };

    xhr.onload = () => resolve(xhr);

    xhr.onerror = () => {
      reject(new Error("Upload fehlgeschlagen."));
    };

    xhr.ontimeout = () => {
      reject(new DOMException("Upload timeout", "AbortError"));
    };

    xhr.onabort = () => {
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    const abortHandler = () => xhr.abort();
    params.signal?.addEventListener("abort", abortHandler);

    xhr.onloadend = () => {
      params.signal?.removeEventListener("abort", abortHandler);
    };

    xhr.send(params.blob);
  });
}

async function startUpload(options: UploadFileOptions): Promise<StartResponse> {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folder: options.folder,
      slug: options.slug,
      fileName: options.file.name,
      fileSize: options.file.size,
      contentType: options.file.type || "application/octet-stream",
      kind: options.kind,
    }),
    signal: options.signal,
  });

  const data = await parseJsonSafe<StartResponse>(response);

  if (!response.ok) {
    const errorMessage =
      data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Upload konnte nicht vorbereitet werden.";
    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error("Leere Antwort vom Upload-Start.");
  }

  return data;
}

async function completeUpload(payload: {
  key: string;
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
  signal?: AbortSignal;
}) {
  const response = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: payload.key,
      uploadId: payload.uploadId,
      parts: payload.parts,
    }),
    signal: payload.signal,
  });

  const data = await parseJsonSafe<{
    ok?: boolean;
    publicUrl?: string;
    key?: string;
    error?: string;
  }>(response);

  if (!response.ok || !data?.ok || !data.publicUrl || !data.key) {
    throw new Error(
      data?.error || "Multipart-Upload konnte nicht abgeschlossen werden."
    );
  }

  return {
    uploadedUrl: data.publicUrl,
    key: data.key,
  };
}

async function abortUpload(payload: {
  key: string;
  uploadId: string;
  signal?: AbortSignal;
}) {
  try {
    await fetch("/api/uploads/abort", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: payload.key,
        uploadId: payload.uploadId,
      }),
      signal: payload.signal,
    });
  } catch {
    // ignorieren
  }
}

async function retry<T>(fn: () => Promise<T>, attempts: number) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (isAbortError(error)) {
        throw error;
      }

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError;
}

export async function uploadFileToR2(
  options: UploadFileOptions
): Promise<UploadResult> {
  const metrics = createMetricsEmitter(options.file.size, options.onProgress);

  let start: StartResponse;

  try {
    start = await startUpload(options);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Upload wurde abgebrochen.");
    }

    throw error;
  }

  if ("error" in start) {
    throw new Error(start.error);
  }

  if (start.mode === "single") {
    let xhr: XMLHttpRequest;

    try {
      xhr = await uploadWithXhr({
        url: start.uploadUrl,
        blob: options.file,
        contentType: options.file.type || "application/octet-stream",
        signal: options.signal,
        timeoutMs: 60_000,
        onProgressBytes: (loadedBytes) => {
          metrics.setSingleLoaded(loadedBytes);
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(
          "Upload wurde abgebrochen oder hat das Zeitlimit überschritten."
        );
      }

      throw error;
    }

    if (xhr.status < 200 || xhr.status >= 300) {
      throw new Error(`Single Upload fehlgeschlagen (${xhr.status}).`);
    }

    metrics.markDone();

    return {
      uploadedUrl: start.publicUrl,
      key: start.key,
    };
  }

  const { uploadId, key, publicUrl, parts, partSize } = start;
  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];

  const uploadPart = async (part: { partNumber: number; uploadUrl: string }) => {
    const index = part.partNumber - 1;
    const startByte = index * partSize;
    const endByte = Math.min(startByte + partSize, options.file.size);
    const chunk = options.file.slice(startByte, endByte);

    const xhr = await retry(
      async () =>
        uploadWithXhr({
          url: part.uploadUrl,
          blob: chunk,
          signal: options.signal,
          timeoutMs: 5 * 60_000,
          onProgressBytes: (loadedBytes) => {
            metrics.setPartLoaded(part.partNumber, loadedBytes);
          },
        }),
      PART_RETRY_COUNT
    );

    if (xhr.status < 200 || xhr.status >= 300) {
      throw new Error(`Part ${part.partNumber} fehlgeschlagen (${xhr.status}).`);
    }

    const rawETag =
      xhr.getResponseHeader("etag") ||
      xhr.getResponseHeader("ETag") ||
      xhr.getResponseHeader("Etag");

    if (!rawETag) {
      throw new Error(`ETag für Part ${part.partNumber} fehlt.`);
    }

    completedParts.push({
      ETag: rawETag.replaceAll('"', ""),
      PartNumber: part.partNumber,
    });

    metrics.setPartLoaded(part.partNumber, chunk.size);
  };

  try {
    let cursor = 0;

    const workers = Array.from({
      length: Math.min(MULTIPART_CONCURRENCY, parts.length),
    }).map(async () => {
      while (cursor < parts.length) {
        const currentIndex = cursor;
        cursor += 1;
        await uploadPart(parts[currentIndex]);
      }
    });

    await Promise.all(workers);

    const finished = await completeUpload({
      key,
      uploadId,
      parts: completedParts.sort((a, b) => a.PartNumber - b.PartNumber),
      signal: options.signal,
    });

    metrics.markDone();

    return finished ?? { uploadedUrl: publicUrl, key };
  } catch (error) {
    await abortUpload({
      key,
      uploadId,
      signal: options.signal,
    });

    if (isAbortError(error)) {
      throw new Error(
        "Upload wurde abgebrochen oder hat das Zeitlimit überschritten."
      );
    }

    throw error;
  }
}