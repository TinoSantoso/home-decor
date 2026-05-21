import type { ThreeEvent } from '@react-three/fiber';
import type { ZoneTransform } from '../../lib/tour-transform';

interface ZoneMeshProps {
  transform: ZoneTransform;
  color: string;
  isSelected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * Renders a single zone as a translucent box in the 3D tour scene.
 * Extracted from TourScene in Phase 2 slice 3.
 *
 * Must be rendered inside a `<Canvas>` (R3F context).
 */
export function ZoneMesh({ transform, color, isSelected, onClick }: ZoneMeshProps) {
  return (
    <mesh
      position={transform.position}
      scale={transform.scale}
      onClick={onClick}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={isSelected ? 0.92 : 0.7}
      />
    </mesh>
  );
}
