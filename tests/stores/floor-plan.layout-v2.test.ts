import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests, useFloorPlan } from '../../src/stores/floor-plan';
import type { ProjectRecord } from '../../src/lib/db/types';

const project: ProjectRecord = {
  id: 'project-1',
  name: 'Rumah',
  templateId: null,
  budgetTier: 'standar',
  contingencyPct: 0.1,
  taxEnabled: false,
  climateZone: 'tropical_indonesia',
  styleTag: null,
  floorPlanImageUrl: null,
  shareToken: null,
  shareTokenExpiry: null,
  zones: [
    {
      id: 'z1',
      type: 'living_room',
      name: 'Ruang Tamu',
      x: 0,
      y: 0,
      width: 80,
      height: 60,
    },
  ],
  placedItems: [],
  createdAt: 1,
  updatedAt: 2,
};

beforeEach(() => resetForTests());

describe('floor-plan layout v2 state', () => {
  it('migrates old rectangular projects to layout v2 on load', () => {
    useFloorPlan.getState().loadProject(project);
    expect(useFloorPlan.getState().layoutV2?.areas[0]?.zoneId).toBe('z1');
  });

  it('adds a second floor and makes it active', () => {
    useFloorPlan.getState().loadProject(project);
    const floorId = useFloorPlan.getState().addFloor();
    expect(useFloorPlan.getState().layoutV2?.activeFloorId).toBe(floorId);
    expect(useFloorPlan.getState().layoutV2?.floors).toHaveLength(2);
  });

  it('updates area points and persists them to project record', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().updateAreaPoints('area-z1', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 },
    ]);
    expect(
      useFloorPlan.getState().toProjectRecord()?.layoutV2?.areas[0]?.points[1],
    ).toEqual({ x: 100, y: 0 });
  });

  it('adds a door opening to a wall', () => {
    useFloorPlan.getState().loadProject(project);
    const wallId = useFloorPlan.getState().layoutV2!.walls[0]!.id;
    const openingId = useFloorPlan.getState().addOpening(wallId, 'door');
    expect(useFloorPlan.getState().layoutV2?.openings).toContainEqual(
      expect.objectContaining({
        id: openingId,
        wallId,
        type: 'door',
        widthM: 0.9,
      }),
    );
  });

  it('adds a matching layout area when a classic zone is added', () => {
    useFloorPlan.getState().loadProject(project);
    const zoneId = useFloorPlan.getState().addZone('garden', 'Taman');

    const area = useFloorPlan
      .getState()
      .layoutV2?.areas.find((candidate) => candidate.zoneId === zoneId);
    expect(area).toMatchObject({
      zoneId,
      name: 'Taman',
      kind: 'outdoor',
      terrainMaterial: 'grass',
    });
    expect(
      useFloorPlan
        .getState()
        .layoutV2?.walls.filter((wall) => wall.areaId === `area-${zoneId}`),
    ).toHaveLength(4);
  });

  it('adds a matching layout area when a classic zone is duplicated', () => {
    useFloorPlan.getState().loadProject(project);
    const zoneId = useFloorPlan.getState().duplicateZone('z1');

    const area = useFloorPlan
      .getState()
      .layoutV2?.areas.find((candidate) => candidate.zoneId === zoneId);
    expect(area).toMatchObject({
      zoneId,
      id: `area-${zoneId}`,
      name: 'Ruang Tamu (salinan)',
      kind: 'indoor',
    });
    expect(
      useFloorPlan
        .getState()
        .layoutV2?.walls.filter((wall) => wall.areaId === `area-${zoneId}`),
    ).toHaveLength(4);
  });

  it('updates layout area points when a classic zone rectangle changes', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().updateZone('z1', { width: 100 });

    expect(useFloorPlan.getState().layoutV2?.areas[0]?.points[1]).toEqual({
      x: 100,
      y: 0,
    });
  });

  it('removes matching layout area, walls, and openings when a classic zone is deleted', () => {
    useFloorPlan.getState().loadProject(project);
    const wallId = useFloorPlan.getState().layoutV2!.walls[0]!.id;
    useFloorPlan.getState().addOpening(wallId, 'door');

    useFloorPlan.getState().deleteZone('z1');

    expect(useFloorPlan.getState().layoutV2?.areas).toEqual([]);
    expect(useFloorPlan.getState().layoutV2?.walls).toEqual([]);
    expect(useFloorPlan.getState().layoutV2?.openings).toEqual([]);
  });

  it('keeps selected layout wall when deleting a different classic zone', () => {
    useFloorPlan.getState().loadProject(project);
    const zoneId = useFloorPlan.getState().addZone('bedroom', 'Kamar Tidur');
    const selectedWallId = useFloorPlan
      .getState()
      .layoutV2?.walls.find((wall) => wall.areaId === `area-${zoneId}`)?.id;
    expect(selectedWallId).toBeDefined();

    useFloorPlan.getState().selectLayoutWall(selectedWallId!);
    useFloorPlan.getState().deleteZone('z1');

    expect(useFloorPlan.getState().selectedLayoutWallId).toBe(selectedWallId);
  });

  it('creates a classic compatibility zone when adding an advanced layout area', () => {
    useFloorPlan.getState().loadProject(project);
    const areaId = useFloorPlan
      .getState()
      .addLayoutArea('terrace', 'Teras Baru');

    const area = useFloorPlan
      .getState()
      .layoutV2?.areas.find((candidate) => candidate.id === areaId);
    expect(area).toMatchObject({
      zoneType: 'terrace',
      name: 'Teras Baru',
      kind: 'outdoor',
    });
    expect(
      useFloorPlan.getState().zones.some((zone) => zone.id === area?.zoneId),
    ).toBe(true);
  });

  it('updates the classic compatibility zone bounds when polygon points change', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().updateAreaPoints('area-z1', [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 80 },
      { x: 10, y: 80 },
    ]);

    expect(useFloorPlan.getState().zones[0]).toMatchObject({
      x: 10,
      y: 20,
      width: 100,
      height: 60,
    });
  });

  it('clears selected layout wall when updated area points remove that wall', () => {
    useFloorPlan.getState().loadProject(project);
    useFloorPlan.getState().selectLayoutWall('wall-area-z1-3');

    useFloorPlan.getState().updateAreaPoints('area-z1', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 60 },
    ]);

    expect(useFloorPlan.getState().selectedLayoutWallId).toBeNull();
  });
});
