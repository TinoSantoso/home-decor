# Guest/Auth Continuity and Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a coherent guest-to-auth product path while hardening test discovery, checkout failure UX, operator docs, and release verification.

**Architecture:** Keep the current dual persistence model: unauthenticated users use IndexedDB, authenticated users use Prisma-backed cloud project server functions. Add a small migration service that copies local projects to the cloud after sign-in without deleting local data, and keep server functions as the source of truth for owned projects. UI changes stay route-local except for one reusable migration helper and one small auth-store flag.

**Tech Stack:** TanStack Start routes/server functions, Zustand auth/floor-plan stores, IndexedDB project helpers, Prisma-backed project server functions, Vitest, Playwright, i18next.

---

## File Structure

- Modify `vitest.config.ts` — exclude the checked-in `worktrees/**` directory from test discovery.
- Modify `src/routes/dashboard.tsx` — allow guest users to see local IndexedDB projects instead of redirecting away.
- Modify `src/routes/projects.new.tsx` — allow guest users to create local IndexedDB projects instead of redirecting away.
- Create `src/lib/project-migration.ts` — pure helper for planning local-to-cloud project copies.
- Create `tests/lib/project-migration.test.ts` — unit tests for migration planning and duplicate filtering.
- Modify `src/server/projects.ts` — add `importProject` to the existing project service and expose `importOwnedProjectFn` alongside the other owned-project server functions.
- Modify `tests/server/projects.test.ts` — service-level test for import semantics.
- Modify `src/routes/__root.tsx` — after auth hydration, offer/trigger local project import when local guest projects exist.
- Modify `src/components/editor/PaywallModal.tsx` — expose upgrade loading/error state.
- Modify `src/routes/projects.$projectId.estimate.tsx` — show checkout startup errors inside the paywall modal.
- Modify `.env.example` and `docs/setup-checklist.md` — document billing/runtime variables without requiring the user to fill secrets now.
- Modify `tests-e2e/happy-path.spec.ts` — keep guest share test aligned with restored guest mode and add an auth-gating smoke if practical.

---

### Task 1: Fix test discovery hygiene

**Files:**
- Modify: `vitest.config.ts`

- [x] **Step 1: Run the focused test and observe the current pollution**

Run:

```bash
npm test -- tests/lib/share-token.test.ts
```

Expected before the fix: output may include both `tests/lib/share-token.test.ts` and `worktrees/feature-entitlement/tests/lib/share-token.test.ts`, proving the nested worktree is still in Vitest's search space.

- [x] **Step 2: Add `worktrees/**` to Vitest excludes**

In `vitest.config.ts`, update the `exclude` list to include `worktrees/**`:

```ts
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests-e2e/**',
      '.worktrees/**',
      '.claude/worktrees/**',
      'worktrees/**',
    ],
```

- [x] **Step 3: Verify focused test no longer discovers nested worktree tests**

Run:

```bash
npm test -- tests/lib/share-token.test.ts
```

Expected after the fix: only `tests/lib/share-token.test.ts` is listed, and all tests pass.

---

### Task 2: Restore guest dashboard/new-project access

**Files:**
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/projects.new.tsx`

- [x] **Step 1: Update dashboard loading policy**

In `src/routes/dashboard.tsx`, remove the effect that redirects unauthenticated users to `/`. Keep the existing dual data source:

```ts
  useEffect(() => {
    if (loading) return;
    void (isAuthenticated ? listOwnedProjectsFn() : listProjects()).then(setProjects);
  }, [isAuthenticated, loading]);
```

Update the loading guard so guests can render after auth hydration:

```ts
  if (loading) return null;
```

- [x] **Step 2: Update new-project loading policy**

In `src/routes/projects.new.tsx`, remove the redirect/open-auth-modal effect. Keep the existing creation branch:

```ts
      const project = isAuthenticated
        ? await createOwnedProjectFn({ data: input })
        : await createProject(input);
```

Update the loading guard:

```ts
  if (loading) return null;
```

- [x] **Step 3: Run typecheck for route consistency**

Run:

```bash
npm run typecheck
```

Expected: PASS.

---

### Task 3: Add pure migration planning for local projects

**Files:**
- Create: `src/lib/project-migration.ts`
- Create: `tests/lib/project-migration.test.ts`

- [x] **Step 1: Write failing migration planning tests**

Create `tests/lib/project-migration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ProjectRecord } from '../../src/lib/db/types';
import { planLocalProjectImports } from '../../src/lib/project-migration';

const baseProject: ProjectRecord = {
  id: 'local-1',
  name: 'Rumah Lokal',
  templateId: 'rumah-tapak-t36',
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  styleTag: null,
  floorPlanImageUrl: null,
  shareToken: null,
  shareTokenExpiry: null,
  zones: [],
  placedItems: [],
  createdAt: 1,
  updatedAt: 2,
};

describe('planLocalProjectImports', () => {
  it('returns local projects missing from cloud by id', () => {
    expect(
      planLocalProjectImports({
        localProjects: [baseProject, { ...baseProject, id: 'local-2' }],
        cloudProjects: [{ ...baseProject, id: 'local-1' }],
      }).map((project) => project.id),
    ).toEqual(['local-2']);
  });

  it('returns an empty list when all local projects already exist in cloud', () => {
    expect(
      planLocalProjectImports({
        localProjects: [baseProject],
        cloudProjects: [baseProject],
      }),
    ).toEqual([]);
  });
});
```

- [x] **Step 2: Run red test**

Run:

```bash
npm test -- tests/lib/project-migration.test.ts
```

Expected: FAIL because `src/lib/project-migration.ts` does not exist.

- [x] **Step 3: Implement pure migration planning helper**

Create `src/lib/project-migration.ts`:

```ts
import type { ProjectRecord } from './db/types';

export function planLocalProjectImports({
  localProjects,
  cloudProjects,
}: {
  localProjects: ProjectRecord[];
  cloudProjects: ProjectRecord[];
}): ProjectRecord[] {
  const cloudIds = new Set(cloudProjects.map((project) => project.id));
  return localProjects.filter((project) => !cloudIds.has(project.id));
}
```

- [x] **Step 4: Verify green test**

Run:

```bash
npm test -- tests/lib/project-migration.test.ts
```

Expected: PASS.

---

### Task 4: Add authenticated local-project import server function

**Files:**
- Create: `src/server/project-import.ts`
- Modify: `src/server/projects.ts`
- Test: `tests/server/projects.test.ts`

- [x] **Step 1: Write failing service test for preserving imported project ids**

Add this test to `tests/server/projects.test.ts` inside `describe('createProjectService', ...)`:

```ts
  it('imports a local project for the current user while preserving its id', async () => {
    vi.mocked(db.project.findFirst).mockResolvedValue(null);
    vi.mocked(db.project.create).mockResolvedValue(row({ data: record({ id: 'local-1' }) }));
    const service = createProjectService(db, { now: () => now });

    const result = await service.importProject('user-1', record({ id: 'local-1' }));

    expect(result?.id).toBe('local-1');
    expect(db.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'local-1',
        userId: 'user-1',
        data: expect.objectContaining({ id: 'local-1' }),
      }),
    });
  });
```

- [x] **Step 2: Run red test**

Run:

```bash
npm test -- tests/server/projects.test.ts
```

Expected: FAIL because `ProjectService.importProject` does not exist.

- [x] **Step 3: Add `importProject` to `ProjectService`**

In `src/server/projects.ts`, add to the interface:

```ts
  importProject(userId: string, record: ProjectRecord): Promise<ProjectRecord | null>;
```

Add implementation after `createProject`:

```ts
    async importProject(userId, record) {
      const existing = await db.project.findFirst({
        where: { id: record.id, userId },
      });
      if (existing) return recordFromRow(existing);

      const updated = toStoredRecord(
        normalizeProjectRecord(projectRecordSchema.parse(record)),
        getNow().getTime(),
      );
      const row = await db.project.create({
        data: {
          id: updated.id,
          userId,
          currency: 'IDR',
          ...toProjectColumns(updated),
        },
      });
      return recordFromRow(row);
    },
```

- [x] **Step 4: Add authenticated server function**

In `src/server/projects.ts`, add near the other server functions:

```ts
export const importOwnedProjectFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(projectRecordSchema)
  .handler(async ({ context, data }) => {
    const userId = requireUserId(context.session);
    const { ensureUser } = await import('./users');
    await ensureUser({
      id: userId,
      ...(context.session?.user.email ? { email: context.session.user.email } : {}),
    });
    const service = await getProjectService();
    return service.importProject(userId, normalizeProjectRecord(data));
  });
```

- [x] **Step 5: Verify projects tests**

Run:

```bash
npm test -- tests/server/projects.test.ts
```

Expected: PASS.

---

### Task 5: Wire sign-in local-to-cloud migration

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/locales/id/common.json`
- Modify: `src/locales/en/common.json`

- [x] **Step 1: Add migration state and imports**

In `src/routes/__root.tsx`, import local/cloud project helpers:

```ts
import { listProjects } from '../lib/db/projects';
import { planLocalProjectImports } from '../lib/project-migration';
import { importOwnedProjectFn, listOwnedProjectsFn } from '../server/projects';
```

Also import `useState` from React:

```ts
import { Suspense, type ReactNode, useEffect, useState } from 'react';
```

Inside `RootShell`, add:

```ts
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
```

- [x] **Step 2: Add one-time migration effect**

In `RootShell`, after auth-state hydration effects, add:

```ts
  useEffect(() => {
    if (loading || !isAuthenticated || migrationStatus !== 'idle') return;
    void (async () => {
      try {
        const [localProjects, cloudProjects] = await Promise.all([
          listProjects(),
          listOwnedProjectsFn(),
        ]);
        const projectsToImport = planLocalProjectImports({ localProjects, cloudProjects });
        if (projectsToImport.length === 0) {
          setMigrationStatus('done');
          return;
        }
        setMigrationStatus('importing');
        await Promise.all(
          projectsToImport.map((project) => importOwnedProjectFn({ data: project })),
        );
        setMigrationStatus('done');
      } catch (error) {
        console.error('Local project import failed:', error);
        setMigrationStatus('error');
      }
    })();
  }, [isAuthenticated, loading, migrationStatus]);
```

- [x] **Step 3: Render a small status bar for migration outcomes**

Below the authenticated nav bar in `RootShell`, add:

```tsx
      {migrationStatus === 'importing' && (
        <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-2 text-center text-sm text-[color:var(--color-text-muted)]">
          {t('migration.importing')}
        </div>
      )}

      {migrationStatus === 'error' && (
        <div role="alert" className="border-b border-[color:var(--color-danger)] bg-[color:var(--color-surface)] px-6 py-2 text-center text-sm text-[color:var(--color-danger)]">
          {t('migration.error')}
        </div>
      )}
```

- [x] **Step 4: Add locale keys**

Add to `src/locales/id/common.json`:

```json
  "migration": {
    "importing": "Menyalin proyek lokal ke akun cloud…",
    "error": "Sebagian proyek lokal belum tersalin. Coba muat ulang setelah koneksi stabil."
  }
```

Add to `src/locales/en/common.json`:

```json
  "migration": {
    "importing": "Copying local projects to your cloud account…",
    "error": "Some local projects were not copied. Try refreshing when your connection is stable."
  }
```

- [x] **Step 5: Verify typecheck and lint**

Run:

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

---

### Task 6: Improve checkout startup error UX

**Files:**
- Modify: `src/components/editor/PaywallModal.tsx`
- Modify: `src/routes/projects.$projectId.estimate.tsx`
- Modify: `src/locales/id/common.json`
- Modify: `src/locales/en/common.json`

- [x] **Step 1: Add modal props for upgrade status**

In `src/components/editor/PaywallModal.tsx`, extend props:

```ts
  upgradeLoading?: boolean;
  upgradeError?: string | null;
```

Destructure them with defaults:

```ts
  upgradeLoading = false,
  upgradeError = null,
```

- [x] **Step 2: Render upgrade errors and disable duplicate clicks**

In the authenticated no-credits section, add before the upgrade button:

```tsx
              {upgradeError && (
                <p role="alert" className="text-xs text-[color:var(--color-danger)]">
                  {upgradeError}
                </p>
              )}
```

Update the upgrade button:

```tsx
              <button
                type="button"
                disabled={upgradeLoading}
                onClick={onUpgrade}
                className="w-full rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {upgradeLoading ? t('paywall.checkoutStarting') : t('paywall.ctaUpgrade')}
              </button>
```

- [x] **Step 3: Catch checkout errors in estimate route**

In `src/routes/projects.$projectId.estimate.tsx`, add state:

```ts
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
```

Replace `handleUpgrade` with:

```ts
  const handleUpgrade = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { url } = await createCheckoutFn({ data: { plan: 'unlimited_monthly' } });
      window.location.href = url;
    } catch (error) {
      console.error('Checkout failed:', error);
      setCheckoutError(t('paywall.checkoutError'));
    } finally {
      setCheckoutLoading(false);
    }
  };
```

Pass props to `PaywallModal`:

```tsx
        upgradeLoading={checkoutLoading}
        upgradeError={checkoutError}
```

- [x] **Step 4: Add locale keys**

Add to both locale files under `paywall`:

```json
    "checkoutStarting": "Memulai checkout…",
    "checkoutError": "Checkout belum bisa dimulai. Periksa konfigurasi billing atau coba lagi nanti."
```

For English:

```json
    "checkoutStarting": "Starting checkout…",
    "checkoutError": "Checkout could not start. Check billing configuration or try again later."
```

- [x] **Step 5: Verify typecheck and lint**

Run:

```bash
npm run typecheck && npm run lint
```

Expected: PASS.

---

### Task 7: Update env/operator docs for deferred secrets

**Files:**
- Modify: `.env.example`
- Modify: `docs/setup-checklist.md`

- [x] **Step 1: Update `.env.example` billing section**

Replace the billing section with:

```env
# ---------- Billing (Phase 3; fill manually before deployment/payment testing) ----------
APP_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_UNLIMITED_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
MIDTRANS_SERVER_KEY=
XENDIT_SECRET_KEY=
```

- [x] **Step 2: Add billing setup checklist**

In `docs/setup-checklist.md`, add after the Supabase section:

```md
## Billing Providers (fill after app flows are complete)

- [ ] Stripe Dashboard → Developers → API keys → copy secret key to `STRIPE_SECRET_KEY`.
- [ ] Stripe Dashboard → Product catalog → create the unlimited monthly price → copy price id to `STRIPE_UNLIMITED_PRICE_ID`.
- [ ] Stripe Dashboard → Developers → Webhooks → create endpoint `/api/webhooks/stripe` → copy signing secret to `STRIPE_WEBHOOK_SECRET`.
- [ ] Midtrans Dashboard → Settings → Access Keys → copy server key to `MIDTRANS_SERVER_KEY`.
- [ ] Set `APP_ORIGIN` to the deployed app origin; locally use `http://localhost:3000`.
```

- [x] **Step 3: Verify docs-only changes do not affect typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

---

### Task 8: Align e2e smoke coverage with guest/auth policy

**Files:**
- Modify: `tests-e2e/happy-path.spec.ts`

- [x] **Step 1: Keep existing guest happy path and share-link smoke**

After restoring guest dashboard/new-project access, the existing guest happy-path and share-link tests should stay meaningful. Run:

```bash
npm run test:e2e -- tests-e2e/happy-path.spec.ts
```

Expected after Tasks 1-7: PASS. If it fails because copy-to-clipboard is unavailable in the browser context, keep the existing `data-share-url` assertion as the source of truth and avoid adding clipboard-specific assertions.

- [x] **Step 2: If e2e fails from auth bar copy changes, update selectors only**

Do not change app behavior to satisfy the test. Update selectors only if visible text changed due to restored guest mode. Keep assertions for:

```ts
await expect(page).toHaveURL(/\/projects\/[A-Za-z0-9_-]+\/editor$/);
await expect(shareButton).toBeVisible({ timeout: 10_000 });
expect(url).toMatch(/\/share\/[A-Za-z0-9_-]+$/);
await expect(sharePage.getByText(/Tampilan hanya-baca|Read-only view/)).toBeVisible();
```

- [x] **Step 3: Verify route smoke**

Run:

```bash
npm run test:e2e -- tests-e2e/happy-path.spec.ts
```

Expected: PASS.

---

### Final Verification

- [x] Run focused tests:

```bash
npm test -- tests/lib/share-token.test.ts tests/lib/project-migration.test.ts tests/server/projects.test.ts tests/server/users.test.ts tests/server/payment-webhooks.test.ts tests/server/checkout.test.ts tests/server/generate-pdf.test.ts
```

- [x] Run repository checks:

```bash
npm run typecheck
npm run lint
npm run build
```

- [x] Run e2e smoke:

```bash
npm run test:e2e -- tests-e2e/happy-path.spec.ts
```

- [x] Confirm Vitest output does not list files under `worktrees/`.
- [x] Confirm unauthenticated users can still create local projects.
- [x] Confirm authenticated users still use cloud project CRUD.
- [x] Confirm checkout env values remain documented but not required for local non-checkout tests.
