import { describe, expect, it } from 'vitest';
import { buildCheckoutMetadata } from '../../src/server/checkout';

describe('buildCheckoutMetadata', () => {
  it('embeds entitlement metadata for unlimited monthly checkout', () => {
    expect(buildCheckoutMetadata('user-1', 'unlimited_monthly')).toEqual({
      userId: 'user-1',
      entitlementType: 'unlimited_monthly',
      durationDays: '30',
    });
  });
});
