/**
 * Asset URL resolution helper.
 *
 * Resolves a catalog `asset3dUrl` value to a fetch-ready URL:
 *   - null/undefined/empty → null (no asset)
 *   - Already absolute (http/https) or root-relative (/) → return as-is
 *   - Bare key (e.g. "furniture/sofa-001/model.glb"):
 *       • R2_PUBLIC_BASE_URL set → join to form full CDN URL
 *       • R2_PUBLIC_BASE_URL empty → return as root-relative local path (dev mode)
 *
 * Kept as a pure function so tests can stub process.env without side effects.
 *
 * Static-asset path decision: the project has no pre-existing `public/` dir.
 * However, Vite automatically serves files in `public/` at the root URL path,
 * which makes it the simplest convention for assets referenced from runtime
 * data like catalog.seed.json (which cannot use `?url` imports). The Duck GLB
 * is therefore committed to both `src/data/assets/samples/` (as a test fixture)
 * and `public/assets/samples/` (for Vite static serving at `/assets/samples/Duck.glb`).
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
