import type { Item, StyleTag } from '../../lib/catalog';
import { cmToMeters } from '../../lib/tour-placement';
import { getItemPlaceholderColor } from '../../lib/tour-materials';

interface PlacedItemMeshProps {
  item: Item;
  /** World-space position [x, y, z] in meters. */
  position: [number, number, number];
  /** Current style tag for color palette lookup. */
  styleTag: StyleTag | null;
}

/**
 * Renders a catalog item as a primitive placeholder mesh (box or cylinder)
 * scaled from the item's catalog `dimensions` (cm → m).
 *
 * Shape selection:
 *   - `lighting` → cylinderGeometry (lamps, pendants)
 *   - everything else → boxGeometry
 *
 * Color is derived from getItemPlaceholderColor based on category + styleTag.
 *
 * Must be rendered inside a `<Canvas>` (R3F context).
 */
export function PlacedItemMesh({ item, position, styleTag }: PlacedItemMeshProps) {
  const { widthCm, depthCm, heightCm } = item.dimensions;
  const w = cmToMeters(widthCm);
  const d = cmToMeters(depthCm);
  const h = cmToMeters(heightCm);
  const color = getItemPlaceholderColor(item.category, styleTag);

  // Place the bottom of the mesh on the ground (y = h/2).
  const meshPosition: [number, number, number] = [position[0], h / 2, position[2]];

  if (item.category === 'lighting') {
    // Cylinder: radiusTop, radiusBottom, height, radialSegments
    const radius = Math.max(w, d) / 2;
    return (
      <mesh position={meshPosition}>
        <cylinderGeometry args={[radius, radius, h, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return (
    <mesh position={meshPosition} scale={[w, h, d]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
