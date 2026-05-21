# Sample 3D assets

CC0 sample models from [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets).
Served via Vite's `public/` directory at the URL root, so each file is
fetchable at `/assets/samples/<filename>` in both dev and production builds.

- `Duck.glb` — Khronos Duck, CC0 public domain.
  Source: `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb`

## Note: duck-as-sofa demo

The `sofa-modular-japandi` catalog item has `asset3dUrl` set to
`/assets/samples/Duck.glb` for demo purposes. It looks funny (a rubber duck
where a sofa should be) but proves the GLB loading mechanism end-to-end.
Replace with a real sofa asset when the catalog asset pipeline ships.
