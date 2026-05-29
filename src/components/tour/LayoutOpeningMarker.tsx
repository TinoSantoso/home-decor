import { openingToMarkerTransform } from '../../lib/layout-v2/tour-transform';
import type { LayoutV2Opening, LayoutV2Wall } from '../../lib/layout-v2/types';

export function LayoutOpeningMarker({
  wall,
  opening,
  elevationM,
}: {
  wall: LayoutV2Wall;
  opening: LayoutV2Opening;
  elevationM: number;
}) {
  const transform = openingToMarkerTransform(wall, opening, elevationM);

  return (
    <mesh position={transform.position} rotation={[0, -transform.rotationY, 0]}>
      <boxGeometry args={transform.scale} />
      <meshStandardMaterial
        color={opening.type === 'door' ? '#7c4f2d' : '#8cc7ff'}
        transparent
        opacity={0.82}
      />
    </mesh>
  );
}
