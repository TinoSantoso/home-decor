/**
 * TDD: share token functions (generate, get, revoke, validate).
 * Mocks IDB so no real IndexedDB is needed. Runs in node env.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// vi.mock is hoisted before all imports. Use vi.hoisted() so the mock factory
// can reference shared state (hoisted alongside vi.mock).
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    get: vi.fn().mockImplementation(async () => undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  return { mockDb };
});

vi.mock('../../src/lib/db/idb', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

// Import AFTER vi.mock so the mock is in place.
import {
  generateShareToken,
  getShareToken,
  revokeShareToken,
  isShareTokenValid,
} from '../../src/lib/db/projects';

describe('share token functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateShareToken', () => {
    beforeEach(() => {
      mockDb.get.mockReset();
      mockDb.put.mockReset();
    });

    it('returns null when the project does not exist', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const token = await generateShareToken('nonexistent-id');

      expect(token).toBeNull();
      expect(mockDb.put).not.toHaveBeenCalled();
    });

    it('returns a nanoid(16) token and stores it with 30-day expiry', async () => {
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const project = {
        id: 'proj-123',
        name: 'My Project',
        templateId: null,
        budgetTier: 'standar',
        contingencyPct: 0.1,
        taxEnabled: false,
        climateZone: 'tropical_indonesia',
        styleTag: null,
        floorPlanImageUrl: null,
        shareToken: null,
        shareTokenExpiry: null,
        zones: [],
        placedItems: [],
        createdAt: now,
        updatedAt: now,
      };
      mockDb.get.mockResolvedValueOnce(project);

      const token = await generateShareToken('proj-123');

      // Token should be a string of length 16 (nanoid default alphabet)
      expect(token).not.toBeNull();
      expect(typeof token).toBe('string');
      expect(token!.length).toBe(16);
      expect(/^[A-Za-z0-9_-]+$/.test(token!)).toBe(true);

      // db.put should have been called with updated record
      expect(mockDb.put).toHaveBeenCalledTimes(1);
      const [, savedRecord] = mockDb.put.mock.calls[0]!;
      const saved = savedRecord as Record<string, unknown>;
      expect(saved['shareToken']).toBe(token!);
      expect(typeof saved['shareTokenExpiry']).toBe('number');
      expect((saved['shareTokenExpiry'] as number)).toBeGreaterThanOrEqual(now + thirtyDaysMs - 1000);
      expect((saved['shareTokenExpiry'] as number)).toBeLessThanOrEqual(now + thirtyDaysMs + 1000);
    });

    it('overwrites an existing token', async () => {
      const now = Date.now();
      const oldRecord = {
        id: 'proj-456',
        name: 'Old Project',
        templateId: null,
        budgetTier: 'standar',
        contingencyPct: 0.1,
        taxEnabled: false,
        climateZone: 'tropical_indonesia',
        styleTag: null,
        floorPlanImageUrl: null,
        shareToken: 'old-token-abcdef',
        shareTokenExpiry: now + 1000, // already expired but valid format
        zones: [],
        placedItems: [],
        createdAt: now,
        updatedAt: now,
      };
      mockDb.get.mockResolvedValueOnce(oldRecord);

      const newToken = await generateShareToken('proj-456');

      expect(newToken).not.toBeNull();
      expect(newToken!).not.toBe('old-token-abcdef');
      expect(newToken!.length).toBe(16);

      const [, savedRecord] = mockDb.put.mock.calls[0]!;
      expect((savedRecord as Record<string, unknown>)['shareToken']).toBe(newToken!);
    });
  });

  describe('getShareToken', () => {
    beforeEach(() => {
      mockDb.get.mockReset();
    });

    it('returns null when the project has no share token', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-no-token',
        name: 'No Token',
        shareToken: null,
        shareTokenExpiry: null,
      });

      const result = await getShareToken('proj-no-token');

      expect(result).toBeNull();
    });

    it('returns token and expiry when present', async () => {
      const now = Date.now();
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-has-token',
        name: 'Has Token',
        shareToken: 'abc123def456ghij',
        shareTokenExpiry: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const result = await getShareToken('proj-has-token');

      expect(result).not.toBeNull();
      expect(result!.token).toBe('abc123def456ghij');
      expect(result!.expiry).toBe(now + 7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('revokeShareToken', () => {
    beforeEach(() => {
      mockDb.get.mockReset();
      mockDb.put.mockReset();
    });

    it('sets shareToken and shareTokenExpiry to null', async () => {
      const now = Date.now();
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-to-revoke',
        name: 'To Revoke',
        shareToken: 'active-token-1234',
        shareTokenExpiry: now + 30 * 24 * 60 * 60 * 1000,
      });

      await revokeShareToken('proj-to-revoke');

      expect(mockDb.put).toHaveBeenCalledTimes(1);
      const [, savedRecord] = mockDb.put.mock.calls[0]!;
      expect((savedRecord as Record<string, unknown>)['shareToken']).toBeNull();
      expect((savedRecord as Record<string, unknown>)['shareTokenExpiry']).toBeNull();
    });

    it('is a no-op when project does not exist', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      await revokeShareToken('nonexistent');

      expect(mockDb.put).not.toHaveBeenCalled();
    });
  });

  describe('isShareTokenValid', () => {
    beforeEach(() => {
      mockDb.get.mockReset();
    });

    it('returns false when project has no token', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-empty',
        shareToken: null,
        shareTokenExpiry: null,
      });

      const valid = await isShareTokenValid('proj-empty', 'any-token');

      expect(valid).toBe(false);
    });

    it('returns false when token does not match', async () => {
      const now = Date.now();
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-mismatch',
        shareToken: 'correct-token-1234',
        shareTokenExpiry: now + 30 * 24 * 60 * 60 * 1000,
      });

      const valid = await isShareTokenValid('proj-mismatch', 'wrong-token-5678');

      expect(valid).toBe(false);
    });

    it('returns false when token is expired', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-expired',
        shareToken: 'expired-token-abcd',
        shareTokenExpiry: Date.now() - 1000, // expired 1 second ago
      });

      const valid = await isShareTokenValid('proj-expired', 'expired-token-abcd');

      expect(valid).toBe(false);
    });

    it('returns true when token matches and is not expired', async () => {
      const now = Date.now();
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-valid',
        shareToken: 'valid-token-xyz1',
        shareTokenExpiry: now + 15 * 24 * 60 * 60 * 1000, // 15 days
      });

      const valid = await isShareTokenValid('proj-valid', 'valid-token-xyz1');

      expect(valid).toBe(true);
    });

    it('returns false when shareTokenExpiry is null even if token matches', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'proj-null-expiry',
        shareToken: 'token-with-null-expiry',
        shareTokenExpiry: null,
      });

      const valid = await isShareTokenValid('proj-null-expiry', 'token-with-null-expiry');

      expect(valid).toBe(false);
    });
  });
});