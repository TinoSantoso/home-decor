# Tur Dekorasi Rumah — Home Decor Tour App

Web-first 3D home decor planner for the Indonesian market (IDR). TanStack
Start + Vite + Tailwind 4 + Konva (2D editor) + R3F (3D tour) + Zustand +
IndexedDB (guest mode) + Prisma (Supabase Postgres for Phase 3 auth/cloud).

The full plan lives at:
`~/.claude/plans/ultraplan-cannot-launch-remote-curious-biscuit.md`

## Commands

```bash
npm run dev          # vite dev on :3000
npm run build        # production build + regenerates src/routeTree.gen.ts
npm run typecheck    # tsc --noEmit (strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess)
npm run lint         # eslint
npm run test         # vitest (unit + component, with happy-dom for .test.tsx)
npm run test:e2e     # playwright (Phase 1 happy path + tour smoke)
npm run verify-deps  # supply-chain checks (plan §16)
npm run ci           # verify-deps + typecheck + lint + test + test:e2e
```

## Discipline

- **TDD from Phase 2 onward** (plan §17): red-green-refactor for new
  `lib/`, `stores/`, `server/`. Component tests (`*.test.tsx`) opt into
  happy-dom via `// @vitest-environment happy-dom` per-file pragma.
  Pre-existing Phase 1 UI is NOT retrofitted with tests.
- **Supply-chain** (plan §16): every new dep exact-pinned, past ≥7-day
  cooling-off, `npm run verify-deps` must stay green. `ignore-scripts`
  enforced via `.npmrc`. Lockfile changes require justification.

## Gotchas

- `routeTree.gen.ts` is gitignored — TanStack Router's plugin regenerates
  it on `npm run dev` / `npm run build`. If typecheck fails after adding
  a new route file, run `npm run build` to refresh the route tree.
- The router export must be named `getRouter()`, not `createRouter()`
  (TanStack Start 1.168+ convention).
- **Zustand selector pitfall**: never call `.filter()` / `.map()` inside
  a selector — returning a fresh array on every render breaks React's
  `getSnapshot` cache and trips "Maximum update depth exceeded". Select
  the raw slice and derive with `useMemo`.
- `exactOptionalPropertyTypes: true` is on — don't pass `undefined`
  explicitly for an optional field; use conditional spread `...(cond ? { key: val } : {})`.
- `noUncheckedIndexedAccess: true` is on — use `?? default` when reading
  `Record<K, V>` with a typed key, or after `.find()`.
- Three.js color parser doesn't understand CSS `oklch()` strings even
  though the rest of the app uses them. Pass hex to R3F/three props.
- E2E race condition: when navigating between routes that share IDB
  state, wait for the editor's "Tersimpan" indicator before clicking
  away — auto-save is debounced 400ms.

## File layout shortcuts

- Pure libs: `src/lib/` (isomorphic, tested in node env)
- Zustand stores: `src/stores/` (export a `resetForTests()` helper)
- UI components: `src/components/{editor,tour,sidebar,ui}/`
- TanStack routes: `src/routes/` (file-based; nested via `.` in name)
- Catalog seed: `src/data/catalog.seed.json` (dynamic-imported)
- Tests: `tests/` (vitest), `tests-e2e/` (playwright)
