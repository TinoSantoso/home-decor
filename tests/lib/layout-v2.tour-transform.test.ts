import { describe, expect, it } from 'vitest';
import { metersToPx } from '../../src/lib/zones';
import {
  areaToShapePoints,
  getRenderableFloorIds,
  openingToMarkerTransform,
  wallToMeshTransform,
} from '../../src/lib/layout-v2/tour-transform';

describe('layout-v2 tour transforms', () => {
  it('maps polygon points from pixels to x/z meters', () => {
    expect(
      areaToShapePoints([
        { x: 0, y: 0 },
        { x: metersToPx(2), y: 0 },
        { x: metersToPx(2), y: metersToPx(1) },
      ]),
    ).toEqual([
      [0, 0],
      [2, 0],
      [2, 1],
    ]);
  });

  it('creates wall transform from a 2D segment', () => {
    expect(
      wallToMeshTransform(
        {
          id: 'wall-1',
          areaId: 'area-1',
          floorId: 'floor-1',
          start: { x: 0, y: 0 },
          end: { x: metersToPx(4), y: 0 },
          heightM: 2.7,
          thicknessM: 0.12,
          material: 'paint',
          exterior: true,
        },
        3.2,
      ),
    ).toMatchObject({
      wallId: 'wall-1',
      position: [2, 4.55, 0],
      scale: [4, 2.7, 0.12],
      rotationY: 0,
    });
  });

  it('places opening marker along a wall by meter offset', () => {
    const wall = {
      id: 'wall-1',
      areaId: 'area-1',
      floorId: 'floor-1',
      start: { x: 0, y: 0 },
      end: { x: metersToPx(4), y: 0 },
      heightM: 2.7,
      thicknessM: 0.12,
      material: 'paint' as const,
      exterior: true,
    };

    expect(
      openingToMarkerTransform(
        wall,
        {
          id: 'door-1',
          wallId: 'wall-1',
          type: 'door',
          offsetM: 1,
          widthM: 0.9,
          heightM: 2.1,
          sillHeightM: 0,
        },
        0,
      ),
    ).toMatchObject({
      openingId: 'door-1',
      position: [1, 1.05, 0.07],
      scale: [0.9, 2.1, 0.03],
    });
  });
});

describe('layout-v2 tour floor filtering', () => {
  it('renders every floor by default', () => {
    expect(getRenderableFloorIds(['floor-1', 'floor-2'], 'floor-2', 'all')).toEqual([
      'floor-1',
      'floor-2',
    ]);
  });

  it('can render only the active floor', () => {
    expect(getRenderableFloorIds(['floor-1', 'floor-2'], 'floor-2', 'active')).toEqual([
      'floor-2',
    ]);
  });
});
