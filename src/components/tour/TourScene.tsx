import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useFloorPlan } from '../../stores/floor-plan';
import {
  DEFAULT_BOX_HEIGHT_M,
  computeGroundSize,
  zoneToTransform,
} from '../../lib/tour-transform';
import { TOUR_GROUND_COLOR, TOUR_ZONE_COLORS_3D } from '../../lib/tour-colors';
import { TourControls } from './TourControls';
import { TourModeToggle } from './TourModeToggle';

/**
 * Phase 2 slice 1: orbital 3D view of the floor plan with each zone
 * rendered as a translucent box.
 *
 * Phase 2 slice 2: toggleable first-person walk mode via TourControls.
 *
 * Rendered only inside an `ssr: false` route. Canvas mounts a WebGL
 * context, so SSR would throw.
 */
export default function TourScene() {
  const zones = useFloorPlan((s) => s.zones);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const tourMode = useFloorPlan((s) => s.tourMode);

  const groundSize = useMemo(() => computeGroundSize(zones), [zones]);
  const transforms = useMemo(() => zones.map((z) => zoneToTransform(z)), [zones]);
  const center: [number, number, number] = [
    groundSize / 2,
    DEFAULT_BOX_HEIGHT_M / 2,
    groundSize / 2,
  ];

  return (
    <div className="relative h-[700px] w-full overflow-hidden rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[oklch(95%_0.005_95)]">
      <Canvas
        camera={{
          position: [groundSize * 0.9, groundSize * 0.8, groundSize * 1.2],
          fov: 45,
          near: 0.1,
          far: groundSize * 5,
        }}
        onPointerMissed={() => selectZone(null)}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[groundSize, groundSize * 1.5, groundSize / 2]}
            intensity={0.9}
          />

          {/* Ground plane */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[groundSize / 2, 0, groundSize / 2]}
            receiveShadow
          >
            <planeGeometry args={[groundSize, groundSize]} />
            <meshStandardMaterial color={TOUR_GROUND_COLOR} />
          </mesh>

          {/* 1 m grid overlay for scale */}
          <Grid
            position={[groundSize / 2, 0.01, groundSize / 2]}
            args={[groundSize, groundSize]}
            cellSize={1}
            cellThickness={0.5}
            // Three.js color parser doesn't accept oklch() — use hex.
            cellColor="#ccc8c0"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#8a8478"
            fadeDistance={groundSize * 1.5}
            fadeStrength={1}
            infiniteGrid={false}
          />

          {/* Zone boxes */}
          {transforms.map((t, idx) => {
            const zone = zones[idx]!;
            const color = TOUR_ZONE_COLORS_3D[zone.type];
            const isSelected = zone.id === selectedZoneId;
            return (
              <mesh
                key={t.zoneId}
                position={t.position}
                scale={t.scale}
                onClick={(e) => {
                  e.stopPropagation();
                  selectZone(zone.id);
                }}
              >
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial
                  color={color}
                  transparent
                  opacity={isSelected ? 0.92 : 0.7}
                />
              </mesh>
            );
          })}

          <TourControls
            mode={tourMode}
            target={center}
            minDistance={2}
            maxDistance={groundSize * 4}
          />
        </Suspense>
      </Canvas>

      {/* Overlay button — outside Canvas, plain DOM */}
      <TourModeToggle />
    </div>
  );
}
