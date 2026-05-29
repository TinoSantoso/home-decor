/**
 * Server-side PDF estimate generation via @react-pdf/renderer.
 *
 * Architecture:
 * - The pure function `generateEstimatePdf` lives here so both
 *   `uploadAssetFn` callers and future webhook/API routes can reuse it.
 * - The TanStack Start `generateEstimatePdfFn` wraps it as a POST endpoint.
 *
 * Because `@react-pdf/renderer` is pure JS (no native bindings), it runs on
 * the Node.js server without an actual Chrome instance — no Puppeteer needed.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { buildEstimateDocument } from '../lib/pdf-estimate';
import type { BudgetTier } from '../lib/cost-engine';
import { serverAuthMiddleware } from './auth-middleware';
import type { ConsumeResult } from './entitlements';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const zoneRollupSchema = z.object({
  zoneId: z.string(),
  materials: z.number(),
  labor: z.number(),
  total: z.number(),
});

const categoryRollupSchema = z.object({
  category: z.string(),
  materials: z.number(),
  labor: z.number(),
  total: z.number(),
});

const costEstimateSchema = z.object({
  materialsTotal: z.number(),
  laborTotal: z.number(),
  contingency: z.number(),
  tax: z.number(),
  grandTotal: z.number(),
  perCategory: z.array(categoryRollupSchema),
  perZone: z.array(zoneRollupSchema),
});

const estimateInputSchema = z.object({
  estimate: costEstimateSchema,
  zones: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
  })),
  projectName: z.string(),
  budgetTier: z.enum(['hemat', 'standar', 'premium', 'mewah']),
  contingencyPct: z.number(),
  taxEnabled: z.boolean(),
  localeTag: z.enum(['id-ID', 'en-US']),
  zoneTypeLabels: z.record(z.string(), z.string()),
  categoryLabels: z.record(z.string(), z.string()),
  labels: z.object({
    title: z.string(),
    generatedAt: z.string(),
    tier: z.string(),
    materials: z.string(),
    labor: z.string(),
    contingency: z.string(),
    tax: z.string(),
    grandTotal: z.string(),
    zoneTotal: z.string(),
    categoryTotal: z.string(),
    assumptions: z.string(),
    assumptionsBody: z.string(),
    zoneColumnName: z.string(),
    zoneColumnMeta: z.string(),
    categoryColumnName: z.string(),
    taxLine: z.string(),
  }),
});

export type EstimatePdfInput = z.infer<typeof estimateInputSchema>;

// ---------------------------------------------------------------------------
// Pure server function
// ---------------------------------------------------------------------------

export interface GeneratePdfResult {
  /** Raw PDF bytes. Callers should send this as `Content-Type: application/pdf`. */
  pdfBytes: Uint8Array;
  filename: string;
}

/**
 * Renders a cost estimate as a PDF and returns raw bytes.
 *
 * Always pass pre-translated labels — `generateEstimatePdf` has no access to
 * `i18next` at runtime.
 *
 * @throws if `@react-pdf/renderer` cannot be loaded or rendered.
 */
export async function generateEstimatePdf(input: EstimatePdfInput): Promise<GeneratePdfResult> {
  estimateInputSchema.parse(input);

  const { estimate, zones, projectName, budgetTier, contingencyPct, taxEnabled, localeTag, zoneTypeLabels, categoryLabels, labels } = input;

  // Build the document data (same logic as ExportPdfButton.tsx uses client-side).
  // Safe cast — costEstimateSchema emits a structurally-compatible object; the
  // CategoryRollup.category / ZoneRollup.zoneId string values are what the
  // builder needs and they match at runtime.
  const doc = buildEstimateDocument({
    estimate: estimate as unknown as import('../lib/cost-engine').CostEstimate,
    zones: zones as unknown as import('../lib/zones').Zone[],
    projectName,
    budgetTier: budgetTier as BudgetTier,
    contingencyPct,
    taxEnabled,
    localeTag,
    zoneTypeLabels,
    categoryLabels,
  });

  // Lazily import @react-pdf/renderer so the heavy library stays off the SSR bundle.
  const { renderToBuffer } = await import('@react-pdf/renderer');

  // Lazy-import the PDF Document component to keep it off the critical path.
  const { EstimatePdfDocument } = await import('../components/estimate/EstimatePdfDocument');

  const pdfBytes = await renderToBuffer(
    <EstimatePdfDocument doc={doc} labels={labels} />,
  );

  const safe = projectName.replace(/[^\wÀ-ɏ\s-]/g, '').trim().replace(/\s+/g, '-') || 'proyek';
  const filename =
    localeTag === 'id-ID'
      ? `Rencana-Proyek-${safe}.pdf`
      : `Project-Plan-${safe}.pdf`;

  return { pdfBytes, filename };
}

interface ExportPdfEntitlementDeps {
  hasActiveUnlimited(userId: string): Promise<boolean>;
  consumeExportCredit(userId: string): Promise<ConsumeResult>;
}

export interface ExportPdfEntitlementResult {
  allowed: boolean;
  exportsRemaining: number | null;
}

export async function resolveExportPdfEntitlement(
  userId: string,
  deps?: ExportPdfEntitlementDeps,
): Promise<ExportPdfEntitlementResult> {
  const entitlementDeps = deps ?? await import('./entitlements');
  if (await entitlementDeps.hasActiveUnlimited(userId)) {
    return { allowed: true, exportsRemaining: null };
  }

  const consumeResult = await entitlementDeps.consumeExportCredit(userId);
  return {
    allowed: consumeResult.success,
    exportsRemaining: consumeResult.exportsRemaining,
  };
}

// ---------------------------------------------------------------------------
// TanStack Start server function
// ---------------------------------------------------------------------------

/**
 * Input: EstimatePdfInput (same as above but flattened so JSON primitives can cross the RPC wire).
 *
 * Output when successful: `{ pdfBase64: string, filename: string, exportsRemaining: number | null }`
 * Output when blocked:   `{ error: 'paywall', exportsRemaining: 0 }`
 *
 * TanStack Start `createServerFn` currently serialises responses as JSON, so we
 * base64-encode the PDF bytes.
 */
export const generateEstimatePdfFn = createServerFn({ method: 'POST' })
  .inputValidator(estimateInputSchema)
  .middleware([serverAuthMiddleware])
  .handler(async ({ data, context }) => {
    const session = context.session;

    if (session) {
      // Authenticated users: check credit entitlement before generating.
      const entitlement = await resolveExportPdfEntitlement(session.user.id);

      if (!entitlement.allowed) {
        return {
          error: 'paywall',
          exportsRemaining: entitlement.exportsRemaining,
        } as const;
      }
    }

    const result = await generateEstimatePdf(data);
    const pdfBase64 = Buffer.from(result.pdfBytes).toString('base64');

    return {
      pdfBase64,
      filename: result.filename,
      exportsRemaining: null,
    };
  });
