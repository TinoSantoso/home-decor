# Sample 3D assets

CC0 sample models from [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets).
Used as test fixtures and development demos. Safe to redistribute.

- `Duck.glb` — Khronos Duck, CC0 public domain.
  Source: `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb`

## Static-asset path decision

This copy (`src/data/assets/samples/Duck.glb`) is the **test fixture** — used
by vitest unit tests. It is not served to the browser from this location.

The same file is also committed to `public/assets/samples/Duck.glb`. Vite
automatically serves the `public/` directory at the root URL path, so the GLB
is available at `/assets/samples/Duck.glb` during dev and in production builds.
This is necessary because `catalog.seed.json` is runtime JSON data and cannot
use Vite `?url` imports.

## Note: duck-as-sofa

The `sofa-modular-japandi` catalog item has `asset3dUrl` set to
`/assets/samples/Duck.glb` for development demo purposes. This looks funny
(a rubber duck where a sofa should be) but proves the GLB loading mechanism.
Replace with a real sofa asset when available.
