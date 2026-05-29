/**
 * TDD: generateEstimatePdf server function.
 * Mocks @react-pdf/renderer so no real PDF rendering is needed at test time.
 * Also mocks @supabase/ssr so serverAuthMiddleware works in node test env.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

// ---------- Mock tracking ----------
const renderToBufferCalls: unknown[] = [];
const mockBuffer = Buffer.from('mock-pdf-content');

// Use vi.hoisted so mocks are available at module-load time (hoisted alongside vi.mock).
const { renderToBufferMock } = vi.hoisted(() => {
  return {
    renderToBufferMock: vi.fn().mockImplementation((doc: unknown) => {
      renderToBufferCalls.push(doc);
      return Promise.resolve(mockBuffer);
    }),
  };
});

// Partial mock: keeps real StyleSheet (needed by EstimatePdfDocument), only overrides renderToBuffer.
vi.mock('@react-pdf/renderer', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@react-pdf/renderer');
  return {
    ...actual,
    renderToBuffer: renderToBufferMock,
  };
});

// Mock @supabase/ssr so auth-middleware doesn't try to import the real browser client.
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}));

// Import AFTER vi.mock so the mock is in place.
import {
  generateEstimatePdf,
  generateEstimatePdfFn,
  resolveExportPdfEntitlement,
} from '../../src/server/generate-pdf';
import type { EstimatePdfInput } from '../../src/server/generate-pdf';

const baseInput: EstimatePdfInput = {
  estimate: {
    materialsTotal: 500_000,
    laborTotal: 125_000,
    contingency: 62_500,
    tax: 75_313,
    grandTotal: 762_813,
    perCategory: [
      { category: 'furniture', materials: 500_000, labor: 0, total: 500_000 },
      { category: 'lighting', materials: 0, labor: 125_000, total: 125_000 },
    ],
    perZone: [
      { zoneId: 'z1', materials: 350_000, labor: 87_500, total: 437_500 },
      { zoneId: 'z2', materials: 150_000, labor: 37_500, total: 187_500 },
    ],
  },
  zones: [
    { id: 'z1', type: 'living_room', name: 'Ruang Tamu' },
    { id: 'z2', type: 'bedroom', name: 'Kamar Tidur' },
  ],
  projectName: 'Rumah Idaman',
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: true,
  localeTag: 'id-ID',
  zoneTypeLabels: { z1: 'Ruang Tamu', z2: 'Kamar Tidur' },
  categoryLabels: { furniture: 'Furnitur', lighting: 'Pencahayaan' },
  labels: {
    title: 'Estimasi Renovasi',
    generatedAt: 'Dibuat',
    tier: 'Tingkat',
    materials: 'Material',
    labor: 'Tenaga Kerja',
    contingency: 'Kontingensi',
    tax: 'Pajak',
    grandTotal: 'Total',
    zoneTotal: 'Per Ruangan',
    categoryTotal: 'Per Kategori',
    assumptions: 'Asumsi',
    assumptionsBody: 'Estimasi ini bersifat perkiraan.',
    zoneColumnName: 'Ruangan',
    zoneColumnMeta: 'Tipe',
    categoryColumnName: 'Kategori',
    taxLine: 'Termasuk PPN 11%',
  },
};

describe('generateEstimatePdf', () => {
  beforeEach(() => {
    renderToBufferCalls.length = 0;
    renderToBufferMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a pdfBytes buffer and filename', async () => {
    const result = await generateEstimatePdf(baseInput);

    expect(result.pdfBytes).toBeInstanceOf(Buffer);
    expect(typeof result.filename).toBe('string');
    expect(result.filename).toContain('Rumah-Idaman');
  });

  it('returns Indonesian filename when localeTag is id-ID', async () => {
    const result = await generateEstimatePdf(baseInput);

    expect(result.filename).toMatch(/^Rencana-Proyek-/);
    expect(result.filename).toMatch(/\.pdf$/);
  });

  it('returns English filename when localeTag is en-US', async () => {
    const result = await generateEstimatePdf({
      ...baseInput,
      localeTag: 'en-US',
      projectName: 'Dream House',
    });

    expect(result.filename).toMatch(/^Project-Plan-/);
  });

  it('sanitises filenames by removing unsafe characters', async () => {
    const result = await generateEstimatePdf({
      ...baseInput,
      projectName: 'Rumah!@#$%^&*()Idaman',
    });

    expect(result.filename).not.toContain('!@#$%^&*()');
    // All non-word chars (including !) removed, so no hyphens introduced
    expect(result.filename).toContain('RumahIdaman');
  });

  it('falls back to "proyek" when projectName is empty', async () => {
    const result = await generateEstimatePdf({ ...baseInput, projectName: '' });

    expect(result.filename).toContain('proyek');
  });

  it('calls renderToBuffer with the EstimatePdfDocument component', async () => {
    await generateEstimatePdf(baseInput);

    expect(renderToBufferCalls).toHaveLength(1);
  });

  it('rejects when estimate is missing required fields', async () => {
    const bad = { ...baseInput, estimate: { ...baseInput.estimate, materialsTotal: undefined } };
    // @ts-expect-error intentionally invalid for runtime test
    await expect(generateEstimatePdf(bad)).rejects.toThrow();
  });

  it('rejects when budgetTier is invalid', async () => {
    const bad = { ...baseInput, budgetTier: 'invalid-tier' };
    // @ts-expect-error intentionally invalid for runtime test
    await expect(generateEstimatePdf(bad)).rejects.toThrow();
  });
});

describe('generateEstimatePdfFn (TanStack server function)', () => {
  it('is exposed as a POST server function', () => {
    expect(generateEstimatePdfFn.method).toBe('POST');
  });
});

describe('resolveExportPdfEntitlement', () => {
  it('allows unlimited users without consuming export credits', async () => {
    const consumeExportCredit = vi.fn().mockResolvedValue({
      success: true,
      exportsRemaining: 4,
    });

    const result = await resolveExportPdfEntitlement('user-1', {
      hasActiveUnlimited: vi.fn().mockResolvedValue(true),
      consumeExportCredit,
    });

    expect(result).toEqual({ allowed: true, exportsRemaining: null });
    expect(consumeExportCredit).not.toHaveBeenCalled();
  });
});
