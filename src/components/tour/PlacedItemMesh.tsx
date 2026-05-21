import { Detailed } from '@react-three/drei';
import type { Item, StyleTag } from '../../lib/catalog';
import { cmToMeters } from '../../lib/tour-placement';
import { getItemPlaceholderColor } from '../../lib/tour-materials';
import { PlacedItemModel } from './PlacedItemModel';
import { resolveAssetUrl } from '../../lib/asset-urls';

interface PlacedItemMeshProps {
  item: Item;
  /** World-space position [x, y, z] in meters. */
  position: [number, number, number];
  /** Current style tag for color palette lookup. */
  styleTag: StyleTag | null;
}

/**
 * Distance (meters) beyond which the LOD switches from GLB mesh to the
 * cheap primitive placeholder. 8 m gives a comfortable close-range view
 * in rooms that are typically 5–12 m across, while still offloading GPU
 * cost for items in the background.
 */
const ITEM_LOD_FAR_M = 8;

/**
 * Renders a catalog item as a primitive placeholder mesh (box or cylinder)
 * scaled from the item's catalog `dimensions` (cm → m).
 *
 * When the item has an `asset3dUrl`, wraps both the GLB and the primitive in
 * drei's `<Detailed>` (LOD) component: GLB is shown within ITEM_LOD_FAR_M
 * meters, primitive beyond that. Items without `asset3dUrl` render the
 * primitive directly with no `<Detailed>` overhead.
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

  const primitiveMesh =
    item.category === 'lighting' ? (
      // Cylinder: radiusTop, radiusBottom, height, radialSegments
      <mesh position={meshPosition}>
        <cylinderGeometry args={[Math.max(w, d) / 2, Math.max(w, d) / 2, h, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    ) : (
      <mesh position={meshPosition} scale={[w, h, d]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );

  const resolvedUrl = resolveAssetUrl(item.asset3dUrl);

  if (resolvedUrl) {
    // LOD: GLB mesh up close, primitive placeholder at distance.
    return (
      <Detailed distances={[0, ITEM_LOD_FAR_M]}>
        <PlacedItemModel
          url={resolvedUrl}
          position={meshPosition}
          scale={[w, h, d]}
        />
        {primitiveMesh}
      </Detailed>
    );
  }

  return primitiveMesh;
}
