export type UploadKind = "image" | "release";

export type UploadFileOptions = {
  file: File;
  folder: "releases" | "media" | "avatars";
  slug?: string;
  kind: UploadKind;
  onProgress?: (progress: number) => void;
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

function uploadWithXhr(params: {
  url: string;
  blob: Blob;
  contentType?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
}) {
  return new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", params.url, true);
    xhr.timeout = params.timeoutMs ?? 60_000;

    if (params.contentType) {
      xhr.setRequestHeader("Content-Type", params.contentType);
    }

    xhr.upload.onprogress = (event) => {
      if (!params.onProgress) return;
      if (!event.lengthComputable || event.total <= 0) return;

      const progress = Math.round((event.loaded / event.total) * 100);
      params.onProgress(progress);
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
    // absichtlich ignorieren
  }
}

export async function uploadFileToR2(
  options: UploadFileOptions
): Promise<UploadResult> {
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
        onProgress: options.onProgress,
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

    options.onProgress?.(100);

    return {
      uploadedUrl: start.publicUrl,
      key: start.key,
    };
  }

  const { uploadId, key, publicUrl, parts, partSize } = start;
  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];

  try {
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const startByte = index * partSize;
      const endByte = Math.min(startByte + partSize, options.file.size);
      const chunk = options.file.slice(startByte, endByte);

      const xhr = await uploadWithXhr({
        url: part.uploadUrl,
        blob: chunk,
        signal: options.signal,
        timeoutMs: 5 * 60_000,
        onProgress: (partProgress) => {
          const completedBytes = startByte;
          const currentPartBytes = Math.round(
            ((endByte - startByte) * partProgress) / 100
          );
          const totalUploaded = completedBytes + currentPartBytes;
          const overallProgress = Math.min(
            100,
            Math.round((totalUploaded / options.file.size) * 100)
          );
          options.onProgress?.(overallProgress);
        },
      });

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

      const progress = Math.round(((index + 1) / parts.length) * 100);
      options.onProgress?.(progress);
    }

    const finished = await completeUpload({
      key,
      uploadId,
      parts: completedParts,
      signal: options.signal,
    });

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