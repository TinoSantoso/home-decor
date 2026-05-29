/**
 * Lightweight read-only entitlement check for export gating.
 *
 * Does NOT consume a credit — callers use this to initialise modal state
 * before the user attempts an export. The actual credit consumption happens
 * in `generateEstimatePdfFn` server-side.
 */
import { createServerFn } from '@tanstack/react-start';
import {
  hasActiveUnlimited,
  listEntitlements,
} from './entitlements';
import { serverAuthMiddleware } from './auth-middleware';

/** Shape of the response returned by `checkEntitlementForExportFn`. */
export interface CheckEntitlementResult {
  /** True if the user has at least one active export credit left. */
  hasCredits: boolean;
  /** True if the user has an active unlimited plan. */
  hasUnlimited: boolean;
  /** Remaining credits, or null if no credit entitlement exists. */
  exportsRemaining: number | null;
}

export const checkEntitlementForExportFn = createServerFn({ method: 'GET' })
  .middleware([serverAuthMiddleware])
  .handler(async ({ context }): Promise<CheckEntitlementResult> => {
    const session = context.session;

    // Guests always have access (no credit check needed).
    if (!session) {
      return { hasCredits: true, hasUnlimited: true, exportsRemaining: null };
    }

    const [views, hasUnlimited] = await Promise.all([
      listEntitlements(session.user.id),
      hasActiveUnlimited(session.user.id),
    ]);

    const creditEnt = views.find(
      (v) => v.type === 'export_credit' && v.active,
    );

    return {
      hasCredits: (creditEnt?.exportsRemaining ?? 0) > 0,
      hasUnlimited,
      exportsRemaining: creditEnt?.exportsRemaining ?? null,
    };
  });