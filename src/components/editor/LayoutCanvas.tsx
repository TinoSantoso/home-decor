import { useMemo } from 'react';
import { Circle, Group, Layer, Line, Stage, Text } from 'react-konva';
import { snapPoint } from '../../lib/layout-v2/geometry';
import {
  getLayoutAreaFill,
  getLayoutWallColor,
} from '../../lib/layout-v2/materials';
import { metersToPx } from '../../lib/zones';
import { useFloorPlan } from '../../stores/floor-plan';

const STAGE_WIDTH = 1000;
const STAGE_HEIGHT = 700;

export function LayoutCanvas() {
  const layout = useFloorPlan((s) => s.layoutV2);
  const selectedAreaId = useFloorPlan((s) => s.selectedLayoutAreaId);
  const selectedWallId = useFloorPlan((s) => s.selectedLayoutWallId);
  const selectArea = useFloorPlan((s) => s.selectLayoutArea);
  const selectWall = useFloorPlan((s) => s.selectLayoutWall);
  const updateAreaPoints = useFloorPlan((s) => s.updateAreaPoints);
  const wallsById = useMemo(
    () => new Map(layout?.walls.map((wall) => [wall.id, wall]) ?? []),
    [layout?.walls],
  );

  if (!layout) return null;

  const activeAreas = layout.areas.filter(
    (area) => area.floorId === layout.activeFloorId,
  );
  const activeWalls = layout.walls.filter(
    (wall) => wall.floorId === layout.activeFloorId,
  );

  return (
    <div className="overflow-auto rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white">
      <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
        <Layer>
          {activeAreas.map((area) => {
            const points = area.points.flatMap((point) => [point.x, point.y]);
            return (
              <Group key={area.id}>
                <Line
                  points={points}
                  closed
                  fill={getLayoutAreaFill(area)}
                  stroke={selectedAreaId === area.id ? '#3f7f5f' : '#6c6c64'}
                  strokeWidth={selectedAreaId === area.id ? 3 : 1.5}
                  opacity={0.72}
                  onMouseDown={() => selectArea(area.id)}
                />
                <Text
                  x={area.points[0]!.x + 8}
                  y={area.points[0]!.y + 8}
                  text={area.name}
                  fontSize={12}
                  fill="#222"
                  listening={false}
                />
                {selectedAreaId === area.id &&
                  area.points.map((point, index) => (
                    <Circle
                      key={`${area.id}-${index}`}
                      x={point.x}
                      y={point.y}
                      radius={6}
                      fill="#ffffff"
                      stroke="#3f7f5f"
                      strokeWidth={2}
                      draggable
                      onDragEnd={(event) => {
                        const next = [...area.points];
                        next[index] = snapPoint({
                          x: event.target.x(),
                          y: event.target.y(),
                        });
                        updateAreaPoints(area.id, next);
                      }}
                    />
                  ))}
              </Group>
            );
          })}
          {activeWalls.map((wall) => (
            <Line
              key={wall.id}
              points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
              stroke={getLayoutWallColor(wall.material)}
              strokeWidth={
                selectedWallId === wall.id ? 8 : wall.heightM > 1 ? 5 : 3
              }
              onMouseDown={() => selectWall(wall.id)}
            />
          ))}
          {layout.openings.map((opening) => {
            const wall = wallsById.get(opening.wallId);
            if (!wall || wall.floorId !== layout.activeFloorId) return null;
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.hypot(dx, dy) || 1;
            const t = Math.min(
              1,
              Math.max(0, metersToPx(opening.offsetM) / length),
            );
            return (
              <Circle
                key={opening.id}
                x={wall.start.x + dx * t}
                y={wall.start.y + dy * t}
                radius={opening.type === 'door' ? 7 : 5}
                fill={opening.type === 'door' ? '#b78352' : '#79aee8'}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
