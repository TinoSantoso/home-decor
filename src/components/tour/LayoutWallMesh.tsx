import { getLayoutWallColor } from '../../lib/layout-v2/materials';
import { wallToMeshTransform } from '../../lib/layout-v2/tour-transform';
import type { LayoutV2Wall } from '../../lib/layout-v2/types';

export function LayoutWallMesh({ wall, elevationM }: { wall: LayoutV2Wall; elevationM: number }) {
  const transform = wallToMeshTransform(wall, elevationM);

  return (
    <mesh position={transform.position} rotation={[0, -transform.rotationY, 0]} castShadow receiveShadow>
      <boxGeometry args={transform.scale} />
      <meshStandardMaterial color={getLayoutWallColor(wall.material)} roughness={0.75} />
    </mesh>
  );
}
