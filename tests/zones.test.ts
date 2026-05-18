import { describe, expect, it } from 'vitest';
import {
  PIXELS_PER_METER,
  isIndoor,
  metersToPx,
  pxToMeters,
  snapPx,
  zoneAreaM2,
} from '../src/lib/zones';

describe('zones', () => {
  it('converts pixels and meters using PIXELS_PER_METER', () => {
    expect(metersToPx(1)).toBe(PIXELS_PER_METER);
    expect(pxToMeters(PIXELS_PER_METER)).toBe(1);
    expect(metersToPx(4.5)).toBe(90);
  });

  it('snaps pixel values to the 0.25 m grid', () => {
    expect(snapPx(0)).toBe(0);
    expect(snapPx(4)).toBe(5);
    expect(snapPx(6)).toBe(5);
    expect(snapPx(7.5)).toBe(10);
  });

  it('computes zone area in m²', () => {
    expect(zoneAreaM2({ width: metersToPx(4), height: metersToPx(5) })).toBe(20);
    expect(zoneAreaM2({ width: metersToPx(3), height: metersToPx(2.5) })).toBe(7.5);
  });

  it('classifies indoor vs outdoor zones', () => {
    expect(isIndoor('living_room')).toBe(true);
    expect(isIndoor('kitchen')).toBe(true);
    expect(isIndoor('terrace')).toBe(false);
    expect(isIndoor('garden')).toBe(false);
  });
});
