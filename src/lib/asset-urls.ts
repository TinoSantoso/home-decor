/**
 * Resolves a catalog `asset3dUrl` to a fetch-ready URL.
 *   - null/undefined/empty → null
 *   - http/https/root-relative → returned as-is
 *   - bare key + R2_PUBLIC_BASE_URL set → joined into a full CDN URL
 *   - bare key + R2_PUBLIC_BASE_URL empty → root-relative path (dev mode)
 */

export function resolveAssetUrl(asset3dUrl: string | null | undefined): string | null {
  if (!asset3dUrl) return null;

  // Already a usable URL or root-relative path — pass through unchanged.
  if (
    asset3dUrl.startsWith('http://') ||
    asset3dUrl.startsWith('https://') ||
    asset3dUrl.startsWith('/')
  ) {
    return asset3dUrl;
  }

  // Bare key: join with R2 base URL or fall back to root-relative dev path.
  const base = process.env['R2_PUBLIC_BASE_URL'] ?? '';
  if (base) {
    const trimmedBase = base.replace(/\/$/, '');
    return `${trimmedBase}/${asset3dUrl}`;
  }

  // Dev/test mode: serve as root-relative path so Vite can handle it.
  return `/${asset3dUrl}`;
}
