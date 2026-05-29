# Phase 0 Setup Checklist

Items only you (the operator) can do — accounts, secrets, and external infra.
Tick each off as you go.

## Local

- [ ] Install Node 24.15 (project's `.nvmrc`): `nvm install 24.15 && nvm use`
- [ ] Verify: `node --version` prints `v24.15.x` and `npm --version` ≥ 11
- [ ] **Review `package.json` pinned versions** against npm + the TanStack changelog before first install
- [ ] First install: `npm install --ignore-scripts` (creates `package-lock.json`)
- [ ] Allow-list legitimate native builds: `npm rebuild esbuild @prisma/engines sharp` (only after lockfile is committed and reviewed)
- [ ] Run: `bash scripts/verify-deps.sh` — must pass before first commit of `package-lock.json`
- [ ] `cp .env.example .env` and fill values as the rest of the checklist proceeds

## Supabase (DB + Auth)

- [ ] Create project at https://supabase.com — region: Singapore (closest to ID)
- [ ] Project → Settings → Database → copy pooled + direct connection strings → `DATABASE_URL` + `DIRECT_URL`
- [ ] Project → Settings → API → copy `URL`, `anon`, `service_role` → `.env`
- [ ] Auth → Providers → enable Email (default) and Google OAuth (add client ID + secret)
- [ ] Auth → URL configuration → add `http://localhost:3000` and final domain to allowed redirects
- [ ] Run: `npm run prisma:migrate -- --name init` to create tables

## Billing Providers (fill after app flows are complete)

- [ ] Stripe Dashboard → Developers → API keys → copy secret key to `STRIPE_SECRET_KEY`.
- [ ] Stripe Dashboard → Product catalog → create the unlimited monthly price → copy price id to `STRIPE_UNLIMITED_PRICE_ID`.
- [ ] Stripe Dashboard → Developers → Webhooks → create endpoint `/api/webhooks/stripe` → copy signing secret to `STRIPE_WEBHOOK_SECRET`.
- [ ] Midtrans Dashboard → Settings → Access Keys → copy server key to `MIDTRANS_SERVER_KEY`.
- [ ] Set `APP_ORIGIN` to the deployed app origin; locally use `http://localhost:3000`.

## Cloudflare R2 (Storage — free tier)

- [ ] Create Cloudflare account (free plan)
- [ ] R2 → Create bucket `hdt-assets` (region: APAC)
- [ ] R2 → Create bucket `hdt-user`
- [ ] R2 → Manage R2 API Tokens → create a token with Object Read & Write on both buckets → `.env`
- [ ] `hdt-assets` → Settings → Public access → connect a custom domain (e.g. `assets.<yourdomain>`) — free on the Cloudflare free plan
- [ ] Add `R2_PUBLIC_BASE_URL=https://assets.<yourdomain>` to `.env`
- [ ] Configure CORS on `hdt-assets`: allow your app origin, methods `GET, HEAD, PUT`, headers `Content-Type, Range`, expose `Content-Length`
- [ ] Verify storage budget vs §12 R2 budget table — re-check quarterly

## GitHub + Vercel + Socket.dev

- [ ] Create private repo, push `main`
- [ ] Branch protection on `main`: require PR review, require status checks (`verify`), no force push
- [ ] Vercel → Import project → framework preset: "Other" (Vite) → build command `npm run build`, output `.output/public`
- [ ] Vercel → Environment Variables → paste everything from `.env` (use Preview + Production scopes)
- [ ] Install **Socket.dev** GitHub app on the repo (free tier) → review the initial dependency tree report
- [ ] Enable Dependabot (Security tab → enable security updates)
- [ ] Add `NPM_TOKEN` for CI **only if** we ever publish — otherwise omit

## Acceptance check (end of Phase 0)

Reviewer can answer "yes" to all:

- [ ] Every TanStack package in `package.json` is exact-pinned (no `^` or `~`).
- [ ] `bash scripts/verify-deps.sh` passes locally.
- [ ] CI workflow runs verify-deps + typecheck + lint + test green on a PR.
- [ ] Socket.dev has reviewed the initial dependency tree with no high-severity flags.
- [ ] `npm config get ignore-scripts` returns `true`.
- [ ] `docs/runbooks/dep-rollback.md` exists.
- [ ] Vercel preview URL boots the landing page; locale toggle works.
- [ ] Supabase migration applied; you can sign in with email or Google in the deployed preview.
