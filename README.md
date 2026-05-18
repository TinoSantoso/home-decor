# Tur Dekorasi Rumah

3D home-decor and renovation planner for the Indonesian market. Web-first, IDR-priced, climate-aware.

Plan: `~/.claude/plans/ultraplan-cannot-launch-remote-curious-biscuit.md`

## Tech

- **TanStack Start + TanStack Router** (Vite + TypeScript)
- **react-three-fiber + drei** for the 3D tour
- **Tailwind 4 + shadcn/ui** for UI
- **Prisma + Supabase Postgres** for data, **Supabase Auth** (Email + Google)
- **Cloudflare R2** for storage (free tier)
- **i18next** for `id` / `en`

## Status

Phase 0 — scaffold + supply-chain controls. Not yet installed.

## Setup

See [`docs/setup-checklist.md`](docs/setup-checklist.md).

Quick start once accounts exist and `.env` is filled:

```bash
nvm use                                # picks Node 24.15 via .nvmrc
npm install --ignore-scripts           # FIRST install only — creates lockfile
bash scripts/verify-deps.sh            # MUST pass before committing lockfile
npm rebuild esbuild @prisma/engines sharp   # allow-listed native builds
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev                            # http://localhost:3000
```

Going forward, only `npm ci --ignore-scripts` — never bare `npm install` (would mutate the lockfile).

## Supply-chain policy

Short version (full plan in §16 of the linked plan):

- Exact-pinned versions in `package.json`; no `^` / `~`.
- `ignore-scripts=true` globally; explicit `npm rebuild` for trusted natives.
- 7-day cooling-off before bumping any TanStack release (unless security fix).
- `bash scripts/verify-deps.sh` runs in CI; must pass before merge.
- Compromise response: [`docs/runbooks/dep-rollback.md`](docs/runbooks/dep-rollback.md).

## Layout

```
src/
  routes/         TanStack Router file routes
  server/         TanStack Start server functions (Phase 1+)
  components/     UI (tour/, editor/, sidebar/, ui/)
  lib/            cost-engine, recommendation, climate, currency, i18n
  locales/        id, en JSON
  styles/         Tailwind 4 CSS-first config
prisma/           schema.prisma + migrations
tests/            unit + golden-file
scripts/          verify-deps.sh, compress-glb.ts (Phase 2), seed-catalog.ts
docs/             setup-checklist, runbooks
.github/          CI workflow
```
