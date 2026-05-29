# Billing and Ownership Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the newly added payment webhook and auth-owned project flows so they are production-safe enough for Phase 3.

**Architecture:** Keep the current JSON-backed `Project.data` bridge and provider-neutral billing service, but fix identity, client/server boundaries, public sharing, webhook idempotency, and checkout initiation. Split server-only Prisma/runtime code out of modules imported by client routes so TanStack Start server-function declarations remain safe to import from UI files.

**Tech Stack:** TanStack Start server functions and server routes, Supabase SSR auth, Prisma Postgres, Vitest, Node `crypto`, optional provider REST calls via `fetch`.

---

### Task 1: Validate Supabase users and upsert Prisma users

**Files:**
- Create: `src/server/users.ts`
- Modify: `src/server/auth-middleware.ts`
- Modify: `src/server/projects.ts`
- Modify: `src/server/payment-webhooks.ts`
- Test: `tests/server/users.test.ts`

- [ ] **Step 1: Write failing user upsert tests**

Create `tests/server/users.test.ts` with tests that prove a Supabase session user is converted into a Prisma `User` row before project/payment writes:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createUserService, type UserDb } from '../../src/server/users';

function db(): UserDb {
  return {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: 'auth-user-1', email: 'u@example.com' }),
    },
  };
}

describe('createUserService', () => {
  it('upserts a Prisma user using the Supabase auth user id', async () => {
    const mockDb = db();
    const service = createUserService(mockDb);

    await service.ensureUser({ id: 'auth-user-1', email: 'u@example.com' });

    expect(mockDb.user.upsert).toHaveBeenCalledWith({
      where: { id: 'auth-user-1' },
      create: { id: 'auth-user-1', email: 'u@example.com' },
      update: { email: 'u@example.com' },
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/server/users.test.ts`

Expected: FAIL because `src/server/users.ts` does not exist.

- [ ] **Step 3: Implement `src/server/users.ts`**

Create a focused service with `createUserService(db)` and `ensureUser(user)`:

```ts
import { createRequire } from 'node:module';

interface UserModel {
  upsert(args: Record<string, unknown>): Promise<unknown>;
}

export interface UserDb {
  user: UserModel;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export function createUserService(db: UserDb) {
  return {
    ensureUser(user: AuthUserIdentity) {
      const email = user.email ?? `${user.id}@supabase.local`;
      return db.user.upsert({
        where: { id: user.id },
        create: { id: user.id, email },
        update: { email },
      });
    },
  };
}
```

Also add default Prisma wiring and exported `ensureUser()` in the same file following the existing service pattern.

- [ ] **Step 4: Use validated auth and ensure users before writes**

Change `serverAuthMiddleware` to validate with Supabase `getUser()` after `getSession()`:

```ts
const { data: sessionData } = await supabase.auth.getSession();
const { data: userData, error } = sessionData.session
  ? await supabase.auth.getUser()
  : { data: { user: null }, error: null };
const session = error || !userData.user ? null : sessionData.session;
```

Call `ensureUser({ id: session.user.id, email: session.user.email })` before cloud project creation and before webhook entitlement grants.

- [ ] **Step 5: Run verification**

Run: `npm test -- tests/server/users.test.ts tests/server/projects.test.ts tests/server/payment-webhooks.test.ts && npm run typecheck`

Expected: all pass.

### Task 2: Split server-only Prisma code from client-imported server function declarations

**Files:**
- Create: `src/server/projects-service.server.ts`
- Create: `src/server/entitlements-service.server.ts`
- Modify: `src/server/projects.ts`
- Modify: `src/server/entitlements.ts`
- Modify: `src/server/generate-pdf.tsx`
- Test: existing server tests

- [ ] **Step 1: Move Prisma `createRequire` code out of client-imported modules**

Move default Prisma DB wiring from `src/server/projects.ts` into `src/server/projects-service.server.ts`:

```ts
import { createRequire } from 'node:module';
import { createProjectService, type ProjectDb } from './projects';

const nodeRequire = createRequire(import.meta.url);
let defaultDb: ProjectDb | null = null;

export function getProjectService() {
  if (!defaultDb) {
    const { PrismaClient } = nodeRequire('@prisma/client') as {
      PrismaClient: new () => ProjectDb;
    };
    defaultDb = new PrismaClient();
  }
  return createProjectService(defaultDb);
}
```

Repeat the pattern for entitlements in `src/server/entitlements-service.server.ts`.

- [ ] **Step 2: Lazily import server-only services inside server function handlers**

In `src/server/projects.ts`, replace direct default service construction with dynamic imports inside handlers:

```ts
const { getProjectService } = await import('./projects-service.server');
return getProjectService().listProjects(requireUserId(context.session));
```

In `src/server/generate-pdf.tsx`, lazily import entitlement default functions inside the server handler or pure entitlement resolver dependency path so client bundles do not traverse `node:module`.

- [ ] **Step 3: Run build to confirm warning removal**

Run: `npm run build`

Expected: build exits 0 and no longer prints `Module "node:module" has been externalized for browser compatibility` for `src/server/projects.ts`, `src/server/entitlements.ts`, or `src/server/generate-pdf.tsx`.

### Task 3: Implement cloud share links for authenticated projects

**Files:**
- Modify: `src/server/projects.ts`
- Modify: `src/routes/projects.$projectId.estimate.tsx`
- Modify: `src/routes/projects.$projectId.share.$token.tsx`
- Test: `tests/server/projects.test.ts`

- [ ] **Step 1: Add failing share-token service tests**

Extend `tests/server/projects.test.ts` with:

```ts
it('generates a share token only for an owned project', async () => {
  vi.mocked(db.project.findFirst).mockResolvedValue(row());
  vi.mocked(db.project.update).mockResolvedValue(
    row({ data: record({ shareToken: 'share-token-1' }) }),
  );
  const service = createProjectService(db, {
    now: () => now,
    token: () => 'share-token-1',
  });

  const result = await service.generateShareToken('user-1', 'project-1');

  expect(result?.token).toBe('share-token-1');
  expect(db.project.findFirst).toHaveBeenCalledWith({
    where: { id: 'project-1', userId: 'user-1' },
  });
});

it('loads a shared project by valid token without auth', async () => {
  vi.mocked(db.project.findFirst).mockResolvedValue(
    row({ data: record({ shareToken: 'token', shareTokenExpiry: now.getTime() + 1000 }) }),
  );
  const service = createProjectService(db, { now: () => now });

  await expect(service.getSharedProject('project-1', 'token')).resolves.toMatchObject({
    id: 'project-1',
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/server/projects.test.ts`

Expected: FAIL because `generateShareToken` / `getSharedProject` do not exist on the service.

- [ ] **Step 3: Implement service/server functions**

Add to `ProjectService`:

```ts
generateShareToken(userId: string, projectId: string): Promise<{ token: string; expiry: number } | null>;
getSharedProject(projectId: string, token: string): Promise<ProjectRecord | null>;
```

Add server functions:

```ts
export const generateOwnedShareTokenFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => { /* ownership-scoped token creation */ });

export const getSharedProjectFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string(), token: z.string() }))
  .handler(async ({ data }) => { /* public token validation */ });
```

- [ ] **Step 4: Wire UI**

In estimate route, authenticated copy-share uses `generateOwnedShareTokenFn`; unauthenticated fallback uses existing IDB `generateShareToken`.

In share route, first call `getSharedProjectFn({ data: { id: projectId, token } })`; if it returns null, fallback to existing IDB token logic for local legacy links.

- [ ] **Step 5: Verify**

Run: `npm test -- tests/server/projects.test.ts tests/lib/share-token.test.ts && npm run typecheck`

Expected: all pass.

### Task 4: Harden webhook errors, secrets, idempotency, and event canonicalization

**Files:**
- Modify: `src/server/payment-webhooks.ts`
- Modify: `src/routes/api.webhooks.stripe.ts`
- Modify: `src/routes/api.webhooks.midtrans.ts`
- Test: `tests/server/payment-webhooks.test.ts`

- [ ] **Step 1: Add failing webhook hardening tests**

Add tests for:
- missing Stripe secret throws `Stripe webhook secret is not configured.`
- old Stripe timestamp throws `Stripe webhook timestamp is outside tolerance.`
- unknown entitlement type throws `Unsupported entitlement type.`
- Stripe checkout event uses `payment_intent` as canonical provider ref when present
- duplicate grant errors from Prisma unique constraint become `{ ok: true, action: 'duplicate' }`

- [ ] **Step 2: Run red tests**

Run: `npm test -- tests/server/payment-webhooks.test.ts`

Expected: FAIL for the new behaviors.

- [ ] **Step 3: Implement hardening**

In `payment-webhooks.ts`:

```ts
if (!secret) throw new Error('Stripe webhook secret is not configured.');
if (!serverKey) throw new Error('Midtrans server key is not configured.');
```

Validate `entitlementType`:

```ts
if (entitlementType !== 'export_credit' && entitlementType !== 'unlimited_monthly') {
  throw new Error('Unsupported entitlement type.');
}
```

Canonicalize Stripe provider ref:

```ts
const providerRef = String(object['payment_intent'] ?? object['id']);
```

Catch duplicate unique errors around grant calls and return duplicate action.

- [ ] **Step 4: Add route-level HTTP status handling**

In webhook route files, wrap handlers:

```ts
try {
  return Response.json(result);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Webhook failed.';
  const status = message.includes('signature') ? 401 : message.includes('configured') ? 500 : 400;
  return Response.json({ ok: false, error: message }, { status });
}
```

- [ ] **Step 5: Verify**

Run: `npm test -- tests/server/payment-webhooks.test.ts && npm run typecheck`

Expected: all pass.

### Task 5: Add checkout initiation and wire the paywall upgrade CTA

**Files:**
- Create: `src/server/checkout.ts`
- Modify: `src/components/editor/PaywallModal.tsx`
- Modify: `src/routes/projects.$projectId.estimate.tsx`
- Modify: `src/routes/projects.$projectId.share.$token.tsx`
- Test: `tests/server/checkout.test.ts`

- [ ] **Step 1: Write failing checkout intent tests**

Create `tests/server/checkout.test.ts` for a pure builder:

```ts
import { describe, expect, it } from 'vitest';
import { buildCheckoutMetadata } from '../../src/server/checkout';

describe('buildCheckoutMetadata', () => {
  it('embeds entitlement metadata for unlimited monthly checkout', () => {
    expect(buildCheckoutMetadata('user-1', 'unlimited_monthly')).toEqual({
      userId: 'user-1',
      entitlementType: 'unlimited_monthly',
      durationDays: '30',
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/server/checkout.test.ts`

Expected: FAIL because checkout module does not exist.

- [ ] **Step 3: Implement minimal checkout server function**

Add `createCheckoutFn({ plan })` with auth required. For the first pass, support Stripe Checkout through `fetch` without adding SDK dependency:

```ts
export const createCheckoutFn = createServerFn({ method: 'POST' })
  .middleware([serverAuthMiddleware])
  .inputValidator(z.object({ plan: z.enum(['unlimited_monthly']) }))
  .handler(async ({ context, data }) => {
    const userId = requireUserId(context.session);
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env['STRIPE_SECRET_KEY'] ?? ''}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'payment',
        success_url: `${process.env['APP_ORIGIN'] ?? 'http://localhost:3000'}/dashboard`,
        cancel_url: `${process.env['APP_ORIGIN'] ?? 'http://localhost:3000'}/dashboard`,
        'metadata[userId]': userId,
        'metadata[entitlementType]': data.plan,
        'metadata[durationDays]': '30',
      }),
    });
    const body = await response.json() as { url?: string };
    if (!body.url) throw new Error('Checkout provider did not return a URL.');
    return { url: body.url };
  });
```

Use env-based price/line-item configuration in the implementation (`STRIPE_UNLIMITED_PRICE_ID`) so checkout can actually complete.

- [ ] **Step 4: Wire `PaywallModal.onUpgrade`**

In estimate route, pass:

```tsx
onUpgrade={() => {
  void createCheckoutFn({ data: { plan: 'unlimited_monthly' } }).then(({ url }) => {
    window.location.href = url;
  });
}}
```

In share route, pass `onPaywall` to `ExportPdfButton` or explicitly keep share PDF export guest-only; do not silently ignore `{ error: 'paywall' }`.

- [ ] **Step 5: Verify**

Run: `npm test -- tests/server/checkout.test.ts && npm run typecheck && npm run lint`

Expected: all pass.

### Final verification

- [ ] Run focused tests:

```bash
npm test -- tests/server/users.test.ts tests/server/projects.test.ts tests/server/payment-webhooks.test.ts tests/server/checkout.test.ts tests/server/generate-pdf.test.ts tests/lib/share-token.test.ts
```

- [ ] Run repository checks:

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] Review build output for the removed `node:module` externalization warning.
- [ ] Report any remaining warning or intentionally deferred provider-specific behavior.
