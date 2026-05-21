/**
 * R2 asset upload — plain async function (not yet a TanStack Start server
 * function). The 'use server' directive and createServerFn wrapper are
 * deferred to a future slice once the end-to-end R2 credentials are wired.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { resolveAssetUrl } from '../lib/asset-urls';

const inputSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
});

export interface UploadAssetInput {
  key: string;
  /** Binary body. Use Uint8Array or Buffer — ArrayBuffer is not supported by the S3 SDK. */
  body: Uint8Array | Buffer;
  contentType: string;
}

export interface UploadAssetResult {
  ok: true;
  key: string;
  url: string;
}

/**
 * Upload a binary asset to Cloudflare R2 via the S3-compatible API.
 *
 * Reads R2 configuration from environment variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_ASSETS, R2_PUBLIC_BASE_URL
 *
 * Throws a deterministic error if any required env var is missing (avoids
 * leaking AWS SDK errors to callers).
 */
export async function uploadAsset(input: UploadAssetInput): Promise<UploadAssetResult> {
  // Validate key + contentType with zod. Body is binary — not validated by zod.
  inputSchema.parse({ key: input.key, contentType: input.contentType });

  const accountId = process.env['R2_ACCOUNT_ID'] ?? '';
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'] ?? '';
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'] ?? '';
  const bucket = process.env['R2_BUCKET_ASSETS'] ?? '';

  if (!accountId) throw new Error('R2 upload not configured: missing R2_ACCOUNT_ID');
  if (!accessKeyId) throw new Error('R2 upload not configured: missing R2_ACCESS_KEY_ID');
  if (!secretAccessKey) throw new Error('R2 upload not configured: missing R2_SECRET_ACCESS_KEY');
  if (!bucket) throw new Error('R2 upload not configured: missing R2_BUCKET_ASSETS');

  const client = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  });

  await client.send(command);

  const url = resolveAssetUrl(input.key) ?? input.key;

  return { ok: true, key: input.key, url };
}
