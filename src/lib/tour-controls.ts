/**
 * Pure WASD keyboard-to-velocity helper for the first-person walk mode.
 *
 * Isomorphic — no React, no DOM, no R3F imports — so this can be tested
 * under Node without WebGL or happy-dom.
 *
 * Coordinate convention (Three.js right-handed Y-up):
 *   W / S  → −Z / +Z  (forward / backward)
 *   A / D  → −X / +X  (strafe left / right)
 *   Y is always 0 (no vertical movement in walk mode)
 *
 * The raw directional input is normalised before scaling so diagonal
 * movement is never faster than axis-aligned movement.
 */

/** Keys currently held — values are `boolean | undefined`. */
export type HeldKeys = Partial<Record<string, boolean>>;

/**
 * Convert a snapshot of held keys into a world-space velocity vector.
 *
 * @param keys     — map of KeyboardEvent.code → pressed state
 * @param deltaSec — seconds elapsed since the last frame (frame delta)
 * @param speed    — metres per second at full speed
 * @returns        [dx, dy, dz] displacement in metres for this frame
 */
export function keysToVelocity(
  keys: HeldKeys,
  deltaSec: number,
  speed: number,
): [number, number, number] {
  // Accumulate raw direction — each active key contributes ±1 on its axis.
  let dx = 0;
  let dz = 0;

  if (keys['KeyW'] ?? false) dz -= 1; // forward  → −Z
  if (keys['KeyS'] ?? false) dz += 1; // backward → +Z
  if (keys['KeyA'] ?? false) dx -= 1; // strafe left  → −X
  if (keys['KeyD'] ?? false) dx += 1; // strafe right → +X

  // Normalise so diagonal is the same speed as axis-aligned.
  const mag = Math.hypot(dx, dz);
  if (mag === 0 || deltaSec === 0) return [0, 0, 0];

  const scale = (speed * deltaSec) / mag;
  return [dx * scale, 0, dz * scale];
}
