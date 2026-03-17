export const MAX_LARGE_UPLOAD_SIZE = 30 * 1024 * 1024 * 1024; // 30 GB
export const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB (S3/R2 multipart minimum except last part)
export const DEFAULT_PART_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_PARALLEL_UPLOADS = 4;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_RELEASE_FILE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "application/pdf",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
] as const;

export type UploadKind = "image" | "release";

export function getAllowedTypes(kind: UploadKind) {
  return kind === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_RELEASE_FILE_TYPES;
}

export function validateUploadInput(params: {
  kind: UploadKind;
  fileName: string;
  fileSize: number;
  contentType: string;
}) {
  const allowed = getAllowedTypes(params.kind);

  if (!params.fileName?.trim()) {
    return "Dateiname fehlt.";
  }

  if (!params.contentType?.trim()) {
    return "Dateityp fehlt.";
  }

  if (!allowed.includes(params.contentType as never)) {
    return `Dateityp nicht erlaubt: ${params.contentType}`;
  }

  if (params.fileSize <= 0) {
    return "Datei ist leer.";
  }

  if (params.fileSize > MAX_LARGE_UPLOAD_SIZE) {
    return "Datei ist größer als 30 GB.";
  }

  return null;
}