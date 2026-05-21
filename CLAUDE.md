# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run format       # prettier --write .
npm run test         # vitest run (unit + component, node by default; happy-dom per-file)
npm run test:watch   # vitest watch
npm run test:e2e     # playwright (Phase 1 happy path + tour smoke)
npm run verify-deps  # supply-chain checks (plan §16)
npm run ci           # verify-deps + typecheck + lint + test + test:e2e
npm run prisma:generate   # Phase 3
npm run prisma:migrate    # Phase 3
```

Single-test filtering:

```bash
npm test -- src/lib/cost-engine.test.ts        # one file
npm test -- -t "applies contingency"           # by test name pattern
npm run test:e2e -- tests-e2e/happy-path.spec.ts
```

## Install

First install only:

```bash
npm install --ignore-scripts                   # creates lockfile
bash scripts/verify-deps.sh                    # MUST pass before committing lockfile
npm rebuild esbuild @prisma/engines sharp      # allow-listed native builds
```

Going forward, only `npm ci --ignore-scripts` — **never bare `npm install`**, it
would mutate the lockfile and break the §16 supply-chain policy.

## Architecture

The runtime spine is one Zustand store fed by IndexedDB:

- **Guest-mode persistence** — projects live in IndexedDB
  (`src/lib/db/projects.ts` over `idb`), keyed by `nanoid`. Phase 3 mirrors
  to Supabase Postgres via Prisma (`prisma/schema.prisma`).
- **Single shared store** — `src/stores/floor-plan.ts` (`useFloorPlan`) is
  the spine. The `editor`, `tour`, and `estimate` routes all read from it,
  call `loadProject(record)` on mount, and `reset()` on unmount.
- **Pure libs** — `lib/cost-engine`, `lib/recommendation`, `lib/zones`,
  `lib/surfaces`, `lib/tour-transform` are isomorphic and side-effect-free.
  They take store data and return derived values, which is what makes them
  unit-testable in node env.
- **Catalog is dynamic-imported** — `loadCatalog()` lazily fetches
  `src/data/catalog.seed.json` so the seed never lands in the initial bundle.
- **Tour route is `ssr: false` + `React.lazy`** — R3F/three is browser-only
  and heavy; the route in `routes/projects.$projectId.tour.tsx` keeps it
  off the SSR path and out of the initial chunk.

## Discipline

- **TDD for new logic** (plan §17): red-green-refactor for additions to
  `lib/`, `stores/`, `server/`. Phase-1 UI (`routes/`, `components/`) is
  exempt — don't retrofit tests onto it.
- **Component tests** opt into happy-dom per-file via
  `// @vitest-environment happy-dom` at the top of the `.test.tsx`.
  Pure-logic tests stay in node env (faster, no DOM mocks).
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
- **i18n default is `id` (Indonesian)** — UI strings like "Tersimpan" /
  "Memuat…" come from `react-i18next` via `t('…')`. Don't hardcode
  English; add keys to `src/locales/{id,en}/`.
- **Forgot the happy-dom pragma?** `ReferenceError: document is not defined`
  in a `.test.tsx` means the file is running in node — add
  `// @vitest-environment happy-dom` as the first line.
- **Path alias `@/*` → `src/*`** is configured in `tsconfig.json` +
  `vite.config.ts`, but the codebase currently uses relative imports
  throughout. Match neighboring files rather than mixing styles.
- E2E race condition: when navigating between routes that share IDB
  state, wait for the editor's "Tersimpan" indicator before clicking
  away — auto-save is debounced 400ms.
- ESLint allows `console.warn` / `console.error` only; `console.log` is a
  warning. Don't leave debug logs in committed code.

## File layout shortcuts

- Pure libs: `src/lib/` (isomorphic, tested in node env)
- IDB layer: `src/lib/db/` (`idb.ts` opens the DB; `projects.ts` is the CRUD)
- Zustand stores: `src/stores/` (export a `resetForTests()` helper)
- UI components: `src/components/{editor,tour,sidebar,ui}/`
- TanStack routes: `src/routes/` (file-based; nested via `.` in name)
- Catalog seed: `src/data/catalog.seed.json` (dynamic-imported)
- Locales: `src/locales/{id,en}/`
- Tests: `tests/` (vitest), `tests-e2e/` (playwright — excluded from vitest)
