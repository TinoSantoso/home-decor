import { useMemo } from 'react';
import * as THREE from 'three';
import { getLayoutAreaFill } from '../../lib/layout-v2/materials';
import { areaToShapePoints } from '../../lib/layout-v2/tour-transform';
import type { LayoutV2Area } from '../../lib/layout-v2/types';

export function LayoutAreaMesh({ area, elevationM }: { area: LayoutV2Area; elevationM: number }) {
  const shape = useMemo(() => {
    const [first, ...rest] = areaToShapePoints(area.points);
    const next = new THREE.Shape();
    if (!first) return next;
    next.moveTo(first[0], first[1]);
    for (const point of rest) next.lineTo(point[0], point[1]);
    next.closePath();
    return next;
  }, [area.points]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, elevationM + 0.015, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={getLayoutAreaFill(area)} roughness={0.8} />
    </mesh>
  );
}
