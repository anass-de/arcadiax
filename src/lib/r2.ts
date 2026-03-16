import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

function sanitizeFileName(fileName: string) {
  const parts = fileName.split(".");
  const extension = parts.length > 1 ? parts.pop() : "";
  const baseName = parts.join(".") || "file";

  const safeBase = baseName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);

  const safeExt = extension
    ? extension
        .normalize("NFKD")
        .replace(/[^\w]+/g, "")
        .toLowerCase()
        .slice(0, 12)
    : "";

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export function buildR2Key(params: {
  folder?: string;
  slug?: string;
  fileName: string;
}) {
  const folder = (params.folder ?? "uploads").replace(/^\/+|\/+$/g, "");
  const slug = (params.slug ?? "general")
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

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
    expiresIn: params.expiresIn ?? 60,
  });

  const publicUrl = `${publicBaseUrl}/${params.key}`;

  return {
    uploadUrl,
    publicUrl,
    key: params.key,
  };
}

export { bucketName };