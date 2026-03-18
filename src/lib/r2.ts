import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
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
const secretAccessKey = assertEnv(R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY");
const bucketName = assertEnv(R2_BUCKET_NAME, "R2_BUCKET_NAME");
const publicBaseUrl = assertEnv(R2_PUBLIC_BASE_URL, "R2_PUBLIC_BASE_URL").replace(/\/+$/, "");

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const R2_BUCKET = bucketName;
export const R2_PUBLIC_URL = publicBaseUrl;

export function isValidFolder(folder: string): folder is "releases" | "media" | "avatars" {
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
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-() ]+/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return cleaned || `file-${Date.now()}`;
}

export function buildR2Key(params: {
  folder: "releases" | "media" | "avatars";
  slug?: string | null;
  fileName: string;
}) {
  const safeFileName = sanitizeFileName(params.fileName);
  const safeSlug = params.slug ? sanitizeSlug(params.slug) : null;
  const timestamp = Date.now();

  if (safeSlug) {
    return `${params.folder}/${safeSlug}/${timestamp}-${safeFileName}`;
  }

  return `${params.folder}/${timestamp}-${safeFileName}`;
}

export function getPublicUrl(key: string) {
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: params.expiresIn ?? 60 * 10,
  });

  return {
    uploadUrl,
    publicUrl: getPublicUrl(params.key),
    key: params.key,
  };
}

export async function createMultipartUpload(params: {
  key: string;
  contentType: string;
}) {
  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });

  const response = await r2Client.send(command);

  if (!response.UploadId) {
    throw new Error("Multipart upload could not be created.");
  }

  return {
    uploadId: response.UploadId,
    key: params.key,
    publicUrl: getPublicUrl(params.key),
  };
}

export async function getMultipartPartUploadUrl(params: {
  key: string;
  uploadId: string;
  partNumber: number;
  expiresIn?: number;
}) {
  const command = new UploadPartCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: params.expiresIn ?? 60 * 10,
  });
}

export async function completeMultipartUpload(params: {
  key: string;
  uploadId: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
}) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    UploadId: params.uploadId,
    MultipartUpload: {
      Parts: params.parts
        .slice()
        .sort((a, b) => a.PartNumber - b.PartNumber)
        .map((part) => ({
          ETag: part.ETag,
          PartNumber: part.PartNumber,
        })),
    },
  });

  await r2Client.send(command);

  return {
    key: params.key,
    publicUrl: getPublicUrl(params.key),
  };
}

export async function abortMultipartUpload(params: {
  key: string;
  uploadId: string;
}) {
  const command = new AbortMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    UploadId: params.uploadId,
  });

  await r2Client.send(command);
}

export async function deleteObjectByKey(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  await r2Client.send(command);
}

export async function createPresignedDownloadUrl(params: {
  key: string;
  expiresIn?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: params.expiresIn ?? 60 * 10,
  });
}