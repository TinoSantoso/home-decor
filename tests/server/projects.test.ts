import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRecord } from '../../src/lib/db/types';
import { createProjectService, type ProjectDb } from '../../src/server/projects';

const now = new Date('2026-05-28T00:00:00.000Z');

function record(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'project-1',
    name: 'Rumah Test',
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
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  const project = record(overrides['data'] as Partial<ProjectRecord> | undefined);
  return {
    id: project.id,
    userId: 'user-1',
    name: project.name,
    templateId: project.templateId,
    climateZone: project.climateZone,
    budgetTier: project.budgetTier,
    contingencyPct: project.contingencyPct,
    taxEnabled: project.taxEnabled,
    currency: 'IDR',
    createdAt: now,
    updatedAt: now,
    data: project,
    ...overrides,
  };
}

function createDb(): ProjectDb {
  return {
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

let db: ProjectDb;

beforeEach(() => {
  db = createDb();
});

describe('createProjectService', () => {
  it('creates a user-owned project record', async () => {
    vi.mocked(db.project.create).mockResolvedValue(row());
    const service = createProjectService(db, {
      now: () => now,
      id: () => 'project-1',
    });

    const result = await service.createProject('user-1', {
      name: 'Rumah Test',
      templateId: 'rumah-tapak-t36',
      budgetTier: 'standar',
      contingencyPct: 0.1,
      taxEnabled: false,
      climateZone: 'tropical_indonesia',
    });

    expect(result.id).toBe('project-1');
    expect(db.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'project-1',
        userId: 'user-1',
        name: 'Rumah Test',
        data: expect.objectContaining({ id: 'project-1', name: 'Rumah Test' }),
      }),
    });
  });

  it('lists only projects for the current user', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      row({ data: record({ id: 'project-2' }) }),
    ]);
    const service = createProjectService(db);

    const result = await service.listProjects('user-1');

    expect(db.project.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(result[0]?.id).toBe('project-2');
  });

  it('returns null when a project is not owned by the current user', async () => {
    vi.mocked(db.project.findFirst).mockResolvedValue(null);
    const service = createProjectService(db);

    await expect(service.getProject('user-2', 'project-1')).resolves.toBeNull();

    expect(db.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1', userId: 'user-2' },
    });
  });

  it('saves only a project owned by the current user', async () => {
    vi.mocked(db.project.findFirst).mockResolvedValue(row());
    vi.mocked(db.project.update).mockResolvedValue(
      row({ data: record({ name: 'Updated' }) }),
    );
    const service = createProjectService(db, { now: () => now });

    const result = await service.saveProject(
      'user-1',
      record({ name: 'Updated' }),
    );

    expect(result?.name).toBe('Updated');
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        name: 'Updated',
        data: expect.objectContaining({ name: 'Updated' }),
      }),
    });
  });

  it('preserves layout v2 data when saving a project', async () => {
    const layoutV2 = {
      version: 2 as const,
      activeFloorId: 'floor-1',
      floors: [{ id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 }],
      areas: [],
      walls: [],
      openings: [],
    };
    vi.mocked(db.project.findFirst).mockResolvedValue(row());
    vi.mocked(db.project.update).mockResolvedValue(row({ data: record({ layoutV2 }) }));
    const service = createProjectService(db, { now: () => now });

    const result = await service.saveProject('user-1', record({ layoutV2 }));

    expect(result?.layoutV2).toEqual(layoutV2);
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: expect.objectContaining({ data: expect.objectContaining({ layoutV2 }) }),
    });
  });

  it('imports a local project for the current user while preserving its id', async () => {
    vi.mocked(db.project.findFirst).mockResolvedValue(null);
    vi.mocked(db.project.create).mockResolvedValue(
      row({ data: record({ id: 'local-1' }) }),
    );
    const service = createProjectService(db, { now: () => now });

    const result = await service.importProject('user-1', record({ id: 'local-1' }));

    expect(result?.id).toBe('local-1');
    expect(db.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'local-1',
        userId: 'user-1',
        data: expect.objectContaining({ id: 'local-1' }),
      }),
    });
  });

  it('generates a share token only for an owned project', async () => {
    vi.mocked(db.project.findFirst).mockResolvedValue(row());
    vi.mocked(db.project.update).mockResolvedValue(
      row({ data: record({ shareToken: 'share-token-1' }) }),
    );
    const service = createProjectService(db, {
      now: () => now,
      token: () => 'share-token-1',
    });

    const result = await service.generateShareToken('user-1', 'project-1');

    expect(result?.token).toBe('share-token-1');
    expect(db.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1', userId: 'user-1' },
    });
  });

  it('loads a shared project by valid token without auth', async () => {
    vi.mocked(db.project.findFirst).mockResolvedValue(
      row({ data: record({ shareToken: 'token', shareTokenExpiry: now.getTime() + 1000 }) }),
    );
    const service = createProjectService(db, { now: () => now });

    await expect(service.getSharedProject('project-1', 'token')).resolves.toMatchObject({
      id: 'project-1',
    });
  });
});
