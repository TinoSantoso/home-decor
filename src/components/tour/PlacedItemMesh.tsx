import type { Item } from '../../lib/catalog';
import { cmToMeters } from '../../lib/tour-placement';

/**
 * Temporary hex color for item placeholders until slice 4 introduces
 * style-driven palette lookups. Three.js color parser rejects oklch().
 */
const ITEM_PLACEHOLDER_HEX = '#8a7d6a';

interface PlacedItemMeshProps {
  item: Item;
  /** World-space position [x, y, z] in meters. */
  position: [number, number, number];
}

/**
 * Renders a catalog item as a primitive placeholder mesh (box or cylinder)
 * scaled from the item's catalog `dimensions` (cm → m).
 *
 * Shape selection:
 *   - `lighting` → cylinderGeometry (lamps, pendants)
 *   - everything else → boxGeometry
 *
 * Slice 4 will replace ITEM_PLACEHOLDER_HEX with style-driven palette lookups.
 *
 * Must be rendered inside a `<Canvas>` (R3F context).
 */
export function PlacedItemMesh({ item, position }: PlacedItemMeshProps) {
  const { widthCm, depthCm, heightCm } = item.dimensions;
  const w = cmToMeters(widthCm);
  const d = cmToMeters(depthCm);
  const h = cmToMeters(heightCm);

  // Place the bottom of the mesh on the ground (y = h/2).
  const meshPosition: [number, number, number] = [position[0], h / 2, position[2]];

  if (item.category === 'lighting') {
    // Cylinder: radiusTop, radiusBottom, height, radialSegments
    const radius = Math.max(w, d) / 2;
    return (
      <mesh position={meshPosition}>
        <cylinderGeometry args={[radius, radius, h, 12]} />
        <meshStandardMaterial color={ITEM_PLACEHOLDER_HEX} />
      </mesh>
    );
  }

  return (
    <mesh position={meshPosition} scale={[w, h, d]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={ITEM_PLACEHOLDER_HEX} />
    </mesh>
  );
}
