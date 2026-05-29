import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useFloorPlan } from '../../stores/floor-plan';
import {
  DEFAULT_BOX_HEIGHT_M,
  computeGroundSize,
  zoneToTransform,
} from '../../lib/tour-transform';
import { getRenderableFloorIds } from '../../lib/layout-v2/tour-transform';
import { TOUR_GROUND_COLOR } from '../../lib/tour-colors';
import { getZoneColor } from '../../lib/tour-materials';
import { loadCatalog } from '../../lib/catalog';
import type { Item } from '../../lib/catalog';
import type { TourSnapshot } from '../../lib/tour-snapshot';
import { TourControls } from './TourControls';
import { TourModeToggle } from './TourModeToggle';
import { ZoneMesh } from './ZoneMesh';
import { PlacedItemMesh } from './PlacedItemMesh';
import { ItemPlacementPanel } from './ItemPlacementPanel';
import { LayoutAreaMesh } from './LayoutAreaMesh';
import { LayoutOpeningMarker } from './LayoutOpeningMarker';
import { LayoutWallMesh } from './LayoutWallMesh';
import { useZoneClickHandler } from './useZoneClickHandler';

interface TourSceneProps {
  /**
   * Optional read-only snapshot of floor-plan state. When provided the
   * scene renders from the snapshot instead of pulling from the live
   * store; interactive overlays (TourModeToggle, ItemPlacementPanel)
   * are also suppressed. Used by BeforeAfterCompare (Phase 2 slice 5).
   * Default `undefined` = live store behaviour (Phase 2 slices 1-4).
   */
  snapshot?: TourSnapshot;
}

/**
 * Phase 2 slice 5: optionally renders from a static snapshot for the
 * Before/After wipe-slider compare. Zone boxes are still rendered by
 * ZoneMesh; placed items by PlacedItemMesh.
 */
export default function TourScene({ snapshot }: TourSceneProps) {
  // Live-store hooks — must always be called (Rules of Hooks). When a
  // snapshot is provided we ignore the values and read from the
  // snapshot instead.
  const liveZones = useFloorPlan((s) => s.zones);
  const liveSelectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const livePlacedItems = useFloorPlan((s) => s.placedItems);
  const liveStyleTag = useFloorPlan((s) => s.styleTag);
  const liveLayoutV2 = useFloorPlan((s) => s.layoutV2);
  const layoutTourFloorMode = useFloorPlan((s) => s.layoutTourFloorMode);

  const selectZone = useFloorPlan((s) => s.selectZone);
  const tourMode = useFloorPlan((s) => s.tourMode);

  const zones = snapshot ? snapshot.zones : liveZones;
  const selectedZoneId = snapshot ? snapshot.selectedZoneId : liveSelectedZoneId;
  const placedItems = snapshot ? snapshot.placedItems : livePlacedItems;
  const styleTag = snapshot ? snapshot.styleTag : liveStyleTag;
  const layoutV2 = snapshot ? undefined : liveLayoutV2;

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
  const isSnapshot = snapshot !== undefined;
  const renderableLayoutFloorIds = useMemo(() => {
    if (!layoutV2) return new Set<string>();
    return new Set(
      getRenderableFloorIds(
        layoutV2.floors.map((floor) => floor.id),
        layoutV2.activeFloorId,
        layoutTourFloorMode,
      ),
    );
  }, [layoutTourFloorMode, layoutV2]);

  return (
    <div className="relative h-[700px] w-full overflow-hidden rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[oklch(95%_0.005_95)]">
      <Canvas
        camera={{
          position: [groundSize * 0.9, groundSize * 0.8, groundSize * 1.2],
          fov: 45,
          near: 0.1,
          far: groundSize * 5,
        }}
        onPointerMissed={() => {
          if (!isSnapshot) selectZone(null);
        }}
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

          {layoutV2 &&
            layoutV2.areas
              .filter((area) => renderableLayoutFloorIds.has(area.floorId))
              .map((area) => {
                const floor = layoutV2.floors.find(
                  (candidate) => candidate.id === area.floorId,
                );
                return (
                  <LayoutAreaMesh
                    key={area.id}
                    area={area}
                    elevationM={floor?.elevationM ?? 0}
                  />
                );
              })}

          {layoutV2 &&
            layoutV2.walls
              .filter((wall) => renderableLayoutFloorIds.has(wall.floorId))
              .map((wall) => {
                const floor = layoutV2.floors.find(
                  (candidate) => candidate.id === wall.floorId,
                );
                return (
                  <LayoutWallMesh
                    key={wall.id}
                    wall={wall}
                    elevationM={floor?.elevationM ?? 0}
                  />
                );
              })}

          {layoutV2 &&
            layoutV2.openings.map((opening) => {
              const wall = layoutV2.walls.find(
                (candidate) => candidate.id === opening.wallId,
              );
              if (!wall || !renderableLayoutFloorIds.has(wall.floorId)) return null;
              const floor = layoutV2.floors.find(
                (candidate) => candidate.id === wall.floorId,
              );
              return (
                <LayoutOpeningMarker
                  key={opening.id}
                  wall={wall}
                  opening={opening}
                  elevationM={floor?.elevationM ?? 0}
                />
              );
            })}

          {/* Zone boxes */}
          {!layoutV2 && transforms.map((t, idx) => {
            const zone = zones[idx]!;
            const color = getZoneColor(zone.type, styleTag);
            return (
              <ZoneMesh
                key={t.zoneId}
                transform={t}
                color={color}
                isSelected={zone.id === selectedZoneId}
                onClick={(e) => {
                  if (isSnapshot) {
                    e.stopPropagation();
                    return;
                  }
                  handleZoneClick(e, zone.id, t);
                }}
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

      {/* Overlays — outside Canvas, plain DOM. Suppressed in snapshot
          mode because both BeforeAfterCompare instances share the same
          overlay space and the snapshot view is read-only. */}
      {!isSnapshot && (
        <>
          <ItemPlacementPanel />
          <TourModeToggle />
        </>
      )}
    </div>
  );
}
