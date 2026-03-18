import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

function assertEnv(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

const accountId = assertEnv(R2_ACCOUNT_ID, "R2_ACCOUNT_ID");
const accessKeyId = assertEnv(R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID");
const secretAccessKey = assertEnv(R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY");
export const bucketName = assertEnv(R2_BUCKET_NAME, "R2_BUCKET_NAME");
const publicBaseUrl = assertEnv(R2_PUBLIC_BASE_URL, "R2_PUBLIC_BASE_URL").replace(
  /\/+$/,
  ""
);

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export type UploadFolder = "releases" | "media" | "avatars";
export type UploadKind = "image" | "release";

export function isValidFolder(folder: string): folder is UploadFolder {
  return ["releases", "media", "avatars"].includes(folder);
}

export function sanitizeSlug(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "upload"
  );
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[^\w.\-() ]+/g, "-")
    .replace(/\s+/g, "-");

  return cleaned || "file.bin";
}

function getExtension(fileName: string) {
  const match = fileName.match(/(\.[a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "";
}

export function buildR2Key(params: {
  folder: UploadFolder;
  slug?: string;
  fileName: string;
  kind: UploadKind;
  userId?: string | null;
}) {
  const now = Date.now();
  const cleanSlug = params.slug ? sanitizeSlug(params.slug) : "upload";
  const cleanFileName = sanitizeFileName(params.fileName);
  const ext = getExtension(cleanFileName);

  const baseName =
    cleanFileName.replace(/\.[^.]+$/, "") || `${params.kind}-${now}`;

  const safeBaseName = baseName
    .replace(/[^\w\-()]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const finalName = `${now}-${params.kind}-${safeBaseName}${ext}`;
  const userPart = params.userId ? `${params.userId}/` : "";

  if (params.folder === "avatars") {
    return `${params.folder}/${userPart}${finalName}`;
  }

  return `${params.folder}/${userPart}${cleanSlug}/${finalName}`;
}

export function getPublicUrlForKey(key: string) {
  return `${publicBaseUrl}/${key}`;
}

/**
 * Kompatibilitäts-Helfer für ältere Stellen im Projekt.
 * Entspricht funktional dem bisherigen createPresignedUploadUrl.
 */
export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
}) {
  const uploadUrl = await createSingleUploadUrl(params);

  return {
    uploadUrl,
    publicUrl: getPublicUrlForKey(params.key),
    key: params.key,
  };
}

export async function createSingleUploadUrl(params: {
  key: string;
  contentType: string;
}) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 60 * 15,
  });

  return uploadUrl;
}

export async function createMultipartUpload(params: {
  key: string;
  contentType: string;
}) {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType,
  });

  const result = await r2Client.send(command);

  if (!result.UploadId) {
    throw new Error("Multipart-Upload konnte nicht initialisiert werden.");
  }

  return result.UploadId;
}

export async function getMultipartPartUploadUrl(params: {
  key: string;
  uploadId: string;
  partNumber: number;
}) {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: params.key,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: 60 * 15,
  });
}

export async function completeMultipartUpload(params: {
  key: string;
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
}) {
  const completedParts: CompletedPart[] = params.parts
    .filter((part) => part.ETag && Number.isInteger(part.PartNumber))
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map((part) => ({
      ETag: part.ETag,
      PartNumber: part.PartNumber,
    }));

  if (completedParts.length === 0) {
    throw new Error("Keine gültigen Parts zum Abschließen vorhanden.");
  }

  await r2Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: params.key,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: completedParts,
      },
    })
  );
}

export async function abortMultipartUpload(params: {
  key: string;
  uploadId: string;
}) {
  await r2Client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: params.key,
      UploadId: params.uploadId,
    })
  );
}

function normalizeKeyFromUrl(urlOrKey: string) {
  const value = urlOrKey.trim();
  if (!value) return "";

  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }

  try {
    const url = new URL(value);
    const base = new URL(publicBaseUrl);

    if (url.origin === base.origin) {
      const basePath = base.pathname.replace(/\/+$/, "");
      const fullPath = url.pathname;

      if (basePath && fullPath.startsWith(basePath)) {
        return fullPath.slice(basePath.length).replace(/^\/+/, "");
      }

      return fullPath.replace(/^\/+/, "");
    }

    return url.pathname.replace(/^\/+/, "");
  } catch {
    return value.replace(/^\/+/, "");
  }
}

export async function deleteR2Objects(keys: string[]) {
  const normalized = Array.from(
    new Set(
      keys
        .map((key) => key.trim())
        .filter(Boolean)
    )
  );

  if (!normalized.length) {
    return { deleted: 0 };
  }

  await r2Client.send(
    new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: normalized.map((key) => ({ Key: key })),
        Quiet: false,
      },
    })
  );

  return { deleted: normalized.length };
}

export async function deleteR2ObjectsFromUrls(urls: string[]) {
  const keys = urls
    .map((url) => normalizeKeyFromUrl(url))
    .filter(Boolean);

  return deleteR2Objects(keys);
}