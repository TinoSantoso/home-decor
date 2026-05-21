import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export interface UseWipeSliderDragResult {
  sliderPx: number;
  containerWidth: number;
  handleDividerPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  handleDividerKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export function useWipeSliderDrag(
  containerRef: RefObject<HTMLDivElement | null>,
): UseWipeSliderDragResult {
  const [containerWidth, setContainerWidth] = useState(0);
  const [sliderPx, setSliderPx] = useState(0);
  const draggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const latestClientXRef = useRef(0);

  // Measure container on mount and on resize. Set initial slider to middle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      setContainerWidth(w);
      setSliderPx((prev) => (prev === 0 ? w / 2 : Math.min(prev, w)));
    };
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setSliderFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    setSliderPx(Math.max(0, Math.min(x, rect.width)));
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      latestClientXRef.current = e.clientX;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setSliderFromClientX(latestClientXRef.current);
      });
    },
    [setSliderFromClientX],
  );

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Window-level listeners while dragging to track pointer outside divider.
  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [handlePointerMove, stopDragging]);

  const handleDividerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      setSliderFromClientX(e.clientX);
    },
    [setSliderFromClientX],
  );

  const handleDividerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (containerWidth === 0) return;
      const step = containerWidth * 0.05;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSliderPx((prev) => Math.max(0, prev - step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSliderPx((prev) => Math.min(containerWidth, prev + step));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSliderPx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSliderPx(containerWidth);
      }
    },
    [containerWidth],
  );

  return {
    sliderPx,
    containerWidth,
    handleDividerPointerDown,
    handleDividerKeyDown,
  };
}
