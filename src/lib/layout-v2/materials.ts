import type {
  LayoutV2AreaKind,
  LayoutV2FloorMaterial,
  LayoutV2TerrainMaterial,
  LayoutV2WallMaterial,
} from './types';

const FLOOR_COLORS: Record<LayoutV2FloorMaterial, string> = {
  tile: '#d8d2c4',
  wood: '#b58a5b',
  concrete: '#b8b8b0',
  stone: '#9f9b8f',
  outdoor: '#8ea875',
};

const TERRAIN_COLORS: Record<LayoutV2TerrainMaterial, string> = {
  grass: '#6f9f5f',
  paving: '#b7aa96',
  gravel: '#9c9c94',
  decking: '#a8754f',
  soil: '#79553b',
};

const WALL_COLORS: Record<LayoutV2WallMaterial, string> = {
  paint: '#eee7dc',
  brick: '#a66a4b',
  wood_panel: '#9a6b43',
  concrete: '#b6b1a8',
};

export function getLayoutAreaFill(area: {
  kind: LayoutV2AreaKind;
  floorMaterial: LayoutV2FloorMaterial;
  terrainMaterial?: LayoutV2TerrainMaterial;
}): string {
  if (area.kind === 'outdoor' && area.terrainMaterial) return TERRAIN_COLORS[area.terrainMaterial];
  return FLOOR_COLORS[area.floorMaterial];
}

export function getLayoutWallColor(material: LayoutV2WallMaterial): string {
  return WALL_COLORS[material];
}
