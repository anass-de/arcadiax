import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
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

export function getR2BucketName() {
  return assertEnv(R2_BUCKET_NAME, "R2_BUCKET_NAME");
}

export function getR2PublicBaseUrl() {
  const value = assertEnv(R2_PUBLIC_BASE_URL, "R2_PUBLIC_BASE_URL");
  return value.replace(/\/+$/, "");
}

export function getR2Client() {
  const accountId = assertEnv(R2_ACCOUNT_ID, "R2_ACCOUNT_ID");
  const accessKeyId = assertEnv(R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID");
  const secretAccessKey = assertEnv(
    R2_SECRET_ACCESS_KEY,
    "R2_SECRET_ACCESS_KEY"
  );

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function sanitizeFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const base = lastDot >= 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "file";

  const safeExt = ext.replace(/[^\w.]+/g, "");

  return `${safeBase}${safeExt}`;
}

export function buildR2ObjectKey(args: {
  folder: string;
  fileName: string;
  prefix?: string;
}) {
  const cleanFolder = args.folder.replace(/^\/+|\/+$/g, "");
  const safeName = sanitizeFileName(args.fileName);
  const cleanPrefix = (args.prefix ?? "").trim().replace(/[^\w-]+/g, "-");
  const timestamp = Date.now();

  return cleanPrefix
    ? `${cleanFolder}/${timestamp}-${cleanPrefix}-${safeName}`
    : `${cleanFolder}/${timestamp}-${safeName}`;
}

export function getPublicUrlForKey(key: string) {
  const baseUrl = getR2PublicBaseUrl();
  const normalizedKey = key.replace(/^\/+/, "");

  return `${baseUrl}/${normalizedKey}`;
}

export async function createPresignedUploadUrl(args: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: args.key,
    ContentType: args.contentType || "application/octet-stream",
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: args.expiresIn ?? 60 * 10,
  });

  return {
    uploadUrl: signedUrl,
    publicUrl: getPublicUrlForKey(args.key),
    key: args.key,
  };
}

export function getR2ObjectKeyFromUrl(fileUrl: string | null | undefined) {
  if (!fileUrl) {
    return null;
  }

  try {
    const baseUrl = getR2PublicBaseUrl();
    const normalizedBase = new URL(baseUrl);
    const targetUrl = new URL(fileUrl);

    if (
      normalizedBase.origin !== targetUrl.origin ||
      !targetUrl.pathname.startsWith(normalizedBase.pathname)
    ) {
      return null;
    }

    let relativePath = targetUrl.pathname.slice(normalizedBase.pathname.length);

    relativePath = relativePath.replace(/^\/+/, "");

    return relativePath || null;
  } catch {
    return null;
  }
}

export async function deleteR2Objects(keys: string[]) {
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];

  if (uniqueKeys.length === 0) {
    return;
  }

  const client = getR2Client();
  const bucket = getR2BucketName();

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: uniqueKeys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    })
  );
}

export async function deleteR2ObjectsFromUrls(
  urls: Array<string | null | undefined>
) {
  const keys = urls
    .map((url) => getR2ObjectKeyFromUrl(url))
    .filter((value): value is string => Boolean(value));

  if (keys.length === 0) {
    return;
  }

  try {
    await deleteR2Objects(keys);
  } catch (error) {
    console.error("Failed to delete R2 objects:", error);
  }
}