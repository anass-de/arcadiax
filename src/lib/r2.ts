import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
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
const secretAccessKey = assertEnv(
  R2_SECRET_ACCESS_KEY,
  "R2_SECRET_ACCESS_KEY"
);
const bucketName = assertEnv(R2_BUCKET_NAME, "R2_BUCKET_NAME");
const publicBaseUrl = assertEnv(
  R2_PUBLIC_BASE_URL,
  "R2_PUBLIC_BASE_URL"
).replace(/\/+$/, "");

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const R2_BUCKET_NAME_VALUE = bucketName;
export const R2_PUBLIC_BASE_URL_VALUE = publicBaseUrl;

export type UploadFolder = "releases" | "media" | "avatars" | "uploads";

export function isValidFolder(folder: string): folder is UploadFolder {
  return ["releases", "media", "avatars", "uploads"].includes(folder);
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim() || "file";
  const parts = trimmed.split(".");
  const extension = parts.length > 1 ? parts.pop() : "";
  const baseName = parts.join(".") || "file";

  const safeBase =
    baseName
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "file";

  const safeExt = extension
    ? extension
        .normalize("NFKD")
        .replace(/[^\w]+/g, "")
        .toLowerCase()
        .slice(0, 12)
    : "";

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function sanitizeSlug(slug?: string) {
  return (
    (slug ?? "general")
      .trim()
      .toLowerCase()
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "general"
  );
}

export function buildR2Key(params: {
  folder?: string;
  slug?: string;
  fileName: string;
}) {
  const folder =
    (params.folder ?? "uploads").trim().replace(/^\/+|\/+$/g, "") || "uploads";

  const slug = sanitizeSlug(params.slug);
  const safeFileName = sanitizeFileName(params.fileName);
  const timestamp = Date.now();

  return `${folder}/${slug}/${timestamp}-${safeFileName}`;
}

export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: params.expiresIn ?? 3600,
  });

  return {
    uploadUrl,
    publicUrl: `${publicBaseUrl}/${params.key}`,
    key: params.key,
  };
}

export async function createMultipartUpload(params: {
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}) {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType,
    Metadata: params.metadata,
  });

  const response = await r2Client.send(command);

  if (!response.UploadId) {
    throw new Error("Multipart upload could not be started.");
  }

  return {
    uploadId: response.UploadId,
    key: params.key,
    publicUrl: `${publicBaseUrl}/${params.key}`,
  };
}

export async function createMultipartPartUploadUrl(params: {
  key: string;
  uploadId: string;
  partNumber: number;
  expiresIn?: number;
}) {
  if (!Number.isInteger(params.partNumber) || params.partNumber < 1) {
    throw new Error("Invalid multipart part number.");
  }

  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: params.key,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: params.expiresIn ?? 60 * 20,
  });

  return {
    uploadUrl,
    partNumber: params.partNumber,
  };
}

export async function completeMultipartUpload(params: {
  key: string;
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
}) {
  const normalizedParts = [...params.parts]
    .filter(
      (part) =>
        part &&
        typeof part.ETag === "string" &&
        Number.isInteger(part.PartNumber)
    )
    .map((part) => ({
      ETag: part.ETag.replace(/^"+|"+$/g, ""),
      PartNumber: part.PartNumber,
    }))
    .sort((a, b) => a.PartNumber - b.PartNumber);

  if (normalizedParts.length === 0) {
    throw new Error("No multipart parts provided.");
  }

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: params.key,
    UploadId: params.uploadId,
    MultipartUpload: {
      Parts: normalizedParts,
    },
  });

  const response = await r2Client.send(command);

  return {
    key: params.key,
    publicUrl: `${publicBaseUrl}/${params.key}`,
    location: response.Location ?? `${publicBaseUrl}/${params.key}`,
    etag: response.ETag ?? null,
  };
}

export async function abortMultipartUpload(params: {
  key: string;
  uploadId: string;
}) {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: params.key,
    UploadId: params.uploadId,
  });

  await r2Client.send(command);

  return { ok: true };
}

function extractR2KeyFromUrl(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  if (trimmedUrl.startsWith(`${publicBaseUrl}/`)) {
    return trimmedUrl.slice(publicBaseUrl.length + 1);
  }

  try {
    const parsed = new URL(trimmedUrl);
    const key = parsed.pathname.replace(/^\/+/, "");
    return key || null;
  } catch {
    return null;
  }
}

export async function deleteR2ObjectsFromUrls(
  urls: Array<string | null | undefined>
) {
  const keys = urls
    .map((url) => (url ? extractR2KeyFromUrl(url) : null))
    .filter((key): key is string => Boolean(key));

  if (keys.length === 0) {
    return { deleted: [], skipped: true };
  }

  const uniqueKeys = [...new Set(keys)];

  await r2Client.send(
    new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: uniqueKeys.map((Key) => ({ Key })),
        Quiet: false,
      },
    })
  );

  return {
    deleted: uniqueKeys,
    skipped: false,
  };
}

export { bucketName };