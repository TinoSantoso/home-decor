import type { ZoneType } from '../zones';

export const LAYOUT_V2_VERSION = 2 as const;

export const LAYOUT_V2_TERRAIN_MATERIALS = [
  'grass',
  'paving',
  'gravel',
  'decking',
  'soil',
] as const;

export const LAYOUT_V2_FLOOR_MATERIALS = [
  'tile',
  'wood',
  'concrete',
  'stone',
  'outdoor',
] as const;

export const LAYOUT_V2_WALL_MATERIALS = [
  'paint',
  'brick',
  'wood_panel',
  'concrete',
] as const;

export const LAYOUT_V2_OPENING_TYPES = ['door', 'window'] as const;

export type LayoutV2AreaKind = 'indoor' | 'outdoor';
export type LayoutV2TerrainMaterial = (typeof LAYOUT_V2_TERRAIN_MATERIALS)[number];
export type LayoutV2FloorMaterial = (typeof LAYOUT_V2_FLOOR_MATERIALS)[number];
export type LayoutV2WallMaterial = (typeof LAYOUT_V2_WALL_MATERIALS)[number];
export type LayoutV2OpeningType = (typeof LAYOUT_V2_OPENING_TYPES)[number];

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutV2Floor {
  id: string;
  name: string;
  level: number;
  elevationM: number;
}

export interface LayoutV2Area {
  id: string;
  zoneId: string;
  floorId: string;
  name: string;
  zoneType: ZoneType;
  kind: LayoutV2AreaKind;
  points: LayoutPoint[];
  floorMaterial: LayoutV2FloorMaterial;
  wallMaterial: LayoutV2WallMaterial;
  terrainMaterial?: LayoutV2TerrainMaterial;
}

export interface LayoutV2Wall {
  id: string;
  areaId: string;
  floorId: string;
  start: LayoutPoint;
  end: LayoutPoint;
  heightM: number;
  thicknessM: number;
  material: LayoutV2WallMaterial;
  exterior: boolean;
}

export interface LayoutV2Opening {
  id: string;
  wallId: string;
  type: LayoutV2OpeningType;
  offsetM: number;
  widthM: number;
  heightM: number;
  sillHeightM: number;
}

export interface LayoutV2 {
  version: typeof LAYOUT_V2_VERSION;
  activeFloorId: string;
  floors: LayoutV2Floor[];
  areas: LayoutV2Area[];
  walls: LayoutV2Wall[];
  openings: LayoutV2Opening[];
}
