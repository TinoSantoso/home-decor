import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';
import { deriveBeforeSnapshot } from '../../lib/tour-snapshot';
import { useWipeSliderDrag } from './useWipeSliderDrag';
import TourScene from './TourScene';

/**
 * Phase 2 slice 5: Before/After wipe-slider compare.
 *
 * Renders two TourScene instances stacked via absolute positioning:
 *   - LEFT  = "before" snapshot (no placed items, default style), clipped
 *             on its right side using `clip-path: inset(0 (W - sliderPx) 0 0)`.
 *   - RIGHT = live store ("after"), clipped on its left side using
 *             `clip-path: inset(0 0 0 sliderPx)`.
 *
 * A draggable vertical divider sets `sliderPx`. Pointer moves are rAF-
 * throttled so React only re-renders once per animation frame.
 *
 * NOTE: Two `<Canvas>` elements means two WebGL contexts on screen at the
 * same time. This is acceptable for desktop browsers (the practical
 * concern raised by the plan); we'd revisit on mobile in a later phase.
 */
export function BeforeAfterCompare() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const zones = useFloorPlan((s) => s.zones);
  const placedItems = useFloorPlan((s) => s.placedItems);
  const styleTag = useFloorPlan((s) => s.styleTag);
  const beforeSnapshot = useMemo(
    () => deriveBeforeSnapshot({ zones, placedItems, styleTag }),
    [zones, placedItems, styleTag],
  );

  const { sliderPx, containerWidth, handleDividerPointerDown, handleDividerKeyDown } =
    useWipeSliderDrag(containerRef);

  // Clip-paths: insets are (top, right, bottom, left).
  // Before (left) shows columns [0 .. sliderPx]; clip right edge.
  // After  (right) shows columns [sliderPx .. W]; clip left edge.
  const beforeClip =
    containerWidth > 0
      ? `inset(0 ${Math.max(0, containerWidth - sliderPx)}px 0 0)`
      : 'inset(0 50% 0 0)';
  const afterClip =
    containerWidth > 0
      ? `inset(0 0 0 ${sliderPx}px)`
      : 'inset(0 0 0 50%)';

  return (
    <div
      ref={containerRef}
      data-testid="before-after-compare"
      className="relative h-[700px] w-full overflow-hidden rounded-[var(--radius)] border border-[color:var(--color-border)]"
    >
      {/* BEFORE scene — clipped on the right */}
      <div
        data-testid="before-after-before"
        className="absolute inset-0"
        style={{ clipPath: beforeClip, WebkitClipPath: beforeClip }}
      >
        <TourScene snapshot={beforeSnapshot} />
      </div>

      {/* AFTER scene — clipped on the left, reads live store */}
      <div
        data-testid="before-after-after"
        className="absolute inset-0"
        style={{ clipPath: afterClip, WebkitClipPath: afterClip }}
      >
        <TourScene />
      </div>

      {/* Side labels — sit above the WebGL canvases */}
      <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
        {t('tour.compareBefore')}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
        {t('tour.compareAfter')}
      </span>

      {/* Divider — vertical bar at sliderPx with a draggable thumb */}
      <div
        data-testid="before-after-divider"
        role="slider"
        tabIndex={0}
        aria-label={t('tour.compareSliderLabel')}
        aria-valuemin={0}
        aria-valuemax={containerWidth || 1}
        aria-valuenow={Math.round(sliderPx)}
        onPointerDown={handleDividerPointerDown}
        onKeyDown={handleDividerKeyDown}
        className="absolute top-0 z-30 h-full w-1 -translate-x-1/2 cursor-ew-resize bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
        style={{ left: `${sliderPx}px`, touchAction: 'none' }}
      >
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-xs font-bold text-black shadow"
        >
          ⇆
        </div>
      </div>
    </div>
  );
}
