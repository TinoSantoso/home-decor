import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useFloorPlan } from '../../stores/floor-plan';
import {
  DEFAULT_BOX_HEIGHT_M,
  computeGroundSize,
  zoneToTransform,
} from '../../lib/tour-transform';
import { TOUR_GROUND_COLOR } from '../../lib/tour-colors';
import { getZoneColor } from '../../lib/tour-materials';
import { loadCatalog } from '../../lib/catalog';
import type { Item } from '../../lib/catalog';
import { TourControls } from './TourControls';
import { TourModeToggle } from './TourModeToggle';
import { ZoneMesh } from './ZoneMesh';
import { PlacedItemMesh } from './PlacedItemMesh';
import { ItemPlacementPanel } from './ItemPlacementPanel';
import { useZoneClickHandler } from './useZoneClickHandler';

/**
 * Phase 2 slice 3: item placement via click-to-place. Zone boxes extracted
 * into ZoneMesh; placed items rendered as primitive meshes via PlacedItemMesh.
 */
export default function TourScene() {
  const zones = useFloorPlan((s) => s.zones);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const tourMode = useFloorPlan((s) => s.tourMode);
  const placedItems = useFloorPlan((s) => s.placedItems);
  const styleTag = useFloorPlan((s) => s.styleTag);

  const [catalog, setCatalog] = useState<Item[]>([]);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => undefined);
  }, []);

  const groundSize = useMemo(() => computeGroundSize(zones), [zones]);
  const transforms = useMemo(() => zones.map((z) => zoneToTransform(z)), [zones]);
  const center: [number, number, number] = [
    groundSize / 2,
    DEFAULT_BOX_HEIGHT_M / 2,
    groundSize / 2,
  ];

  const handleZoneClick = useZoneClickHandler();

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

          {/* 1 m grid overlay */}
          <Grid
            position={[groundSize / 2, 0.01, groundSize / 2]}
            args={[groundSize, groundSize]}
            cellSize={1}
            cellThickness={0.5}
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
            const color = getZoneColor(zone.type, styleTag);
            return (
              <ZoneMesh
                key={t.zoneId}
                transform={t}
                color={color}
                isSelected={zone.id === selectedZoneId}
                onClick={(e) => handleZoneClick(e, zone.id, t)}
              />
            );
          })}

          {/* Placed item meshes */}
          {placedItems.map((p) => {
            if (!p.position3d) return null;
            const item = catalog.find((c) => c.id === p.itemId);
            if (!item) return null;
            return (
              <PlacedItemMesh
                key={p.id}
                item={item}
                position={p.position3d}
                styleTag={styleTag}
              />
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

      {/* Overlays — outside Canvas, plain DOM */}
      <ItemPlacementPanel />
      <TourModeToggle />
    </div>
  );
}
