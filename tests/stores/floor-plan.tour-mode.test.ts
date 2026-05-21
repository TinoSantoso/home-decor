import { describe, beforeEach, expect, it } from 'vitest';
import { useFloorPlan, resetForTests } from '../../src/stores/floor-plan';

/**
 * Node-env tests for the tourMode slice added in Phase 2 slice 2.
 *
 * Each test calls resetForTests() in beforeEach so no state leaks
 * between cases.
 */

describe('tourMode store slice', () => {
  beforeEach(() => {
    resetForTests();
  });

  it('defaults to "orbit" mode', () => {
    const mode = useFloorPlan.getState().tourMode;
    expect(mode).toBe('orbit');
  });

  it('setTourMode transitions to "walk"', () => {
    useFloorPlan.getState().setTourMode('walk');
    expect(useFloorPlan.getState().tourMode).toBe('walk');
  });

  it('setTourMode transitions back to "orbit"', () => {
    useFloorPlan.getState().setTourMode('walk');
    useFloorPlan.getState().setTourMode('orbit');
    expect(useFloorPlan.getState().tourMode).toBe('orbit');
  });

  it('resetForTests resets tourMode back to "orbit"', () => {
    useFloorPlan.getState().setTourMode('walk');
    resetForTests();
    expect(useFloorPlan.getState().tourMode).toBe('orbit');
  });
});
