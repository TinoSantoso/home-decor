import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, PointerLockControls } from '@react-three/drei';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { DEFAULT_WALK_SPEED_MS, keysToVelocity, type HeldKeys } from '../../lib/tour-controls';

interface TourControlsProps {
  mode: 'orbit' | 'walk';
  /** OrbitControls target (used in orbit mode). */
  target: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
}

/**
 * Swaps between OrbitControls (overview) and PointerLockControls + WASD
 * (first-person walk) based on the `mode` prop.
 *
 * Must be rendered INSIDE a `<Canvas>` because it uses R3F hooks.
 * The mode value should come from the floor-plan store, not local state.
 */
export function TourControls({ mode, target, minDistance = 2, maxDistance = 40 }: TourControlsProps) {
  const plcRef = useRef<PointerLockControlsImpl>(null);
  const heldKeys = useRef<HeldKeys>({});

  useEffect(() => {
    if (mode !== 'walk') return;

    function onKeyDown(e: KeyboardEvent) {
      heldKeys.current[e.code] = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      heldKeys.current[e.code] = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      // Clear any held keys when leaving walk mode.
      heldKeys.current = {};
    };
  }, [mode]);

  useFrame((_state, delta) => {
    if (mode !== 'walk') return;
    const plc = plcRef.current;
    if (!plc || !plc.isLocked) return;

    const [dx, , dz] = keysToVelocity(heldKeys.current, delta, DEFAULT_WALK_SPEED_MS);
    if (dx === 0 && dz === 0) return;

    plc.moveForward(-dz);
    plc.moveRight(dx);
  });

  if (mode === 'walk') {
    // selector="canvas" means clicking the canvas requests pointer-lock.
    // This is the user gesture required by the browser. The toggle button
    // click only changes the mode; the user then clicks the canvas to lock.
    return <PointerLockControls ref={plcRef} selector="canvas" makeDefault />;
  }

  return (
    <OrbitControls
      target={target}
      makeDefault
      enablePan
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  );
}
