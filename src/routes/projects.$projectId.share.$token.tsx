/**
 * Read-only share route.
 *
 * URL: /projects/:projectId/share/:token
 * Renders the cost estimate for a project when accessed via a valid share link.
 * No editing controls, no catalog, no walk mode — purely display + PDF export.
 *
 * SSR is enabled so share links work without JavaScript (for crawlers,
 * preview unfurling, etc.).
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatIDR } from '../lib/currency';
import { zoneAreaM2, type Zone } from '../lib/zones';
import type { PlacedItemRecord } from '../lib/db/types';
import { deriveSurfacesFromZones } from '../lib/surfaces';
import { toPlacedItemInputs } from '../lib/placed-items';
import { getProject, isShareTokenValid } from '../lib/db/projects';
import type { BudgetTier, CostCategory } from '../lib/cost-engine';
import { calculateCost } from '../lib/cost-engine';
import { loadCatalog, type Item } from '../lib/catalog';
import { ExportPdfButton } from '../components/estimate/ExportPdfButton';

export const Route = createFileRoute('/projects/$projectId/share/$token')({
  ssr: true,
  component: SharePage,
});

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid_token' }
  | { kind: 'expired' }
  | { kind: 'not_found' }
  | {
      kind: 'ready';
      name: string;
      budgetTier: BudgetTier;
      contingencyPct: number;
      taxEnabled: boolean;
    };

function SharePage() {
  const { projectId, token } = Route.useParams();
  const { t, i18n } = useTranslation();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [zones, setZones] = useState<Zone[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItemRecord[]>([]);
  const [floorPlanImageUrl, setFloorPlanImageUrl] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Item[]>([]);

  const localeTag = i18n.language === 'id' ? 'id-ID' : 'en-US';

  // Load catalog once
  useEffect(() => {
    void loadCatalog().then(setCatalog);
  }, []);

  // Validate token and load project on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const valid = await isShareTokenValid(projectId, token);
      if (cancelled) return;

      if (!valid) {
        // Distinguish expired from not-found vs invalid token
        const project = await getProject(projectId);
        if (!project) {
          setLoad({ kind: 'not_found' });
        } else if (
          project.shareTokenExpiry != null &&
          Date.now() >= project.shareTokenExpiry
        ) {
          setLoad({ kind: 'expired' });
        } else {
          setLoad({ kind: 'invalid_token' });
        }
        return;
      }

      const record = await getProject(projectId);
      if (cancelled) return;
      if (!record) {
        setLoad({ kind: 'not_found' });
        return;
      }

      setLoad({
        kind: 'ready',
        name: record.name,
        budgetTier: record.budgetTier,
        contingencyPct: record.contingencyPct,
        taxEnabled: record.taxEnabled,
      });
      setZones(record.zones);
      setPlacedItems(record.placedItems ?? []);
      setFloorPlanImageUrl(record.floorPlanImageUrl ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  const estimate = useMemo(() => {
    if (load.kind !== 'ready') return null;
    return calculateCost({
      budgetTier: load.budgetTier,
      contingencyPct: load.contingencyPct,
      taxEnabled: load.taxEnabled,
      items: toPlacedItemInputs(placedItems, catalog),
      surfaces: deriveSurfacesFromZones(zones),
      laborRates: {},
    });
  }, [load, placedItems, catalog, zones]);

  // Loading state
  if (load.kind === 'loading') {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-center text-[color:var(--color-text-muted)]">
        {t('editor.loading')}
      </main>
    );
  }

  // Error states
  if (load.kind === 'invalid_token' || load.kind === 'expired') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">
          {load.kind === 'expired' ? t('share.expired') : t('share.invalid')}
        </h1>
        <p className="mt-2 text-[color:var(--color-text-muted)]">
          {load.kind === 'expired' ? t('share.expiredHelp') : t('share.invalidHelp')}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm text-[color:var(--color-accent-fg)]"
        >
          {t('share.goHome')}
        </Link>
      </main>
    );
  }

  if (load.kind === 'not_found') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t('editor.notFound')}</h1>
        <p className="mt-2 text-[color:var(--color-text-muted)]">
          {t('editor.notFoundHelp')}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm text-[color:var(--color-accent-fg)]"
        >
          {t('share.goHome')}
        </Link>
      </main>
    );
  }

  // Ready state
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <header className="mb-6">
        <Link
          to="/"
          className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          ← {t('nav.dashboard')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {load.name || t('dashboard.untitled')}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          {t('share.readOnlyLabel')}
        </p>
      </header>

      {/* Floor plan reference image if available */}
      {floorPlanImageUrl && (
        <section className="mb-6">
          <img
            src={floorPlanImageUrl}
            alt={t('share.floorPlanRef')}
            className="max-h-64 w-full rounded-[var(--radius)] border border-[color:var(--color-border)] object-contain bg-white"
          />
        </section>
      )}

      {/* Zones summary */}
      {zones.length > 0 && (
        <section className="mb-6 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-4">
          <h2 className="text-sm font-medium text-[color:var(--color-text-muted)]">
            {t('share.zonesLabel')}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {zones.map((zone) => (
              <li
                key={zone.id}
                className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-sm"
              >
                {zone.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cost estimate or empty state */}
      {!estimate && zones.length === 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-12 text-center text-sm text-[color:var(--color-text-muted)]">
          {t('estimate.noZones')}
        </section>
      ) : estimate ? (
        <>
          <section
            aria-labelledby="grand-total"
            className="mb-6 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="grand-total"
                  className="text-sm uppercase tracking-wide text-[color:var(--color-text-muted)]"
                >
                  {t('estimate.grandTotal')}
                </h2>
                <div className="mt-1 text-4xl font-semibold tracking-tight">
                  {formatIDR(estimate.grandTotal, localeTag)}
                </div>
              </div>
              <div className="text-right">
                <ExportPdfButton
                  estimate={estimate}
                  zones={zones}
                  projectName={load.name}
                  budgetTier={load.budgetTier}
                  contingencyPct={load.contingencyPct}
                  taxEnabled={load.taxEnabled}
                  localeTag={localeTag}
                />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[color:var(--color-text-muted)] sm:grid-cols-4">
              <div>
                <dt>{t('estimate.materials')}</dt>
                <dd className="text-[color:var(--color-text)] tabular-nums">
                  {formatIDR(estimate.materialsTotal, localeTag)}
                </dd>
              </div>
              <div>
                <dt>{t('estimate.labor')}</dt>
                <dd className="text-[color:var(--color-text)] tabular-nums">
                  {formatIDR(estimate.laborTotal, localeTag)}
                </dd>
              </div>
              <div>
                <dt>{t('estimate.contingency')}</dt>
                <dd className="text-[color:var(--color-text)] tabular-nums">
                  {formatIDR(estimate.contingency, localeTag)}
                </dd>
              </div>
              {load.taxEnabled && (
                <div>
                  <dt>{t('estimate.tax')}</dt>
                  <dd className="text-[color:var(--color-text)] tabular-nums">
                    {formatIDR(estimate.tax, localeTag)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-5">
              <h3 className="text-sm font-medium">{t('estimate.perZone')}</h3>
              <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
                {estimate.perZone.map((row) => {
                  const zone = zones.find((z) => z.id === row.zoneId);
                  if (!zone) return null;
                  const area = zoneAreaM2(zone);
                  return (
                    <li
                      key={row.zoneId}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate">{zone.name}</div>
                        <div className="text-xs text-[color:var(--color-text-muted)]">
                          {t(`zoneType.${zone.type}`)} · {area.toFixed(1)} m²
                        </div>
                      </div>
                      <div className="tabular-nums">
                        {formatIDR(row.total, localeTag)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-5">
              <h3 className="text-sm font-medium">{t('estimate.perCategory')}</h3>
              <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
                {estimate.perCategory.map((row) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div>{t(`costCategory.${row.category as CostCategory}`)}</div>
                      <div className="text-xs text-[color:var(--color-text-muted)]">
                        {t('estimate.materials')}{' '}
                        {formatIDR(row.materials, localeTag)} ·{' '}
                        {t('estimate.labor')} {formatIDR(row.labor, localeTag)}
                      </div>
                    </div>
                    <div className="tabular-nums">
                      {formatIDR(row.total, localeTag)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-5 text-xs text-[color:var(--color-text-muted)]">
            <h3 className="text-[color:var(--color-text)] text-sm font-medium">
              {t('estimate.assumptions')}
            </h3>
            <p className="mt-2">{t('estimate.assumptionsBody')}</p>
          </section>
        </>
      ) : null}
    </main>
  );
}