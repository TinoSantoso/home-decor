import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../stores/floor-plan';
import { useAuthStore } from '../stores/auth';
import { generateShareToken, getProject, saveProject } from '../lib/db/projects';
import { debounce } from '../lib/debounce';
import { calculateCost, type BudgetTier, type CostCategory } from '../lib/cost-engine';
import { deriveSurfacesFromZones } from '../lib/surfaces';
import { formatIDR } from '../lib/currency';
import { zoneAreaM2 } from '../lib/zones';
import { loadCatalog, type Item } from '../lib/catalog';
import { toPlacedItemInputs } from '../lib/placed-items';
import { ExportPdfButton } from '../components/estimate/ExportPdfButton';
import {
  PaywallModal,
  type UserPaywallStatus,
} from '../components/editor/PaywallModal';
import { checkEntitlementForExportFn } from '../server/check-entitlement';
import {
  generateOwnedShareTokenFn,
  getOwnedProjectFn,
  saveOwnedProjectFn,
} from '../server/projects';
import { createCheckoutFn } from '../server/checkout';

export const Route = createFileRoute('/projects/$projectId/estimate')({
  ssr: false,
  component: EstimatePage,
});

const TIERS: readonly BudgetTier[] = ['hemat', 'standar', 'premium', 'mewah'];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'not_found' };

function EstimatePage() {
  const { projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });

  const loadProject = useFloorPlan((s) => s.loadProject);
  const reset = useFloorPlan((s) => s.reset);
  const projectName = useFloorPlan((s) => s.projectName);
  const zones = useFloorPlan((s) => s.zones);
  const placedItems = useFloorPlan((s) => s.placedItems);
  const budgetTier = useFloorPlan((s) => s.budgetTier);
  const contingencyPct = useFloorPlan((s) => s.contingencyPct);
  const taxEnabled = useFloorPlan((s) => s.taxEnabled);
  const setBudgetTier = useFloorPlan((s) => s.setBudgetTier);
  const setContingencyPct = useFloorPlan((s) => s.setContingencyPct);
  const setTaxEnabled = useFloorPlan((s) => s.setTaxEnabled);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [userPaywallStatus, setUserPaywallStatus] = useState<UserPaywallStatus>('unauthenticated');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { isAuthenticated, loading: loadingAuth } = useAuthStore();

  useEffect(() => {
    void loadCatalog().then(setCatalog);
  }, []);

  // Fetch entitlement status on mount to drive the PaywallModal user status.
  useEffect(() => {
    if (load.kind !== 'ready') return;
    void (async () => {
      try {
        const result = await checkEntitlementForExportFn();
        // Derive which modal variant to show if the export is triggered.
        if (!result.hasUnlimited && !result.hasCredits) {
          setUserPaywallStatus(isAuthenticated ? 'authenticated_no_credits' : 'unauthenticated');
        }
        // Note: users with credits or unlimited access still see ExportPdfButton normally;
        // the paywall is only triggered server-side when credits genuinely run out.
      } catch {
        // Network error — best-effort: show auth modal for unauthenticated, upgrade for authed.
        if (isAuthenticated) setUserPaywallStatus('authenticated_no_credits');
        else setUserPaywallStatus('unauthenticated');
      }
    })();
  }, [load.kind, isAuthenticated]);

  useEffect(() => {
    if (loadingAuth) return;
    let cancelled = false;
    void (async () => {
      const record = isAuthenticated
        ? await getOwnedProjectFn({ data: { id: projectId } })
        : await getProject(projectId);
      if (cancelled) return;
      if (!record) {
        setLoad({ kind: 'not_found' });
        return;
      }
      loadProject(record);
      setLoad({ kind: 'ready' });
    })();
    return () => {
      cancelled = true;
      reset();
    };
  }, [isAuthenticated, loadingAuth, projectId, loadProject, reset]);

  const persistRef = useRef<ReturnType<typeof debounce<[]>> | null>(null);
  useEffect(() => {
    if (load.kind !== 'ready') return;
    const persist = debounce(() => {
      const record = useFloorPlan.getState().toProjectRecord();
      if (!record) return;
      void (isAuthenticated
        ? saveOwnedProjectFn({ data: record })
        : saveProject(record));
    }, 400);
    persistRef.current = persist;

    const unsubscribe = useFloorPlan.subscribe((state, prev) => {
      if (
        state.budgetTier !== prev.budgetTier ||
        state.contingencyPct !== prev.contingencyPct ||
        state.taxEnabled !== prev.taxEnabled
      ) {
        persist();
      }
    });

    return () => {
      unsubscribe();
      persist.flush();
      persistRef.current = null;
    };
  }, [isAuthenticated, load.kind]);

  const localeTag = i18n.language === 'id' ? 'id-ID' : 'en-US';

  const estimate = useMemo(() => {
    return calculateCost({
      budgetTier,
      contingencyPct,
      taxEnabled,
      items: toPlacedItemInputs(placedItems, catalog),
      surfaces: deriveSurfacesFromZones(zones),
      laborRates: {},
    });
  }, [budgetTier, contingencyPct, taxEnabled, zones, placedItems, catalog]);

  const handleCopyShareLink = async () => {
    try {
      const token = isAuthenticated
        ? (await generateOwnedShareTokenFn({ data: { id: projectId } }))?.token
        : await generateShareToken(projectId);
      if (!token) {
        console.warn('generateShareToken returned null');
        return;
      }
      const url = `${window.location.origin}/projects/${projectId}/share/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch (err) {
      console.error('Share link copy failed:', err);
    }
  };

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

  if (load.kind === 'loading') {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-center text-[color:var(--color-text-muted)]">
        {t('editor.loading')}
      </main>
    );
  }

  if (load.kind === 'not_found') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">{t('editor.notFound')}</h1>
        <p className="mt-2 text-[color:var(--color-text-muted)]">
          {t('editor.notFoundHelp')}
        </p>
        <button
          type="button"
          onClick={() => void navigate({ to: '/dashboard' })}
          className="mt-6 rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm text-[color:var(--color-accent-fg)]"
        >
          {t('nav.dashboard')}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            to="/projects/$projectId/editor"
            params={{ projectId }}
            className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            ← {t('estimate.backToEditor')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {projectName || t('dashboard.untitled')}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
            {t('estimate.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {load.kind === 'ready' && (
            <button
              type="button"
              data-testid="copy-share-link"
              data-share-url={shareUrl ?? ''}
              onClick={() => void handleCopyShareLink()}
              className="flex items-center gap-1.5 rounded-[var(--radius)] border border-[color:var(--color-border)] px-3 py-2 text-sm transition hover:border-[color:var(--color-accent)]"
            >
              {shareCopied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('share.copied')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {t('share.copyLink')}
                </>
              )}
            </button>
          )}
          <ExportPdfButton
            estimate={estimate}
            zones={zones}
            projectName={projectName ?? ''}
            budgetTier={budgetTier}
            contingencyPct={contingencyPct}
            taxEnabled={taxEnabled}
            localeTag={localeTag}
            onPaywall={() => setPaywallOpen(true)}
          />
        </div>
      </header>

      {zones.length === 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-12 text-center text-sm text-[color:var(--color-text-muted)]">
          {t('estimate.noZones')}
        </section>
      ) : (
        <>
          <section
            aria-labelledby="grand-total"
            className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
          >
            <div className="flex items-end justify-between gap-4">
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
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[color:var(--color-text-muted)]">
                <dt>{t('estimate.materials')}</dt>
                <dd className="text-right text-[color:var(--color-text)] tabular-nums">
                  {formatIDR(estimate.materialsTotal, localeTag)}
                </dd>
                <dt>{t('estimate.labor')}</dt>
                <dd className="text-right text-[color:var(--color-text)] tabular-nums">
                  {formatIDR(estimate.laborTotal, localeTag)}
                </dd>
                <dt>{t('estimate.contingency')}</dt>
                <dd className="text-right text-[color:var(--color-text)] tabular-nums">
                  {formatIDR(estimate.contingency, localeTag)}
                </dd>
                {taxEnabled && (
                  <>
                    <dt>{t('estimate.tax')}</dt>
                    <dd className="text-right text-[color:var(--color-text)] tabular-nums">
                      {formatIDR(estimate.tax, localeTag)}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </section>

          <section
            aria-labelledby="controls"
            className="mt-6 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-5"
          >
            <h2 id="controls" className="sr-only">
              Controls
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  {t('estimate.tierLabel')}
                </label>
                <div
                  role="radiogroup"
                  aria-label={t('estimate.tierLabel')}
                  className="mt-2 grid grid-cols-2 gap-1.5"
                >
                  {TIERS.map((tier) => {
                    const active = tier === budgetTier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setBudgetTier(tier)}
                        className={
                          'rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition ' +
                          (active
                            ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]'
                            : 'border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]')
                        }
                      >
                        {t(`budget.tier.${tier}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="contingency"
                  className="flex items-baseline justify-between text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]"
                >
                  <span>{t('estimate.contingencyLabel')}</span>
                  <span className="text-[color:var(--color-text)] tabular-nums">
                    {Math.round(contingencyPct * 100)}%
                  </span>
                </label>
                <input
                  id="contingency"
                  type="range"
                  min={5}
                  max={15}
                  step={1}
                  value={Math.round(contingencyPct * 100)}
                  onChange={(e) =>
                    setContingencyPct(Number(e.target.value) / 100)
                  }
                  className="mt-3 w-full accent-[color:var(--color-accent)]"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  {t('estimate.taxLabel')}
                </label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--color-accent)]"
                  />
                  <span>+ PPN 11%</span>
                </label>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-5">
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
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-5">
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
            </div>
          </section>

          <section className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-5 text-xs text-[color:var(--color-text-muted)]">
            <h3 className="text-[color:var(--color-text)] text-sm font-medium">
              {t('estimate.assumptions')}
            </h3>
            <p className="mt-2">{t('estimate.assumptionsBody')}</p>
          </section>
        </>
      )}

      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        userStatus={userPaywallStatus}
        onUpgrade={() => void handleUpgrade()}
        upgradeLoading={checkoutLoading}
        upgradeError={checkoutError}
        closeLabel={t('paywall.ctaClose')}
      />
    </main>
  );
}
