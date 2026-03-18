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

async function putWithTimeout(
  url: string,
  blob: Blob,
  options?: {
    contentType?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 60_000
  );

  const abortHandler = () => controller.abort();
  options?.signal?.addEventListener("abort", abortHandler);

  try {
    const headers: HeadersInit = {};

    if (options?.contentType) {
      headers["Content-Type"] = options.contentType;
    }

    const response = await fetch(url, {
      method: "PUT",
      body: blob,
      headers,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener("abort", abortHandler);
  }
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
    // bewusst ignorieren
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
    let uploadResponse: Response;

    try {
      uploadResponse = await putWithTimeout(start.uploadUrl, options.file, {
        contentType: options.file.type || "application/octet-stream",
        signal: options.signal,
        timeoutMs: 60_000,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(
          "Upload wurde abgebrochen oder hat das Zeitlimit überschritten."
        );
      }

      throw error;
    }

    if (!uploadResponse.ok) {
      throw new Error(
        `Single Upload fehlgeschlagen (${uploadResponse.status}).`
      );
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

      const uploadResponse = await putWithTimeout(part.uploadUrl, chunk, {
        signal: options.signal,
        timeoutMs: 5 * 60_000,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Part ${part.partNumber} fehlgeschlagen (${uploadResponse.status}).`
        );
      }

      const rawETag =
        uploadResponse.headers.get("etag") ||
        uploadResponse.headers.get("ETag") ||
        uploadResponse.headers.get("Etag");

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