/**
 * TDD: uploadAsset server function.
 * Mocks @aws-sdk/client-s3 so no real R2 credentials are needed.
 * Runs in node env.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

// ---------- Mock tracking ----------
// These arrays are populated by the mock constructors below.
// They must be declared at module scope but reset in beforeEach.
const s3ClientCalls: unknown[] = [];
const putObjectCommandCalls: unknown[] = [];
const mockSend = vi.fn().mockResolvedValue({});

// vi.mock is hoisted before all imports. The factory must be self-contained
// (no references to const/let in this scope — only global/module scope vars
// captured by closure work). We use regular `function` declarations so that
// `new` works, and we record calls into the arrays above via closure.
vi.mock('@aws-sdk/client-s3', () => {
  function S3Client(this: Record<string, unknown>, config: unknown) {
    this['config'] = config;
    this['send'] = mockSend;
    s3ClientCalls.push(config);
  }
  function PutObjectCommand(this: Record<string, unknown>, input: unknown) {
    this['input'] = input;
    putObjectCommandCalls.push(input);
  }
  return { S3Client, PutObjectCommand };
});

// Import AFTER vi.mock so the mock is in place.
import { uploadAsset } from '../../src/server/upload-asset';

describe('uploadAsset', () => {
  beforeEach(() => {
    vi.stubEnv('R2_ACCOUNT_ID', 'test-account-id');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'test-access-key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-secret-key');
    vi.stubEnv('R2_BUCKET_ASSETS', 'test-bucket');
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://assets.example.com');
    mockSend.mockClear();
    mockSend.mockResolvedValue({});
    s3ClientCalls.length = 0;
    putObjectCommandCalls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns { ok: true, key, url } on successful upload', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const result = await uploadAsset({
      key: 'furniture/sofa/model.glb',
      body,
      contentType: 'model/gltf-binary',
    });

    expect(result.ok).toBe(true);
    expect(result.key).toBe('furniture/sofa/model.glb');
    expect(result.url).toBe('https://assets.example.com/furniture/sofa/model.glb');
  });

  it('calls PutObjectCommand with the correct Bucket/Key/Body/ContentType', async () => {
    const body = new Uint8Array([4, 5, 6]);
    await uploadAsset({
      key: 'furniture/chair/model.glb',
      body,
      contentType: 'model/gltf-binary',
    });

    expect(putObjectCommandCalls).toHaveLength(1);
    const callArg = putObjectCommandCalls[0] as Record<string, unknown>;
    expect(callArg['Bucket']).toBe('test-bucket');
    expect(callArg['Key']).toBe('furniture/chair/model.glb');
    expect(callArg['Body']).toBe(body);
    expect(callArg['ContentType']).toBe('model/gltf-binary');
  });

  it('constructs S3Client with correct endpoint/region/credentials', async () => {
    const body = new Uint8Array([7, 8, 9]);
    await uploadAsset({ key: 'some/key.glb', body, contentType: 'model/gltf-binary' });

    expect(s3ClientCalls).toHaveLength(1);
    const config = s3ClientCalls[0] as Record<string, unknown>;
    expect(config['endpoint']).toBe('https://test-account-id.r2.cloudflarestorage.com');
    expect(config['region']).toBe('auto');
    const creds = config['credentials'] as Record<string, unknown>;
    expect(creds['accessKeyId']).toBe('test-access-key');
    expect(creds['secretAccessKey']).toBe('test-secret-key');
  });

  it('throws deterministic error when R2_ACCOUNT_ID is missing', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', '');
    const body = new Uint8Array([1]);
    await expect(
      uploadAsset({ key: 'some/key.glb', body, contentType: 'model/gltf-binary' }),
    ).rejects.toThrow('R2 upload not configured: missing R2_ACCOUNT_ID');
  });

  it('throws deterministic error when R2_BUCKET_ASSETS is missing', async () => {
    vi.stubEnv('R2_BUCKET_ASSETS', '');
    const body = new Uint8Array([1]);
    await expect(
      uploadAsset({ key: 'some/key.glb', body, contentType: 'model/gltf-binary' }),
    ).rejects.toThrow('R2 upload not configured: missing R2_BUCKET_ASSETS');
  });

  it('throws zod validation error when key is empty', async () => {
    const body = new Uint8Array([1]);
    await expect(
      uploadAsset({ key: '', body, contentType: 'model/gltf-binary' }),
    ).rejects.toThrow();
  });
});
