import { describe, expect, it } from 'vitest';
import type { ProjectRecord } from '../../src/lib/db/types';
import { planLocalProjectImports } from '../../src/lib/project-migration';

const baseProject: ProjectRecord = {
  id: 'local-1',
  name: 'Rumah Lokal',
  templateId: 'rumah-tapak-t36',
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  styleTag: null,
  floorPlanImageUrl: null,
  shareToken: null,
  shareTokenExpiry: null,
  zones: [],
  placedItems: [],
  createdAt: 1,
  updatedAt: 2,
};

describe('planLocalProjectImports', () => {
  it('returns local projects missing from cloud by id', () => {
    expect(
      planLocalProjectImports({
        localProjects: [baseProject, { ...baseProject, id: 'local-2' }],
        cloudProjects: [{ ...baseProject, id: 'local-1' }],
      }).map((project) => project.id),
    ).toEqual(['local-2']);
  });

  it('returns an empty list when all local projects already exist in cloud', () => {
    expect(
      planLocalProjectImports({
        localProjects: [baseProject],
        cloudProjects: [baseProject],
      }),
    ).toEqual([]);
  });
});
