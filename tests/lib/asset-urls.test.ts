/**
 * TDD: resolveAssetUrl helper.
 * Runs in node env — no DOM needed.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveAssetUrl } from '../../src/lib/asset-urls';

describe('resolveAssetUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns absolute https URL unchanged', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://assets.example.com');
    expect(resolveAssetUrl('https://cdn.example.com/foo.glb')).toBe(
      'https://cdn.example.com/foo.glb',
    );
  });

  it('returns absolute http URL unchanged', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', '');
    expect(resolveAssetUrl('http://localhost:3000/foo.glb')).toBe(
      'http://localhost:3000/foo.glb',
    );
  });

  it('returns root-relative path unchanged', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://assets.example.com');
    expect(resolveAssetUrl('/assets/samples/Duck.glb')).toBe('/assets/samples/Duck.glb');
  });

  it('joins bare key with R2_PUBLIC_BASE_URL when set', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://assets.example.com');
    expect(resolveAssetUrl('furniture/sofa-001/model.glb')).toBe(
      'https://assets.example.com/furniture/sofa-001/model.glb',
    );
  });

  it('joins bare key with trailing-slash R2_PUBLIC_BASE_URL without double slash', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://assets.example.com/');
    expect(resolveAssetUrl('furniture/sofa-001/model.glb')).toBe(
      'https://assets.example.com/furniture/sofa-001/model.glb',
    );
  });

  it('returns local-relative path for bare key when R2_PUBLIC_BASE_URL is empty', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', '');
    expect(resolveAssetUrl('furniture/sofa-001/model.glb')).toBe(
      '/furniture/sofa-001/model.glb',
    );
  });

  it('returns null for null input', () => {
    expect(resolveAssetUrl(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(resolveAssetUrl(undefined)).toBeNull();
  });

  it('returns null for empty string input', () => {
    expect(resolveAssetUrl('')).toBeNull();
  });
});
