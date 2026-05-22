/**
 * Slice 4 — floor-plan reference image URL is a first-class store field.
 *
 * Acceptance: a project record can carry a public R2 URL pointing at a
 * floor-plan reference (sketch, photo, screenshot). The store loads it,
 * exposes a setter so the upload hook can update it, and round-trips it
 * back into a ProjectRecord for IDB auto-save.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useFloorPlan, resetForTests } from '../../src/stores/floor-plan';
import type { ProjectRecord } from '../../src/lib/db/types';

beforeEach(() => {
  resetForTests();
});

function baseRecord(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'proj-test',
    name: 'Test Project',
    templateId: null,
    budgetTier: 'standar',
    contingencyPct: 0.1,
    taxEnabled: false,
    climateZone: 'tropical_indonesia',
    styleTag: null,
    floorPlanImageUrl: null,
    zones: [],
    placedItems: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('floor-plan store: floorPlanImageUrl', () => {
  it('defaults to null in the initial state', () => {
    expect(useFloorPlan.getState().floorPlanImageUrl).toBeNull();
  });

  it('loads from a ProjectRecord that carries a URL', () => {
    useFloorPlan.getState().loadProject(
      baseRecord({ floorPlanImageUrl: 'https://cdn.example.com/floor-plan.png' }),
    );

    expect(useFloorPlan.getState().floorPlanImageUrl).toBe(
      'https://cdn.example.com/floor-plan.png',
    );
  });

  it('treats a legacy record (field omitted) as null on load', () => {
    // Simulate a pre-slice-4 IDB record by casting through unknown.
    const legacy = {
      id: 'proj-legacy',
      name: 'Legacy',
      templateId: null,
      budgetTier: 'standar',
      contingencyPct: 0.1,
      taxEnabled: false,
      climateZone: 'tropical_indonesia',
      styleTag: null,
      zones: [],
      placedItems: [],
      createdAt: 0,
      updatedAt: 0,
    } as unknown as ProjectRecord;

    useFloorPlan.getState().loadProject(legacy);

    expect(useFloorPlan.getState().floorPlanImageUrl).toBeNull();
  });

  it('updates via setFloorPlanImageUrl', () => {
    useFloorPlan.getState().loadProject(baseRecord());
    useFloorPlan.getState().setFloorPlanImageUrl('https://cdn.example.com/new.png');

    expect(useFloorPlan.getState().floorPlanImageUrl).toBe(
      'https://cdn.example.com/new.png',
    );
  });

  it('clears via setFloorPlanImageUrl(null)', () => {
    useFloorPlan
      .getState()
      .loadProject(baseRecord({ floorPlanImageUrl: 'https://cdn.example.com/x.png' }));
    useFloorPlan.getState().setFloorPlanImageUrl(null);

    expect(useFloorPlan.getState().floorPlanImageUrl).toBeNull();
  });

  it('serializes the URL into toProjectRecord output', () => {
    useFloorPlan
      .getState()
      .loadProject(baseRecord({ floorPlanImageUrl: 'https://cdn.example.com/a.png' }));
    useFloorPlan.getState().setFloorPlanImageUrl('https://cdn.example.com/b.png');

    const out = useFloorPlan.getState().toProjectRecord();
    expect(out).not.toBeNull();
    expect(out!.floorPlanImageUrl).toBe('https://cdn.example.com/b.png');
  });

  it('resetForTests clears the URL back to null', () => {
    useFloorPlan
      .getState()
      .loadProject(baseRecord({ floorPlanImageUrl: 'https://x/x.png' }));
    expect(useFloorPlan.getState().floorPlanImageUrl).toBe('https://x/x.png');

    resetForTests();

    expect(useFloorPlan.getState().floorPlanImageUrl).toBeNull();
  });
});
