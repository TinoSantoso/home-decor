import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildEstimateDocument } from '../../lib/pdf-estimate';
import type { CostEstimate, BudgetTier, CostCategory } from '../../lib/cost-engine';
import type { Zone } from '../../lib/zones';

interface Props {
  estimate: CostEstimate;
  zones: Zone[];
  projectName: string;
  budgetTier: BudgetTier;
  contingencyPct: number;
  taxEnabled: boolean;
  localeTag: 'id-ID' | 'en-US';
}

function sanitizeFilename(name: string): string {
  // Replace characters not safe for filenames with hyphens; collapse runs.
  return name.replace(/[^\wÀ-ɏ\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function ExportPdfButton({
  estimate,
  zones,
  projectName,
  budgetTier,
  contingencyPct,
  taxEnabled,
  localeTag,
}: Props) {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating) return;
    setGenerating(true);

    try {
      // Lazy-load @react-pdf/renderer and the PDF component together so neither
      // lands in the estimate route's initial bundle.
      const [{ pdf }, { EstimatePdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./EstimatePdfDocument'),
      ]);

      // Build per-zone and per-category label maps via t().
      const zoneTypeLabels: Record<string, string> = {};
      for (const zone of zones) {
        zoneTypeLabels[zone.id] = t(`zoneType.${zone.type}`);
      }

      const categoryLabels: Record<string, string> = {};
      for (const row of estimate.perCategory) {
        categoryLabels[row.category] = t(`costCategory.${row.category as CostCategory}`);
      }

      const doc = buildEstimateDocument({
        estimate,
        zones,
        projectName,
        budgetTier,
        contingencyPct,
        taxEnabled,
        localeTag,
        zoneTypeLabels,
        categoryLabels,
      });

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
      };

      const blob = await pdf(
        <EstimatePdfDocument doc={doc} labels={labels} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const safe = sanitizeFilename(projectName) || 'proyek';
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
