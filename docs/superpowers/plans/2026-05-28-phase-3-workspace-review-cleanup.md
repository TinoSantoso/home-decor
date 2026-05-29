# Phase 3 Workspace Review and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current broad modified/untracked Phase 3 workspace into a reviewable, low-risk set of product changes while separating local agent/worktree artifacts from app code.

**Architecture:** Treat the current workspace as four tracks: product runtime, product tests, operator/docs/schema, and local workspace artifacts. Product runtime and tests should remain together because billing, ownership, auth continuity, and export gating are cross-cutting Phase 3 behavior. Local artifacts (`worktrees/**`, optional `.agents/**`, optional `skills-lock.json`) should be reviewed separately and either intentionally ignored/kept or removed after explicit approval.

**Tech Stack:** Git, TanStack Start, Vite/Vitest/Playwright, Prisma, Supabase auth, Stripe/Midtrans webhook plumbing, IndexedDB guest persistence.

---

## Current Workspace Classification

### Product runtime changes to review as Phase 3 app work

- `prisma/schema.prisma`
- `prisma.config.ts`
- `prisma/migrations/20260524155109_init/migration.sql`
- `prisma/migrations/20260528112400_project_data_payment_provider_ref/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `src/lib/entitlements.ts`
- `src/lib/project-migration.ts`
- `src/lib/supabase/client.ts`
- `src/server/auth-middleware.ts`
- `src/server/check-entitlement.ts`
- `src/server/checkout.ts`
- `src/server/entitlements-service.server.ts`
- `src/server/entitlements.ts`
- `src/server/generate-pdf.tsx`
- `src/server/payment-webhooks.ts`
- `src/server/projects-service.server.ts`
- `src/server/projects.ts`
- `src/server/users-service.server.ts`
- `src/server/users.ts`
- `src/routes/api.webhooks.midtrans.ts`
- `src/routes/api.webhooks.stripe.ts`
- `src/routes/__root.tsx`
- `src/routes/dashboard.tsx`
- `src/routes/projects.new.tsx`
- `src/routes/projects.$projectId.editor.tsx`
- `src/routes/projects.$projectId.estimate.tsx`
- `src/routes/projects.$projectId.share.$token.tsx`
- `src/routes/projects.$projectId.tour.tsx`
- `src/components/editor/PaywallModal.tsx`
- `src/components/estimate/ExportPdfButton.tsx`
- `src/stores/auth.ts`
- `src/locales/id/common.json`
- `src/locales/en/common.json`
- `vitest.config.ts`

### Product tests to review with runtime changes

- `tests/lib/project-migration.test.ts`
- `tests/server/checkout.test.ts`
- `tests/server/generate-pdf.test.ts`
- `tests/server/payment-webhooks.test.ts`
- `tests/server/projects.test.ts`
- `tests/server/users.test.ts`
- `tests/stores/auth.missing-env.test.ts`

### Operator/docs changes to review separately but keep with Phase 3 unless rejected

- `.env.example`
- `docs/setup-checklist.md`
- `docs/superpowers/plans/2026-05-28-billing-ownership-hardening.md`
- `docs/superpowers/plans/2026-05-28-guest-auth-continuity-release-hardening.md`
- `docs/superpowers/plans/2026-05-28-payment-webhooks-project-ownership.md`
- `docs/superpowers/plans/2026-05-28-phase-3-workspace-review-cleanup.md`
- `CLAUDE.md`

### Local artifacts requiring explicit decision before staging

- `.agents/skills/using-superpowers/SKILL.md`
- `skills-lock.json`
- `worktrees/feature-entitlement/**`

Recommendation: do not stage `worktrees/feature-entitlement/**`. Either add `worktrees/` to `.gitignore` or remove the directory after confirming no work inside it is needed. Treat `.agents/**` and `skills-lock.json` as project-process files; include only if you want this repo to carry those agent instructions.

---

### Task 1: Produce a stable review inventory

**Files:**
- Read-only: full workspace
- Output: terminal only

- [ ] **Step 1: Capture short status grouped by tracked and untracked files**

Run:

```bash
git status --short
```

Expected: status still shows the Phase 3 product files plus local artifacts. Do not stage anything in this step.

- [ ] **Step 2: Capture tracked diff summary**

Run:

```bash
git diff --stat
```

Expected: tracked modifications are mostly route/UI/docs/schema/config changes. Untracked files do not appear in this stat.

- [ ] **Step 3: Capture untracked file inventory without dumping nested worktree contents into the review**

Run:

```bash
git ls-files --others --exclude-standard | sed '/^worktrees\//d' | sort
```

Expected: output includes Phase 3 source/test/docs files and maybe `.agents/skills/using-superpowers/SKILL.md` plus `skills-lock.json`, but not the nested `worktrees/feature-entitlement/**` file list.

---

### Task 2: Keep product changes and local artifacts separate

**Files:**
- Modify only if approved: `.gitignore`
- Do not modify without explicit approval: `worktrees/feature-entitlement/**`, `.agents/**`, `skills-lock.json`

- [x] **Step 1: Confirm nested worktree provenance**

Run:

```bash
git -C worktrees/feature-entitlement status --short
```

Expected: if this is a valid nested worktree, git reports its own state. If it fails, treat `worktrees/feature-entitlement/**` as an ordinary untracked directory and do not delete it without confirmation.

Result: `worktrees/feature-entitlement` was a registered worktree on merged branch `feature/entitlement`. Its one useful untracked test was preserved as `tests/server/entitlements.test.ts`, then the worktree and merged branch were removed.

- [x] **Step 2: Recommend ignoring `worktrees/` from this repository status**

If the user approves ignoring local worktrees, modify `.gitignore` by adding `worktrees/` under the existing worktree section:

```gitignore
# Git worktrees (subagent-driven dev branches)
.worktrees/
worktrees/
```

- [x] **Step 3: Verify worktree noise disappears from normal status**

Run:

```bash
git status --short | rg '^\?\? worktrees/' || true
```

Expected after `.gitignore` update: no output.

- [x] **Step 4: Decide whether `.agents/**` and `skills-lock.json` are product process files**

Use this rule:

```text
Keep .agents/** and skills-lock.json only if the repository should version local Amp/Claude skill configuration for all future agents.
Otherwise leave them unstaged or add a separate ignore rule after user approval.
```

Expected: explicit user decision before staging either path.

Decision: approved for versioning as project process files.

---

### Task 3: Review Phase 3 product runtime as one coherent slice

**Files:**
- Review: files listed in “Product runtime changes to review as Phase 3 app work”

- [ ] **Step 1: Review auth middleware and server-only split**

Run:

```bash
git diff -- src/server/auth-middleware.ts src/server/users.ts src/server/users-service.server.ts src/server/projects.ts src/server/projects-service.server.ts src/server/entitlements.ts src/server/entitlements-service.server.ts
```

Expected review conclusions:
- `serverAuthMiddleware` validates Supabase sessions with `getUser()` after reading request cookies.
- Prisma clients are lazy-loaded from `*.server.ts` files using `createRequire` so browser bundles do not import Prisma.
- `ensureUser` is called before creating/importing owned projects or checkout metadata.

- [ ] **Step 2: Review billing/webhook/entitlement flow**

Run:

```bash
git diff -- src/lib/entitlements.ts src/server/check-entitlement.ts src/server/checkout.ts src/server/generate-pdf.tsx src/server/payment-webhooks.ts src/routes/api.webhooks.stripe.ts src/routes/api.webhooks.midtrans.ts src/components/estimate/ExportPdfButton.tsx src/components/editor/PaywallModal.tsx
```

Expected review conclusions:
- Stripe checkout requires `STRIPE_SECRET_KEY` and `STRIPE_UNLIMITED_PRICE_ID` only when checkout starts.
- Stripe and Midtrans webhooks verify signatures and de-duplicate by provider reference.
- Authenticated PDF export uses server-side entitlement checks; guest/share paths remain usable.
- Paywall UI exposes loading/error state for checkout startup failures.

- [ ] **Step 3: Review ownership and guest continuity routes**

Run:

```bash
git diff -- src/routes/__root.tsx src/routes/dashboard.tsx src/routes/projects.new.tsx src/routes/projects.$projectId.editor.tsx src/routes/projects.$projectId.estimate.tsx src/routes/projects.$projectId.tour.tsx src/routes/projects.$projectId.share.$token.tsx src/lib/project-migration.ts src/stores/auth.ts src/lib/supabase/client.ts
```

Expected review conclusions:
- Guests still use IndexedDB for dashboard/new/editor/estimate/tour/share.
- Authenticated users use owned cloud CRUD server functions.
- Local projects are copied to cloud after sign-in without deleting local data.
- Missing browser Supabase env hydrates as signed out instead of crashing guest pages.
- Share links try cloud first, then fall back to local token validation when cloud lookup fails.

---

### Task 4: Review schema, migrations, and Prisma 7 config

**Files:**
- Review: `prisma/schema.prisma`
- Review: `prisma.config.ts`
- Review: `prisma/migrations/**`

- [ ] **Step 1: Inspect schema changes**

Run:

```bash
git diff -- prisma/schema.prisma
```

Expected review conclusions:
- `Project.data Json?` exists so cloud project rows can preserve the full `ProjectRecord` shape.
- `Payment` has `@@unique([provider, providerRef])` so webhook idempotency has a database guard.

- [ ] **Step 2: Inspect migration SQL**

Run:

```bash
sed -n '1,220p' prisma/migrations/20260524155109_init/migration.sql
sed -n '1,220p' prisma/migrations/20260528112400_project_data_payment_provider_ref/migration.sql
```

Expected review conclusions:
- Initial migration matches the intended Phase 3 schema.
- Follow-up migration adds project JSON data and payment provider-reference uniqueness.

- [ ] **Step 3: Inspect Prisma config**

Run:

```bash
cat prisma.config.ts
```

Expected review conclusions:
- Prisma config reads `DATABASE_URL` and `DIRECT_URL` through `prisma/config`.
- No secret value is committed.

---

### Task 5: Review docs and environment instructions

**Files:**
- Review: `.env.example`
- Review: `docs/setup-checklist.md`
- Review: `CLAUDE.md`
- Review: `docs/superpowers/plans/*.md`

- [ ] **Step 1: Verify env example contains variable names only**

Run:

```bash
nl -ba .env.example | sed -n '33,45p'
```

Expected: billing section includes these names and no real secret values:

```env
APP_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_UNLIMITED_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
MIDTRANS_SERVER_KEY=
XENDIT_SECRET_KEY=
```

- [ ] **Step 2: Verify operator checklist matches deferred-secret policy**

Run:

```bash
sed -n '1,80p' docs/setup-checklist.md
```

Expected: checklist tells the operator to fill Stripe/Midtrans values manually after app flows are complete.

- [ ] **Step 3: Decide whether to keep `CLAUDE.md` env-var additions**

Run:

```bash
git diff -- CLAUDE.md
```

Recommended decision: keep only if these instructions are useful long-term for agents. If kept, add missing `STRIPE_SECRET_KEY`, `STRIPE_UNLIMITED_PRICE_ID`, and `APP_ORIGIN` so it matches `.env.example` and `docs/setup-checklist.md`.

---

### Task 6: Review tests and run focused verification

**Files:**
- Review: `tests/lib/project-migration.test.ts`
- Review: `tests/stores/auth.missing-env.test.ts`
- Review: `tests/server/*.test.ts`

- [ ] **Step 1: Inspect focused tests**

Run:

```bash
git diff -- tests/lib/project-migration.test.ts tests/stores/auth.missing-env.test.ts tests/server/checkout.test.ts tests/server/generate-pdf.test.ts tests/server/payment-webhooks.test.ts tests/server/projects.test.ts tests/server/users.test.ts
```

Expected review conclusions:
- Project import preserves local IDs and ownership.
- Auth store does not throw when browser Supabase env is absent.
- Webhook tests cover signature rejection, duplicate events, Stripe grants, and Midtrans grants.
- Checkout test covers metadata creation.
- Generate-PDF tests cover entitlement/paywall behavior.

- [ ] **Step 2: Run focused unit/server tests**

Run:

```bash
npm test -- tests/lib/share-token.test.ts tests/lib/project-migration.test.ts tests/stores/auth.missing-env.test.ts tests/server/projects.test.ts tests/server/users.test.ts tests/server/payment-webhooks.test.ts tests/server/checkout.test.ts tests/server/generate-pdf.test.ts
```

Expected: all listed test files pass and Vitest output does not include files under `worktrees/`.

- [ ] **Step 3: Run repository checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0. Vite may warn about large chunks; that warning is already present and is not a failure.

- [ ] **Step 4: Run guest/e2e smoke**

Run:

```bash
npm run test:e2e -- tests-e2e/happy-path.spec.ts
```

Expected: all happy-path tests pass, including guest project creation and read-only share link rendering.

---

### Task 7: Prepare review staging without committing local artifacts

**Files:**
- Stage: product runtime files, product tests, docs/operator files accepted by user
- Do not stage unless approved: `.agents/**`, `skills-lock.json`, `worktrees/**`

- [ ] **Step 1: Stage only Phase 3 product files after review approval**

Run this only after the user approves the reviewed Phase 3 product slice:

```bash
git add \
  .env.example \
  docs/setup-checklist.md \
  docs/superpowers/plans/2026-05-28-billing-ownership-hardening.md \
  docs/superpowers/plans/2026-05-28-guest-auth-continuity-release-hardening.md \
  docs/superpowers/plans/2026-05-28-payment-webhooks-project-ownership.md \
  docs/superpowers/plans/2026-05-28-phase-3-workspace-review-cleanup.md \
  prisma.config.ts \
  prisma/schema.prisma \
  prisma/migrations \
  src/components/editor/PaywallModal.tsx \
  src/components/estimate/ExportPdfButton.tsx \
  src/lib/entitlements.ts \
  src/lib/project-migration.ts \
  src/lib/supabase/client.ts \
  src/routes/__root.tsx \
  src/routes/api.webhooks.midtrans.ts \
  src/routes/api.webhooks.stripe.ts \
  src/routes/dashboard.tsx \
  src/routes/projects.new.tsx \
  src/routes/projects.\$projectId.editor.tsx \
  src/routes/projects.\$projectId.estimate.tsx \
  src/routes/projects.\$projectId.share.\$token.tsx \
  src/routes/projects.\$projectId.tour.tsx \
  src/server/auth-middleware.ts \
  src/server/check-entitlement.ts \
  src/server/checkout.ts \
  src/server/entitlements-service.server.ts \
  src/server/entitlements.ts \
  src/server/generate-pdf.tsx \
  src/server/payment-webhooks.ts \
  src/server/projects-service.server.ts \
  src/server/projects.ts \
  src/server/users-service.server.ts \
  src/server/users.ts \
  src/stores/auth.ts \
  src/locales/en/common.json \
  src/locales/id/common.json \
  tests/lib/project-migration.test.ts \
  tests/server/checkout.test.ts \
  tests/server/generate-pdf.test.ts \
  tests/server/payment-webhooks.test.ts \
  tests/server/projects.test.ts \
  tests/server/users.test.ts \
  tests/stores/auth.missing-env.test.ts \
  vitest.config.ts
```

Expected: staged files are product/runtime/test/docs only. If `.gitignore` is updated in Task 2, add `.gitignore` too.

- [ ] **Step 2: Inspect staged diff before commit or PR**

Run:

```bash
git diff --cached --stat
git diff --cached --name-only | sort
```

Expected: no `worktrees/` paths. `.agents/` and `skills-lock.json` appear only if the user explicitly approved them.

- [ ] **Step 3: Keep local artifacts unstaged**

Run:

```bash
git diff --cached --name-only | rg '^(worktrees/|\.agents/|skills-lock\.json$)' || true
```

Expected: no output unless the user explicitly approved those process files.

---

## Recommended Review Order

1. Review Task 2 artifact policy first because it decides whether `worktrees/`, `.agents/`, and `skills-lock.json` belong in source control.
2. Review Task 3 runtime behavior next because it is the product surface users will experience.
3. Review Task 4 schema/migrations before any deployment because database shape is the hardest part to undo.
4. Review Task 5 docs/env consistency so manual secret setup is clear.
5. Run Task 6 verification after any review edits.
6. Use Task 7 only after explicit approval to stage or commit.

## Self-Review Notes

- This plan does not delete, revert, or stage any existing workspace changes.
- This plan intentionally excludes `worktrees/feature-entitlement/**` from product staging.
- The only recommended implementation change before staging is optional: add `worktrees/` to `.gitignore` after approval.
- Secrets remain manual and deferred: `STRIPE_SECRET_KEY`, `STRIPE_UNLIMITED_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `MIDTRANS_SERVER_KEY`, and optional deployed `APP_ORIGIN`.
