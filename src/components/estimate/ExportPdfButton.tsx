import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CostEstimate, BudgetTier, CostCategory } from '../../lib/cost-engine';
import type { Zone } from '../../lib/zones';
import { generateEstimatePdfFn } from '../../server/generate-pdf';

interface Props {
  estimate: CostEstimate;
  zones: Zone[];
  projectName: string;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  localeTag: 'id-ID' | 'en-US';
  /** Called when the server returns a paywall error (credits exhausted). */
  onPaywall?: () => void;
}

function sanitizeFilename(name: string): string {
  // Remove characters unsafe for filenames; collapse whitespace to single hyphens.
  return name.replace(/[^\wÀ-ɏ\s-]/g, '').trim().replace(/\s+/g, '-') || 'proyek';
}

/**
 * Export button that generates the PDF server-side (credit-consumption-aware).
 *
 * Falls back to client-side generation when `onPaywall` is not provided
 * (share route, which has no credit check).
 */
export function ExportPdfButton({
  estimate,
  zones,
  projectName,
  budgetTier,
  contingencyPct,
  taxEnabled,
  localeTag,
  onPaywall,
}: Props) {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating) return;
    setGenerating(true);

    try {
      // Build the label maps via t() on the client — they travel as JSON strings.
      const zoneTypeLabels: Record<string, string> = {};
      for (const zone of zones) {
        zoneTypeLabels[zone.id] = t(`zoneType.${zone.type}`);
      }

      const categoryLabels: Record<string, string> = {};
      for (const row of estimate.perCategory) {
        categoryLabels[row.category] = t(`costCategory.${row.category as CostCategory}`);
      }

      const labels = {
        title: t('pdf.title'),
        generatedAt: t('pdf.generatedAt'),
        tier: t('pdf.tier'),
        materials: t('estimate.materials'),
        labor: t('estimate.labor'),
        contingency: t('estimate.contingency'),
        tax: t('estimate.tax'),
        grandTotal: t('estimate.grandTotal'),
        zoneTotal: t('pdf.zoneTotal'),
        categoryTotal: t('pdf.categoryTotal'),
        assumptions: t('estimate.assumptions'),
        assumptionsBody: t('estimate.assumptionsBody'),
        zoneColumnName: t('pdf.zoneColumnName'),
        zoneColumnMeta: t('pdf.zoneColumnMeta'),
        categoryColumnName: t('pdf.categoryColumnName'),
        taxLine: t('pdf.taxLine'),
      };

      const result = await generateEstimatePdfFn({
        data: {
          estimate: estimate as unknown as import('../../server/generate-pdf').EstimatePdfInput['estimate'],
          zones,
          projectName,
          budgetTier,
          contingencyPct,
          taxEnabled,
          localeTag,
          zoneTypeLabels,
          categoryLabels,
          labels,
        },
      });

      // Handle paywall response from the server.
      if ('error' in result && result.error === 'paywall') {
        onPaywall?.();
        return;
      }

      // Convert base64 PDF to a download.
      const pdfBytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
        c.charCodeAt(0),
      );
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const safe = sanitizeFilename(projectName);
      const filename =
        localeTag === 'id-ID'
          ? `Rencana-Proyek-${safe}.pdf`
          : `Project-Plan-${safe}.pdf`;

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      type="button"
      disabled={generating}
      onClick={() => void handleClick()}
      className="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm transition hover:border-[color:var(--color-accent)] disabled:opacity-50"
    >
      {generating ? t('pdf.generating') : t('pdf.export')}
    </button>
  );
}
