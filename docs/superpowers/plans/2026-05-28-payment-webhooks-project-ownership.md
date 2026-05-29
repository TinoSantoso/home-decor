# Payment Webhooks and Project Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add payment webhook handlers and authenticated project ownership with minimal changes to the existing TanStack Start app.

**Architecture:** Webhook parsing/signature/idempotency lives in focused pure server helpers, while route handlers expose provider endpoints. Project ownership uses server functions backed by Prisma and stores the existing `ProjectRecord` as JSON on `Project.data` so the current editor/store contract remains stable.

**Tech Stack:** TanStack Start server routes/functions, Prisma Postgres, Supabase sessions, Vitest, Node `crypto`.

---

### Task 1: Payment webhook core and routes

**Files:**
- Create: `src/server/payment-webhooks.ts`
- Create: `src/routes/api.webhooks.stripe.ts`
- Create: `src/routes/api.webhooks.midtrans.ts`
- Test: `tests/server/payment-webhooks.test.ts`

- [ ] Write failing tests for Stripe/Midtrans success events, duplicate provider refs, and invalid signatures.
- [ ] Implement provider-neutral helpers that verify signatures, parse JSON payloads, check existing payments, and call `grantExportCredits` or `grantUnlimited`.
- [ ] Add TanStack server route POST handlers that pass raw body + headers to the helpers and return JSON responses.
- [ ] Run `npm test -- tests/server/payment-webhooks.test.ts`.

### Task 2: Project ownership server functions

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration SQL under `prisma/migrations/`
- Create: `src/server/projects.ts`
- Test: `tests/server/projects.test.ts`

- [ ] Add `Project.data Json?` to store the current `ProjectRecord` payload.
- [ ] Write failing tests for authenticated create/list/get/save/delete and cross-user denial.
- [ ] Implement server functions using `serverAuthMiddleware` and Prisma, always scoping by `session.user.id`.
- [ ] Run `npm test -- tests/server/projects.test.ts`.

### Task 3: Wire authenticated UI to cloud project CRUD

**Files:**
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/projects.new.tsx`
- Modify: `src/routes/projects.$projectId.editor.tsx`
- Modify: `src/routes/projects.$projectId.estimate.tsx`
- Modify: `src/routes/projects.$projectId.tour.tsx`

- [ ] Use cloud CRUD when the user is authenticated.
- [ ] Keep IndexedDB behavior for unauthenticated/share-only flows.
- [ ] Preserve current `ProjectRecord` shape so `useFloorPlan.loadProject()` remains unchanged.
- [ ] Run `npm run typecheck`, `npm run lint`, and focused tests.
