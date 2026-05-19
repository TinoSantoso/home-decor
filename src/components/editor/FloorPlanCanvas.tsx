import { useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Line, Text, Group, Transformer } from 'react-konva';
import type Konva from 'konva';
import {
  PIXELS_PER_METER,
  ZONE_COLORS,
  pxToMeters,
  snapPx,
  zoneAreaM2,
} from '../../lib/zones';
import { useFloorPlan } from '../../stores/floor-plan';

const STAGE_WIDTH = 1000;
const STAGE_HEIGHT = 700;
const GRID_STEP = PIXELS_PER_METER;

function GridBackground() {
  const lines: React.ReactElement[] = [];
  for (let x = 0; x <= STAGE_WIDTH; x += GRID_STEP) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, STAGE_HEIGHT]}
        stroke="oklch(90% 0.005 95)"
        strokeWidth={x % (GRID_STEP * 5) === 0 ? 1 : 0.5}
      />,
    );
  }
  for (let y = 0; y <= STAGE_HEIGHT; y += GRID_STEP) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, STAGE_WIDTH, y]}
        stroke="oklch(90% 0.005 95)"
        strokeWidth={y % (GRID_STEP * 5) === 0 ? 1 : 0.5}
      />,
    );
  }
  return <>{lines}</>;
}

export default function FloorPlanCanvas() {
  const zones = useFloorPlan((s) => s.zones);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const updateZone = useFloorPlan((s) => s.updateZone);
  const deleteZone = useFloorPlan((s) => s.deleteZone);
  const snapEnabled = useFloorPlan((s) => s.snapEnabled);
  const maybeSnap = (v: number) => (snapEnabled ? snapPx(v) : Math.round(v));

  const transformerRef = useRef<Konva.Transformer | null>(null);
  const rectRefs = useRef<Map<string, Konva.Rect>>(new Map());

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (selectedZoneId) {
      const node = rectRefs.current.get(selectedZoneId);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
        return;
      }
    }
    transformer.nodes([]);
    transformer.getLayer()?.batchDraw();
  }, [selectedZoneId, zones]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneId) {
        const target = e.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
        deleteZone(selectedZoneId);
      }
      if (e.key === 'Escape') selectZone(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedZoneId, deleteZone, selectZone]);

  return (
    <div className="overflow-auto rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white">
      <Stage
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) selectZone(null);
        }}
      >
        <Layer listening={false}>
          <GridBackground />
        </Layer>
        <Layer>
          {zones.map((zone) => {
            const colors = ZONE_COLORS[zone.type];
            const widthM = pxToMeters(zone.width).toFixed(2);
            const heightM = pxToMeters(zone.height).toFixed(2);
            const area = zoneAreaM2(zone).toFixed(2);
            return (
              <Group key={zone.id}>
                <Rect
                  ref={(node) => {
                    if (node) rectRefs.current.set(zone.id, node);
                    else rectRefs.current.delete(zone.id);
                  }}
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={selectedZoneId === zone.id ? 2 : 1}
                  draggable
                  onMouseDown={() => selectZone(zone.id)}
                  onDragEnd={(e) => {
                    updateZone(zone.id, {
                      x: maybeSnap(e.target.x()),
                      y: maybeSnap(e.target.y()),
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Rect;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const newWidth = Math.max(
                      PIXELS_PER_METER,
                      maybeSnap(node.width() * scaleX),
                    );
                    const newHeight = Math.max(
                      PIXELS_PER_METER,
                      maybeSnap(node.height() * scaleY),
                    );
                    node.scaleX(1);
                    node.scaleY(1);
                    updateZone(zone.id, {
                      x: maybeSnap(node.x()),
                      y: maybeSnap(node.y()),
                      width: newWidth,
                      height: newHeight,
                    });
                  }}
                />
                <Text
                  x={zone.x + 6}
                  y={zone.y + 6}
                  text={`${zone.name}\n${widthM}m × ${heightM}m\n${area} m²`}
                  fontSize={12}
                  fill="oklch(20% 0.015 270)"
                  listening={false}
                />
              </Group>
            );
          })}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            anchorSize={8}
            borderStroke="oklch(55% 0.12 250)"
            anchorStroke="oklch(55% 0.12 250)"
          />
        </Layer>
      </Stage>
    </div>
  );
}
